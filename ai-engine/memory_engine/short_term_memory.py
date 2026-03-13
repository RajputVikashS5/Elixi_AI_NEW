"""In-memory short-term context buffer (per session, max 20 turns)."""

from collections import defaultdict, deque
from typing import Optional

_MAX_TURNS = 20


class ShortTermMemory:
    def __init__(self) -> None:
        # session_id → deque of {"role": ..., "content": ...}
        self._store: dict[str, deque] = defaultdict(lambda: deque(maxlen=_MAX_TURNS))

    def add_message(self, session_id: str, role: str, content: str) -> None:
        self._store[session_id].append({"role": role, "content": content})

    def get_history(self, session_id: str) -> list[dict]:
        return list(self._store[session_id])

    def clear(self, session_id: str) -> None:
        self._store.pop(session_id, None)

    def get_all_sessions(self) -> list[str]:
        return list(self._store.keys())
