"""Wake-word detector using transcript phrase matching."""

import re


class WakeWordDetector:
    def __init__(self, phrases: list[str] | None = None) -> None:
        self.phrases = phrases or ["hey elixi"]
        self.running = True
        self.last_detected_phrase: str | None = None
        self.min_confidence = 0.72

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
            phrase_index = lowered.find(phrase)
            if phrase_index >= 0:
                self.last_detected_phrase = phrase
                # Prefer wake-word at the beginning; keep support for mid-sentence usage.
                confidence = 0.95 if phrase_index == 0 else 0.76
                command = re.sub(re.escape(phrase), "", cleaned, count=1, flags=re.IGNORECASE).strip(" ,.!?-")
                return {
                    "detected": True,
                    "matchedPhrase": phrase,
                    "command": command,
                    "confidence": confidence,
                    "transcript": cleaned,
                }

        return {
            "detected": False,
            "matchedPhrase": None,
            "command": "",
            "confidence": 0.0,
            "transcript": cleaned,
        }
