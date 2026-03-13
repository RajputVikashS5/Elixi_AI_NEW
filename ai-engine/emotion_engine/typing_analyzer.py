"""Typing pattern analyzer."""


class TypingAnalyzer:
    def analyze(self, wpm: float | None = None, errors: int | None = None) -> dict:
        if wpm is None:
            return {"state": "neutral", "confidence": 0.5}
        if wpm < 20:
            return {"state": "fatigued", "confidence": 0.65}
        if errors is not None and errors > 10:
            return {"state": "frustrated", "confidence": 0.7}
        if wpm > 60:
            return {"state": "focused", "confidence": 0.75}
        return {"state": "neutral", "confidence": 0.6}
