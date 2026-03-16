"""Memory API router."""

import uuid
from fastapi import APIRouter, HTTPException, Query

from models.schemas import MemoryFact, MemorySearchRequest
from memory_engine.long_term_memory import LongTermMemory
from memory_engine.vector_memory import VectorMemory

router = APIRouter()
memory = LongTermMemory()
vector_memory = VectorMemory()


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
    return {"id": fact_id, "status": "stored"}


@router.delete("/facts/{fact_id}")
async def delete_fact(fact_id: str):
    deleted = await memory.delete_fact(fact_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Fact not found")
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
