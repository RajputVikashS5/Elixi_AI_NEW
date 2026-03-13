"""Memory API router."""

import uuid
from fastapi import APIRouter, HTTPException, Query

from models.schemas import MemoryFact, MemorySearchRequest
from memory_engine.long_term_memory import LongTermMemory

router = APIRouter()
memory = LongTermMemory()


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
    results = await memory.search_facts(body.query)
    return {"results": results[: body.limit]}


@router.get("/habits")
async def get_habits():
    return await memory.get_habits()
