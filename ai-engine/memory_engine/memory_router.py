"""Memory routing orchestration across short-term, long-term, and vector memory."""

from memory_engine.short_term_memory import ShortTermMemory
from memory_engine.long_term_memory import LongTermMemory
from memory_engine.vector_memory import VectorMemory


class MemoryRouter:
    def __init__(self) -> None:
        self.short_term = ShortTermMemory()
        self.long_term = LongTermMemory()
        self.vector = VectorMemory()

    async def get_context(self, session_id: str, user_message: str) -> dict:
        short_history = self.short_term.get_history(session_id)
        long_facts = await self.long_term.search_facts(user_message)
        vector_matches = self.vector.search(user_message, top_k=5)
        return {
            "short_history": short_history,
            "long_facts": long_facts,
            "vector_matches": vector_matches,
        }
