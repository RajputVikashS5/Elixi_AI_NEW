"""Voice tone analyzer stub for Phase 1."""


class VoiceToneAnalyzer:
    def analyze(self, pitch: float | None = None) -> dict:
        if pitch is None:
            return {"state": "neutral", "confidence": 0.5}
        if pitch > 260:
            return {"state": "stressed", "confidence": 0.6}
        if pitch < 120:
            return {"state": "neutral", "confidence": 0.55}
        return {"state": "neutral", "confidence": 0.55}
