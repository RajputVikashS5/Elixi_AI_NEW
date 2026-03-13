"""Entity extractor – heuristic-based for Phase 1."""

import re
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Common application aliases
_APP_ALIASES: dict[str, str] = {
    "vs code": "code",
    "vscode": "code",
    "visual studio code": "code",
    "chrome": "chrome",
    "firefox": "firefox",
    "spotify": "Spotify",
    "terminal": "wt",
    "notepad": "notepad",
    "explorer": "explorer",
    "slack": "slack",
    "discord": "discord",
}

_APP_PATTERN = re.compile(
    r"\b(?:open|launch|start|run|close|quit|kill)\s+([a-zA-Z0-9 _\-\.]+)",
    re.IGNORECASE,
)
_FILE_PATH_PATTERN = re.compile(r"[A-Za-z]:\\[^\s\"\']+|/(?:[^/\s\"\']+/?)+")
_TIME_PATTERN = re.compile(
    r"\b(\d{1,2}:\d{2}(?:\s?[AP]M)?|\d{1,2}\s?(?:am|pm)|in\s\d+\s(?:minutes?|hours?))\b",
    re.IGNORECASE,
)


class EntityExtractor:
    def extract_app_name(self, text: str) -> Optional[str]:
        match = _APP_PATTERN.search(text)
        if match:
            raw = match.group(1).strip().lower()
            return _APP_ALIASES.get(raw, raw)
        return None

    def extract_file_path(self, text: str) -> Optional[str]:
        match = _FILE_PATH_PATTERN.search(text)
        return match.group(0) if match else None

    def extract_time(self, text: str) -> Optional[str]:
        match = _TIME_PATTERN.search(text)
        return match.group(0) if match else None

    def extract_all(self, text: str) -> dict:
        return {
            "app_name": self.extract_app_name(text),
            "file_path": self.extract_file_path(text),
            "time": self.extract_time(text),
        }
