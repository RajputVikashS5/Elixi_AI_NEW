"""Typing pattern analyzer."""


class TypingAnalyzer:
    def analyze(
        self,
        wpm: float | None = None,
        errors: int | None = None,
        pause_ms: float | None = None,
    ) -> dict:
        if wpm is None:
            return {"source": "typing", "state": "neutral", "confidence": 0.0, "weight": 0.0}

        pause_ms = pause_ms or 0.0
        error_rate = (errors or 0) / max(wpm, 1)

        if error_rate > 0.12 or (errors or 0) >= 8:
            return {
                "source": "typing",
                "state": "frustrated",
                "confidence": 0.82,
                "weight": 1.2,
                "summary": "High correction rate while typing.",
            }
        if wpm < 22 or pause_ms > 1800:
            return {
                "source": "typing",
                "state": "fatigued",
                "confidence": 0.72,
                "weight": 1.0,
                "summary": "Typing pace is slow with longer pauses.",
            }
        if wpm >= 65 and error_rate < 0.05:
            return {
                "source": "typing",
                "state": "focused",
                "confidence": 0.8,
                "weight": 1.25,
                "summary": "Fast and consistent typing cadence.",
            }
        if 35 <= wpm <= 60 and error_rate < 0.06:
            return {
                "source": "typing",
                "state": "motivated",
                "confidence": 0.62,
                "weight": 0.8,
                "summary": "Steady typing pattern with few corrections.",
            }
        return {
            "source": "typing",
            "state": "neutral",
            "confidence": 0.45,
            "weight": 0.6,
            "summary": "Typing data is inconclusive.",
        }
