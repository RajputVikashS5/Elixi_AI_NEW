"""Memory API router."""

import json
import logging
import uuid
from fastapi import APIRouter, HTTPException, Query

from models.schemas import MemoryFact, MemorySearchRequest
from memory_engine.long_term_memory import LongTermMemory
from memory_engine.vector_memory import VectorMemory
from memory_engine.habit_summarizer import HabitSummarizer
from memory_engine.habit_tracker import HabitTracker

router = APIRouter()
logger = logging.getLogger(__name__)
memory = LongTermMemory()
vector_memory = VectorMemory()
habit_summarizer = HabitSummarizer()
habit_tracker = HabitTracker(memory)


@router.get("/facts")
async def get_facts(category: str | None = Query(default=None)):
    return await memory.get_facts(category)


@router.post("/facts")
async def store_fact(fact: MemoryFact):
    fact_id = str(uuid.uuid4())
    await memory.store_fact(
        fact_id=fact_id,
        category=fact.category,
        key=fact.key,
        value=fact.value,
        confidence=fact.confidence,
        source=fact.source,
    )

    # Keep vector index fresh for semantic recall.
    vector_memory.store(
        doc_id=f"memory:{fact_id}",
        text=f"{fact.category} {fact.key}: {fact.value}",
        metadata={
            "source": "memory",
            "category": fact.category,
            "key": fact.key,
            "confidence": fact.confidence,
        },
    )
    return {"id": fact_id, "status": "stored"}


@router.delete("/facts/{fact_id}")
async def delete_fact(fact_id: str):
    deleted = await memory.delete_fact(fact_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Fact not found")
    vector_memory.delete(f"memory:{fact_id}")
    return {"status": "deleted"}


@router.post("/search")
async def search_memory(body: MemorySearchRequest):
    fact_results = await memory.search_facts(body.query)
    semantic_results = vector_memory.search(body.query, top_k=body.limit)

    results: list[dict] = []
    seen_ids: set[str] = set()

    for item in semantic_results:
        results.append(item)
        seen_ids.add(item["id"])

    for fact in fact_results:
        if fact["id"] in seen_ids:
            continue
        results.append(
            {
                "id": fact["id"],
                "content": f"{fact['key']}: {fact['value']}",
                "score": round(float(fact.get("confidence", 1.0)) * 0.5, 4),
                "metadata": {
                    "source": "memory",
                    "category": fact.get("category"),
                    "key": fact.get("key"),
                },
            }
        )

    return {"results": results[: body.limit]}


@router.get("/habits")
async def get_habits():
    return await memory.get_habits()


@router.get("/semantic-browse")
async def semantic_browse(
    query: str = Query(..., min_length=1, description="Search query"),
    confidence_threshold: float = Query(default=0.0, ge=0.0, le=1.0, description="Minimum confidence score"),
    source_type: str | None = Query(default=None, description="Filter by source: memory, message, habit, or vector"),
    limit: int = Query(default=10, ge=1, le=100, description="Maximum results"),
    session_id: str | None = Query(default=None, description="Optional session ID for context"),
):
    """Semantic browse with filters and confidence thresholds."""
    try:
        # Fetch semantic results from vector memory
        results = vector_memory.search(query=query, top_k=limit * 2, session_id=session_id)
        
        # Filter by confidence threshold and source type
        filtered_results: list[dict] = []
        for result in results:
            score = result.get("score", 0.0)
            
            # Apply confidence threshold
            if score < confidence_threshold:
                continue
            
            metadata = result.get("metadata", {})
            result_source = metadata.get("source", "unknown")
            
            # Apply source type filter if specified
            if source_type and result_source != source_type:
                continue
            
            filtered_results.append({
                "id": result["id"],
                "content": result["content"],
                "score": result["score"],
                "source": result_source,
                "metadata": metadata,
            })
        
        return {
            "query": query,
            "confidence_threshold": confidence_threshold,
            "source_type": source_type,
            "results": filtered_results[:limit],
            "total": len(filtered_results),
        }
    except Exception as exc:
        logger.error("semantic-browse error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/habit-summary")
async def get_habit_summary():
    """Retrieve the most recent habit summary for suggestion quality analysis."""
    try:
        summary = await habit_summarizer.get_habit_summary()
        if summary is None:
            return {
                "status": "no_summary",
                "message": "No habits available for summary yet. Habits require at least 2 occurrences.",
            }
        return {"status": "ok", "summary": summary}
    except Exception as exc:
        logger.error("get_habit_summary error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/habit-summary/trigger")
async def trigger_habit_summarization():
    """Manually trigger habit summarization (normally runs on schedule every 2 hours)."""
    try:
        result = await habit_summarizer.summarize_habits()
        return {
            "status": "completed",
            "summary": result,
        }
    except Exception as exc:
        logger.error("trigger_habit_summarization error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/habit-suggestions/diagnostics")
async def habit_suggestions_diagnostics(
    message: str = Query(..., min_length=1, description="Current user message"),
    intent: str = Query(default="", description="Detected intent for scoring"),
    limit: int = Query(default=20, ge=1, le=200, description="Maximum diagnostics rows"),
    include_ineligible: bool = Query(default=False, description="Include habits below eligibility threshold"),
    entities_json: str | None = Query(default=None, description="Optional JSON object for extracted entities"),
):
    """Debug endpoint returning exact per-habit score breakdown for suggestion quality analysis."""
    try:
        entities: dict = {}
        if entities_json:
            parsed = json.loads(entities_json)
            if isinstance(parsed, dict):
                entities = parsed
            else:
                raise HTTPException(status_code=400, detail="entities_json must be a JSON object")

        diagnostics = await habit_tracker.score_diagnostics(
            message=message,
            intent=intent,
            entities=entities,
            limit=limit,
            include_ineligible=include_ineligible,
        )
        return diagnostics
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid entities_json: {exc}") from exc
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("habit_suggestions_diagnostics error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))
