"""Time-of-day behavior analyzer."""

from datetime import datetime


class TimeBehaviorAnalyzer:
    def analyze(self, time_of_day: str | None = None) -> dict:
        if time_of_day:
            hour = int(time_of_day.split(":")[0]) if ":" in time_of_day else None
        else:
            hour = datetime.now().hour

        if hour is None:
            return {"source": "time", "state": "neutral", "confidence": 0.0, "weight": 0.0}
        if 0 <= hour <= 5:
            return {"source": "time", "state": "fatigued", "confidence": 0.74, "weight": 0.75}
        if 6 <= hour <= 11:
            return {"source": "time", "state": "focused", "confidence": 0.58, "weight": 0.55}
        if 12 <= hour <= 18:
            return {"source": "time", "state": "motivated", "confidence": 0.55, "weight": 0.5}
        return {"source": "time", "state": "neutral", "confidence": 0.48, "weight": 0.45}
