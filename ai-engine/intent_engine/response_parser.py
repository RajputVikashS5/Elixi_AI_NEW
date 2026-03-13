"""Parses raw LLM output and extracts structured actions."""

import re
import logging
from typing import Optional

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

    def parse(self, raw: str) -> dict:
        actions = self.extract_actions(raw)
        clean_text = self.strip_action_markers(raw)
        return {
            "content": clean_text,
            "actions": actions,
        }
