"""Memory retention policies: TTL cleanup and per-user caps."""

from __future__ import annotations

import logging

from core.config import Settings
from memory_engine.long_term_memory import LongTermMemory

logger = logging.getLogger(__name__)


class MemoryRetentionService:
    def __init__(self, settings: Settings, memory: LongTermMemory):
        self.settings = settings
        self.memory = memory

    async def enforce_for_user(self, owner_id: str) -> None:
        purged = await self.memory.purge_expired_memories(owner_id=owner_id)
        trimmed = await self.memory.enforce_memory_limit(
            owner_id=owner_id,
            max_items=self.settings.memory_max_facts_per_user,
        )

        if purged or trimmed:
            logger.info(
                "memory_retention_applied owner=%s purged=%s trimmed=%s",
                owner_id,
                purged,
                trimmed,
            )

    async def enforce_global(self) -> None:
        purged = await self.memory.purge_expired_memories(owner_id=None)
        if purged:
            logger.info("memory_retention_global_purged=%s", purged)
