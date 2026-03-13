"""Simple habit tracker based on repeated command patterns."""

from collections import defaultdict
from datetime import datetime


class HabitTracker:
    def __init__(self) -> None:
        self._counts: dict[str, int] = defaultdict(int)
        self._last_seen: dict[str, str] = {}

    def record(self, pattern: str) -> None:
        self._counts[pattern] += 1
        self._last_seen[pattern] = datetime.utcnow().isoformat()

    def top_habits(self, limit: int = 10) -> list[dict]:
        items = sorted(self._counts.items(), key=lambda x: x[1], reverse=True)[:limit]
        return [
            {
                "name": pattern,
                "occurrence_count": count,
                "last_seen": self._last_seen.get(pattern),
            }
            for pattern, count in items
        ]
