"""Persistent habit tracker for recurring assistant and automation patterns."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import cast
from typing import Any, Optional

from memory_engine.long_term_memory import LongTermMemory


class HabitTracker:
    def __init__(self, long_term_memory: Optional[LongTermMemory] = None) -> None:
        self.long_term = long_term_memory or LongTermMemory()

    def _build_action(self, intent: str, entities: dict[str, Any]) -> Optional[dict[str, Any]]:
        app_name = entities.get("app_name")
        file_path = entities.get("file_path")

        if intent == "automation.open_app" and app_name:
            return {"type": "open_app", "target": app_name, "status": "pending"}
        if intent == "automation.close_app" and app_name:
            return {"type": "close_app", "target": app_name, "status": "pending"}
        if intent == "automation.file.create" and file_path:
            return {"type": "write_file", "target": file_path, "status": "pending"}
        if intent == "automation.file.search" and file_path:
            return {"type": "read_file", "target": file_path, "status": "pending"}
        return None

    def _build_description(self, intent: str, entities: dict[str, Any], message: str) -> str:
        app_name = entities.get("app_name")
        file_path = entities.get("file_path")

        if intent == "automation.open_app" and app_name:
            return f"Recurring app launch: open {app_name}"
        if intent == "automation.close_app" and app_name:
            return f"Recurring app close: close {app_name}"
        if intent == "automation.file.create" and file_path:
            return f"Recurring file creation around {file_path}"
        if intent == "automation.file.search" and file_path:
            return f"Recurring file lookup around {file_path}"
        return f"Recurring {intent} pattern: {message[:120].strip()}"

    def _build_trigger_value(self, intent: str, entities: dict[str, Any], message: str) -> str:
        for key in ("app_name", "file_path", "time"):
            if entities.get(key):
                return str(entities[key]).lower()
        return " ".join(message.lower().split()[:8])

    def _recency_bonus(self, last_seen: Any) -> float:
        if not isinstance(last_seen, str) or not last_seen:
            return 0.0
        try:
            parsed = datetime.fromisoformat(last_seen.replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            now = datetime.now(timezone.utc)
            days_ago = (now - parsed.astimezone(timezone.utc)).days
            # Full credit for <= 7 days, linear decay to day 30.
            if days_ago <= 7:
                return 0.5
            if days_ago <= 30:
                return round(0.5 * (1 - ((days_ago - 7) / 23)), 3)
            return 0.0
        except (TypeError, ValueError):
            return 0.0

    def _score_habit(
        self,
        habit: dict[str, Any],
        message: str,
        intent: str,
        entities: dict[str, Any],
        message_terms: set[str],
    ) -> dict[str, Any]:
        occurrences = int(cast(Any, habit.get("occurrences") or habit.get("occurrence_count") or 0))
        auto_suggest = bool(habit.get("auto_suggest", 1))

        raw_metadata = habit.get("metadata")
        metadata: dict[str, Any] = cast(dict[str, Any], raw_metadata) if isinstance(raw_metadata, dict) else {}
        summary_frequency = float(cast(Any, metadata.get("frequency_score", 0.0) or 0.0))

        trigger = str(cast(Any, habit.get("trigger") or ""))
        trigger_value = str(cast(Any, habit.get("trigger_value") or "")).lower()
        description = str(cast(Any, habit.get("description") or ""))
        description_terms = {term for term in description.lower().split() if len(term) > 2}
        description_overlap_count = len(message_terms & description_terms)

        trigger_match = 1.3 if trigger == intent else 0.0
        trigger_value_match = 1.2 if trigger_value and trigger_value in message.lower() else 0.0
        entity_match = 0.0
        for entity_value in entities.values():
            if entity_value and str(entity_value).lower() == trigger_value:
                entity_match = 1.0
                break

        description_overlap = 0.1 * description_overlap_count
        frequency = min(occurrences / 8.0, 1.0)
        recency = self._recency_bonus(cast(Any, habit.get("last_seen")))
        metadata_boost = min(summary_frequency, 1.0) * 0.7

        trigger_group = str(metadata.get("trigger_group", ""))
        pattern_group = 0.0
        if trigger_group and intent and trigger_group == intent:
            pattern_group = 0.4
        elif trigger_group and intent and intent.startswith(trigger_group.split(".")[0] + "."):
            pattern_group = 0.2

        score = (
            trigger_match
            + trigger_value_match
            + entity_match
            + description_overlap
            + frequency
            + recency
            + metadata_boost
            + pattern_group
        )

        raw_action = habit.get("action")
        action = cast(dict[str, Any], raw_action) if isinstance(raw_action, dict) else None

        return {
            "id": str(cast(Any, habit.get("id") or "")),
            "description": description,
            "action": action,
            "trigger": trigger,
            "trigger_value": trigger_value,
            "trigger_group": trigger_group or None,
            "occurrences": occurrences,
            "auto_suggest": auto_suggest,
            "score": round(score, 3),
            "components": {
                "trigger_match": round(trigger_match, 3),
                "trigger_value_match": round(trigger_value_match, 3),
                "entity_match": round(entity_match, 3),
                "description_overlap": round(description_overlap, 3),
                "frequency": round(frequency, 3),
                "recency": round(recency, 3),
                "metadata": round(metadata_boost, 3),
                "pattern_group": round(pattern_group, 3),
            },
            "metadata": metadata,
            "eligible": occurrences >= 2 and auto_suggest,
            "passes_threshold": score > 0.8,
        }

    async def record_interaction(self, message: str, intent: str, entities: Optional[dict[str, Any]] = None) -> Optional[dict[str, Any]]:
        entities = entities or {}
        if not intent or not intent.startswith(("automation.", "task.")):
            return None

        description = self._build_description(intent, entities, message)
        action = self._build_action(intent, entities)
        metadata: dict[str, Any] = {
            "intent": intent,
            "entities": entities,
            "message_preview": message[:200],
        }
        return await self.long_term.upsert_habit(
            description=description,
            trigger=intent,
            trigger_value=self._build_trigger_value(intent, entities, message),
            action=action,
            metadata=metadata,
        )

    async def suggest(self, message: str, intent: str, entities: Optional[dict[str, Any]] = None, limit: int = 3) -> list[dict[str, Any]]:
        entities = entities or {}
        habits = await self.long_term.get_habits()
        message_terms = {term for term in message.lower().split() if len(term) > 2}

        ranked: list[dict[str, Any]] = []
        for habit in habits:
            scored = self._score_habit(habit=habit, message=message, intent=intent, entities=entities, message_terms=message_terms)
            if not scored["eligible"]:
                continue
            action = scored.get("action")
            if scored["passes_threshold"] and isinstance(action, dict):
                ranked.append(
                    {
                        "description": scored["description"],
                        "action": action,
                        "occurrences": scored["occurrences"],
                        "trigger": scored["trigger"],
                        "trigger_group": scored["trigger_group"],
                        "frequency_score": round(float(scored["components"]["metadata"]) / 0.7 if scored["components"]["metadata"] else 0.0, 3),
                        "score": scored["score"],
                    }
                )

        ranked.sort(key=lambda item: (item["score"], item["occurrences"]), reverse=True)
        return ranked[:limit]

    async def top_habits(self, limit: int = 10) -> list[dict[str, Any]]:
        habits = await self.long_term.get_habits()
        return habits[:limit]

    async def score_diagnostics(
        self,
        message: str,
        intent: str,
        entities: Optional[dict[str, Any]] = None,
        limit: int = 20,
        include_ineligible: bool = False,
    ) -> dict[str, Any]:
        entities = entities or {}
        habits = await self.long_term.get_habits()
        message_terms = {term for term in message.lower().split() if len(term) > 2}

        diagnostics: list[dict[str, Any]] = []
        for habit in habits:
            scored = self._score_habit(habit=habit, message=message, intent=intent, entities=entities, message_terms=message_terms)
            if include_ineligible or scored["eligible"]:
                diagnostics.append(scored)

        diagnostics.sort(key=lambda item: (float(item["score"]), int(item["occurrences"])), reverse=True)
        return {
            "message": message,
            "intent": intent,
            "entities": entities,
            "limit": limit,
            "include_ineligible": include_ineligible,
            "results": diagnostics[:limit],
            "total": len(diagnostics),
        }
