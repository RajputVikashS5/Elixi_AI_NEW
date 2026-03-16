"""Voice tone analyzer using simple acoustic heuristics."""


class VoiceToneAnalyzer:
    def analyze(
        self,
        pitch: float | None = None,
        energy: float | None = None,
        speech_rate: float | None = None,
        jitter: float | None = None,
    ) -> dict:
        if pitch is None and energy is None and speech_rate is None and jitter is None:
            return {"source": "voice", "state": "neutral", "confidence": 0.0, "weight": 0.0}

        pitch = pitch or 0.0
        energy = energy or 0.0
        speech_rate = speech_rate or 0.0
        jitter = jitter or 0.0

        if pitch > 240 and jitter > 0.08:
            return {
                "source": "voice",
                "state": "stressed",
                "confidence": 0.78,
                "weight": 1.1,
                "summary": "Elevated pitch with unstable tone.",
            }
        if energy < 0.2 and speech_rate < 110:
            return {
                "source": "voice",
                "state": "fatigued",
                "confidence": 0.7,
                "weight": 0.95,
                "summary": "Low-energy speech with slow delivery.",
            }
        if 140 <= pitch <= 220 and speech_rate >= 150 and jitter < 0.05:
            return {
                "source": "voice",
                "state": "focused",
                "confidence": 0.68,
                "weight": 0.95,
                "summary": "Stable, deliberate voice pattern.",
            }
        if energy >= 0.45 and 120 <= pitch <= 220:
            return {
                "source": "voice",
                "state": "motivated",
                "confidence": 0.6,
                "weight": 0.8,
                "summary": "Energetic speaking pattern.",
            }
        return {
            "source": "voice",
            "state": "neutral",
            "confidence": 0.42,
            "weight": 0.6,
            "summary": "Voice signal is present but non-distinct.",
        }
