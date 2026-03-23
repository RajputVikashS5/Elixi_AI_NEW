"""Lightweight intent classifier using keyword heuristics (Phase 1)."""

import re
import logging
from models.enums import IntentCategory

logger = logging.getLogger(__name__)

# Keyword → intent mapping (first match wins; order matters)
_RULES: list[tuple[list[str], IntentCategory]] = [
    (["order pizza", "order food", "get me something to eat", "order groceries"], IntentCategory.ORDER_FOOD),
    (["track my order", "where is my order", "order status"], IntentCategory.TRACK_ORDER),
    (["weather", "temperature", "forecast"], IntentCategory.GET_WEATHER),
    (["cancel it", "cancel that", "never mind"], IntentCategory.ACTION_CANCEL),
    (["same again", "order same again", "do that again", "repeat that"], IntentCategory.ACTION_REPEAT),
    (["open ", "launch ", "start ", "run "], IntentCategory.AUTOMATION_OPEN_APP),
    (["close ", "kill ", "quit "], IntentCategory.AUTOMATION_CLOSE_APP),
    (["create file", "new file", "make file"], IntentCategory.AUTOMATION_FILE_CREATE),
    (["find file", "search file", "where is"], IntentCategory.AUTOMATION_FILE_SEARCH),
    (["workflow", "automate", "macro"], IntentCategory.AUTOMATION_WORKFLOW),
    (["cpu", "ram", "memory usage", "disk", "system info", "uptime"], IntentCategory.AUTOMATION_SYSTEM_INFO),
    (["remember", "save this", "note that", "store"], IntentCategory.MEMORY_STORE),
    (["recall", "what did i say", "do you remember"], IntentCategory.MEMORY_RECALL),
    (["remind me", "schedule", "at "], IntentCategory.TASK_SCHEDULE),
    (["hello", "hi ", "hey ", "good morning", "good evening"], IntentCategory.CHAT_GREETING),
    (["what is", "what are", "how do", "explain", "tell me about", "?"], IntentCategory.CHAT_QUESTION),
]


class IntentClassifier:
    def classify(self, text: str) -> IntentCategory:
        lowered = text.lower()
        for keywords, intent in _RULES:
            if any(kw in lowered for kw in keywords):
                logger.debug("Intent '%s' matched for: %.60s", intent, text)
                return intent
        return IntentCategory.CHAT_GENERAL

    def confidence_for(self, text: str, intent: IntentCategory) -> float:
        lowered = text.lower()
        # Higher confidence for explicit command style utterances.
        if intent in {
            IntentCategory.ORDER_FOOD,
            IntentCategory.TRACK_ORDER,
            IntentCategory.GET_WEATHER,
            IntentCategory.AUTOMATION_OPEN_APP,
            IntentCategory.AUTOMATION_CLOSE_APP,
        }:
            return 0.9
        if intent in {IntentCategory.ACTION_CANCEL, IntentCategory.ACTION_REPEAT}:
            return 0.8
        if "?" in lowered or lowered.startswith(("what", "how", "why", "when")):
            return 0.78
        if intent == IntentCategory.CHAT_GENERAL:
            return 0.65
        return 0.75
