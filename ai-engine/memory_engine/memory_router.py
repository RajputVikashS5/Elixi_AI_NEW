"""Memory routing orchestration across short-term, long-term, and vector memory."""

import asyncio

from memory_engine.short_term_memory import ShortTermMemory
from memory_engine.long_term_memory import LongTermMemory
from memory_engine.habit_tracker import HabitTracker
from memory_engine.vector_memory import VectorMemory


class MemoryRouter:
    def __init__(self) -> None:
        self.short_term = ShortTermMemory()
        self.long_term = LongTermMemory()
        self.vector = VectorMemory()
        self.habits = HabitTracker(self.long_term)

    async def get_context(
        self,
        session_id: str,
        user_message: str,
        owner_id: str,
        intent: str | None = None,
        entities: dict | None = None,
    ) -> dict:
        short_history = self.short_term.get_history(session_id)
        if len(short_history) < 2:
            persisted = await self.long_term.get_messages(session_id, limit=20, owner_id=owner_id)
            short_history = [{"role": item["role"], "content": item["content"]} for item in persisted[-20:]]

        long_facts = await self.long_term.search_facts(user_message, owner_id=owner_id)
        vector_matches = await asyncio.to_thread(self.vector.search, user_message, 5, session_id, owner_id)
        proactive_habits = await self.habits.suggest(user_message, intent or "", entities or {})
        return {
            "short_history": short_history,
            "long_facts": long_facts,
            "vector_matches": vector_matches,
            "proactive_habits": proactive_habits,
        }

    def record_message(self, session_id: str, role: str, content: str) -> None:
        self.short_term.add_message(session_id, role, content)

    async def record_interaction(self, message: str, intent: str, entities: dict | None = None) -> dict | None:
        return await self.habits.record_interaction(message=message, intent=intent, entities=entities)
