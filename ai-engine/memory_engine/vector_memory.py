"""Vector memory stub — ChromaDB integration (fully implemented in Phase 4)."""

import logging
from typing import Optional

logger = logging.getLogger(__name__)


class VectorMemory:
    """Phase 1 stub. Returns empty results; does not require ChromaDB at runtime."""

    def store(self, doc_id: str, text: str, metadata: Optional[dict] = None) -> None:
        logger.debug("VectorMemory.store called (stub): %s", doc_id)

    def search(self, query: str, top_k: int = 5) -> list[dict]:
        logger.debug("VectorMemory.search called (stub): %s", query)
        return []
