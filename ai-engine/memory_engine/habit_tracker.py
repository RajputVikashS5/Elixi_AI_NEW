"""Persistent habit tracker for recurring assistant and automation patterns."""

from __future__ import annotations

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

    async def record_interaction(self, message: str, intent: str, entities: Optional[dict[str, Any]] = None) -> Optional[dict[str, Any]]:
        entities = entities or {}
        if not intent or not intent.startswith(("automation.", "task.")):
            return None

        description = self._build_description(intent, entities, message)
        action = self._build_action(intent, entities)
        metadata = {
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
            if int(habit.get("occurrences") or habit.get("occurrence_count") or 0) < 2:
                continue
            if not bool(habit.get("auto_suggest", 1)):
                continue

            score = 0.0
            if habit.get("trigger") == intent:
                score += 1.3

            trigger_value = str(habit.get("trigger_value") or "").lower()
            if trigger_value and trigger_value in message.lower():
                score += 1.2

            for entity_value in entities.values():
                if entity_value and str(entity_value).lower() == trigger_value:
                    score += 1.0

            description_terms = {term for term in str(habit.get("description") or "").lower().split() if len(term) > 2}
            score += 0.1 * len(message_terms & description_terms)

            action = habit.get("action") if isinstance(habit.get("action"), dict) else None
            if score > 0.8 and action:
                ranked.append(
                    {
                        "description": habit.get("description"),
                        "action": action,
                        "occurrences": habit.get("occurrences") or habit.get("occurrence_count") or 0,
                        "score": round(score, 3),
                    }
                )

        ranked.sort(key=lambda item: (item["score"], item["occurrences"]), reverse=True)
        return ranked[:limit]

    async def top_habits(self, limit: int = 10) -> list[dict[str, Any]]:
        return (await self.long_term.get_habits())[:limit]
