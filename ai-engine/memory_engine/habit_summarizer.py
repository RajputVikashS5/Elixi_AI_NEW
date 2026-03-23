"""Periodic habit summarization for improved proactive suggestions."""

import logging
from datetime import datetime, timezone
from typing import Any, Optional
import aiosqlite
import json

from memory_engine.long_term_memory import DB_PATH

logger = logging.getLogger(__name__)


class HabitSummarizer:
    """Analyzes and summarizes habits to improve suggestion quality."""

    def __init__(self) -> None:
        self.db_path = DB_PATH
        self.last_summary_time: Optional[datetime] = None

    def _now_utc(self) -> datetime:
        return datetime.now(timezone.utc)

    def _parse_last_seen(self, value: Optional[str]) -> Optional[datetime]:
        if not value:
            return None
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                return parsed.replace(tzinfo=timezone.utc)
            return parsed.astimezone(timezone.utc)
        except (ValueError, TypeError):
            return None

    async def summarize_habits(self) -> dict[str, Any]:
        """
        Periodically summarize habits for improved proactive suggestions.
        Groups habits by trigger type, calculates frequency trends, and enhances metadata.
        """
        try:
            async with aiosqlite.connect(self.db_path) as db:
                # Fetch all habits with high occurrence count
                cursor = await db.execute(
                    """
                    SELECT id, description, trigger, trigger_value, action, 
                           occurrences, occurrence_count, last_seen, metadata
                    FROM habits
                    WHERE COALESCE(occurrences, occurrence_count, 0) >= 2
                    ORDER BY COALESCE(occurrences, occurrence_count, 0) DESC
                    """
                )
                habits = await cursor.fetchall()
                habits = list(habits)

                if not habits:
                    logger.info("No habits to summarize")
                    return {"summarized_count": 0, "timestamp": self._now_utc().isoformat()}

                # Process and enhance habits
                summary: dict[str, Any] = {
                    "total_habits": len(habits),
                    "summarized_at": self._now_utc().isoformat(),
                    "habits_by_trigger": {},
                    "top_patterns": [],
                    "summary_stats": {"total_occurrences": 0, "avg_frequency": 0},
                }

                trigger_groups: dict[str, list[dict[str, Any]]] = {}
                all_occurrences = 0

                for habit in habits:
                    habit_id = habit[0]
                    description = habit[1]
                    trigger = habit[2] or "unknown"
                    trigger_value = habit[3] or ""
                    action = habit[4]
                    occurrences = habit[5] or habit[6] or 0  # Try preferable column first
                    last_seen = habit[7]
                    metadata_str = habit[8] or "{}"

                    try:
                        metadata = json.loads(metadata_str) if isinstance(metadata_str, str) else metadata_str
                    except json.JSONDecodeError:
                        metadata = {}

                    all_occurrences += occurrences

                    # Group by trigger type
                    if trigger not in trigger_groups:
                        trigger_groups[trigger] = []

                    trigger_groups[trigger].append(
                        {
                            "id": habit_id,
                            "description": description,
                            "trigger_value": trigger_value,
                            "occurrences": occurrences,
                            "last_seen": last_seen,
                            "action": action,
                            "metadata": metadata,
                            "frequency_score": self._calculate_frequency_score(occurrences, last_seen),
                        }
                    )

                # Build summary by trigger
                for trigger, group in trigger_groups.items():
                    group.sort(key=lambda x: x["occurrences"], reverse=True)
                    summary["habits_by_trigger"][trigger] = {
                        "count": len(group),
                        "total_occurrences": sum(h["occurrences"] for h in group),
                        "avg_frequency_score": round(
                            sum(float(h["frequency_score"]) for h in group) / max(len(group), 1),
                            3,
                        ),
                        "top_habits": [
                            {
                                "id": h["id"],
                                "description": h["description"],
                                "occurrences": h["occurrences"],
                                "frequency_score": h["frequency_score"],
                                "last_seen": h["last_seen"],
                                "trigger_value": h["trigger_value"],
                            }
                            for h in group[:5]
                        ],
                    }

                # Extract top patterns across all triggers
                all_habits_flat = [h for group in trigger_groups.values() for h in group]
                all_habits_flat.sort(key=lambda x: (x["frequency_score"], x["occurrences"]), reverse=True)
                summary["top_patterns"] = [
                    {
                        "id": h["id"],
                        "description": h["description"],
                        "trigger": next(
                            (t for t, group in trigger_groups.items() if any(g["id"] == h["id"] for g in group)),
                            "unknown",
                        ),
                        "occurrences": h["occurrences"],
                        "frequency_score": h["frequency_score"],
                    }
                    for h in all_habits_flat[:10]
                ]

                summary["summary_stats"]["total_occurrences"] = all_occurrences
                summary["summary_stats"]["avg_frequency"] = (
                    all_occurrences / len(habits) if habits else 0
                )

                # Persist summary metadata for suggestions
                await self._persist_summary(db, summary)

                await db.execute(
                    """
                    INSERT INTO habit_summaries(id, summarized_at, payload)
                    VALUES (?, ?, ?)
                    """,
                    (
                        f"summary:{int(self._now_utc().timestamp())}",
                        summary["summarized_at"],
                        json.dumps(summary),
                    ),
                )
                await db.commit()

                self.last_summary_time = self._now_utc()
                logger.info("Habit summarization complete: %d habits processed", len(habits))
                return summary

        except Exception as exc:
            logger.error("Habit summarization failed: %s", exc)
            return {"error": str(exc), "timestamp": self._now_utc().isoformat()}

    def _calculate_frequency_score(self, occurrences: int, last_seen: Optional[str]) -> float:
        """Calculate a frequency score based on occurrence count and recency."""
        base_score = min(occurrences / 10.0, 1.0)  # Normalize to 0-1

        # Apply recency bonus
        last_seen_dt = self._parse_last_seen(last_seen)
        if last_seen_dt is not None:
            days_ago = (self._now_utc() - last_seen_dt).days
            # Decay score over time: full bonus within 7 days, linear decay to day 30.
            if days_ago <= 7:
                recency_bonus = 0.3
            elif days_ago <= 30:
                recency_bonus = 0.3 * (1 - ((days_ago - 7) / 23))
            else:
                recency_bonus = 0.0
            base_score += recency_bonus

        return round(min(base_score, 1.0), 3)

    async def _persist_summary(self, db: aiosqlite.Connection, summary: dict[str, Any]) -> None:
        """Store summary metadata back into habit records for faster suggestion queries."""
        try:
            for trigger, group_data in summary.get("habits_by_trigger", {}).items():
                for habit in group_data.get("top_habits", []):
                    habit_id = habit["id"]
                    cursor = await db.execute("SELECT metadata FROM habits WHERE id = ?", (habit_id,))
                    row = await cursor.fetchone()
                    existing_metadata: dict[str, Any] = {}
                    if row and row[0]:
                        try:
                            existing_metadata = json.loads(row[0]) if isinstance(row[0], str) else dict(row[0])
                        except (json.JSONDecodeError, TypeError, ValueError):
                            existing_metadata = {}

                    summary_metadata = {
                        **existing_metadata,
                        "frequency_score": habit["frequency_score"],
                        "trigger_group": trigger,
                        "last_summarized": summary["summarized_at"],
                    }
                    metadata_json = json.dumps(summary_metadata)
                    await db.execute(
                        "UPDATE habits SET metadata = ? WHERE id = ?",
                        (metadata_json, habit_id),
                    )
            await db.commit()
        except Exception as exc:
            logger.debug("Could not persist summary metadata: %s", exc)

    async def get_habit_summary(self) -> Optional[dict[str, Any]]:
        """Retrieve the most recent habit summary if available."""
        try:
            async with aiosqlite.connect(self.db_path) as db:
                cursor = await db.execute(
                    """
                    SELECT id, description, trigger, trigger_value, action, 
                           occurrences, occurrence_count, last_seen, metadata
                    FROM habits
                    WHERE COALESCE(occurrences, occurrence_count, 0) >= 2
                    ORDER BY COALESCE(occurrences, occurrence_count, 0) DESC
                    LIMIT 20
                    """
                )
                habits = await cursor.fetchall()
                habits = list(habits)

                if not habits:
                    cursor = await db.execute(
                        "SELECT payload FROM habit_summaries ORDER BY summarized_at DESC LIMIT 1"
                    )
                    row = await cursor.fetchone()
                    if row and row[0]:
                        return json.loads(row[0])
                    return None

                # Return lightweight summary
                groups: dict[str, int] = {}
                for habit in habits:
                    trigger = habit[2] or "unknown"
                    groups[trigger] = groups.get(trigger, 0) + 1

                return {
                    "total_habits": len(habits),
                    "trigger_groups": groups,
                    "last_updated": self.last_summary_time.isoformat()
                    if self.last_summary_time
                    else None,
                }
        except Exception as exc:
            logger.error("Failed to retrieve habit summary: %s", exc)
            return None
