"""Wake-word detector using transcript phrase matching."""

import re


class WakeWordDetector:
    def __init__(self, phrases: list[str] | None = None) -> None:
        self.phrases = phrases or ["elixi", "hey elixi", "ok elixi"]
        self.running = False
        self.last_detected_phrase: str | None = None

    def start(self) -> dict:
        self.running = True
        return {"running": True, "status": "wake-word"}

    def stop(self) -> dict:
        self.running = False
        return {"running": False, "status": "idle"}

    def detect_text(self, transcript: str) -> dict:
        cleaned = transcript.strip()
        lowered = cleaned.lower()

        for phrase in self.phrases:
            if phrase in lowered:
                self.last_detected_phrase = phrase
                command = re.sub(re.escape(phrase), "", lowered, count=1).strip(" ,.!?-")
                return {
                    "detected": True,
                    "matchedPhrase": phrase,
                    "command": command,
                    "transcript": cleaned,
                }

        return {
            "detected": False,
            "matchedPhrase": None,
            "command": "",
            "transcript": cleaned,
        }
