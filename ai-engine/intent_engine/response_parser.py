"""Parses raw LLM output and extracts structured actions."""

import json
import re
import logging
from typing import Optional, Any

logger = logging.getLogger(__name__)

_ACTION_PATTERN = re.compile(
    r"\[ACTION:(\w+)\s+([^\]]+)\]", re.IGNORECASE
)


class ResponseParser:
    def extract_actions(self, text: str) -> list[dict]:
        """Extract [ACTION:type arg] markers embedded in LLM output."""
        actions = []
        for match in _ACTION_PATTERN.finditer(text):
            actions.append({
                "type": match.group(1).lower(),
                "arg": match.group(2).strip(),
            })
        return actions

    def strip_action_markers(self, text: str) -> str:
        """Remove [ACTION:...] markers from the final response text."""
        return _ACTION_PATTERN.sub("", text).strip()

    def _extract_json_object(self, text: str) -> Optional[dict[str, Any]]:
        stripped = text.strip()
        if stripped.startswith("{") and stripped.endswith("}"):
            try:
                payload = json.loads(stripped)
                if isinstance(payload, dict):
                    return payload
            except json.JSONDecodeError:
                pass

        # Try to locate first JSON object in freeform text/code-fences.
        start = stripped.find("{")
        end = stripped.rfind("}")
        if start == -1 or end == -1 or end <= start:
            return None

        candidate = stripped[start:end + 1]
        try:
            payload = json.loads(candidate)
            if isinstance(payload, dict):
                return payload
        except json.JSONDecodeError:
            return None
        return None

    def parse(
        self,
        raw: str,
        fallback_intent: Optional[str] = None,
        fallback_entities: Optional[dict] = None,
        emotion_detected: Optional[str] = None,
    ) -> dict:
        actions = self.extract_actions(raw)
        clean_text = self.strip_action_markers(raw)

        parsed_json = self._extract_json_object(clean_text)
        if parsed_json:
            response = (
                str(parsed_json.get("response_text") or "").strip()
                or str(parsed_json.get("response") or "").strip()
                or clean_text
            )
            return {
                "content": response,
                "response": response,
                "response_text": response,
                "intent": str(parsed_json.get("intent") or fallback_intent or "chat.general"),
                "action": str(parsed_json.get("action") or "respond"),
                "entities": parsed_json.get("entities") if isinstance(parsed_json.get("entities"), dict) else (fallback_entities or {}),
                "confidence": float(parsed_json.get("confidence", 0.75)),
                "voice_tone": parsed_json.get("voice_tone"),
                "emotion_detected": parsed_json.get("emotion_detected") or emotion_detected,
                "actions": actions,
            }

        return {
            "content": clean_text,
            "response": clean_text,
            "response_text": clean_text,
            "intent": fallback_intent or "chat.general",
            "action": "respond",
            "entities": fallback_entities or {},
            "confidence": 0.7,
            "voice_tone": None,
            "emotion_detected": emotion_detected,
            "actions": actions,
        }
