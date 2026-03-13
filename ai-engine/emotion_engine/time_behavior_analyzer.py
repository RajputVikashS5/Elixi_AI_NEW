"""Time-of-day behavior analyzer."""

from datetime import datetime


class TimeBehaviorAnalyzer:
    def analyze(self, time_of_day: str | None = None) -> dict:
        if time_of_day:
            hour = int(time_of_day.split(":")[0]) if ":" in time_of_day else None
        else:
            hour = datetime.now().hour

        if hour is None:
            return {"state": "neutral", "confidence": 0.5}
        if 0 <= hour <= 5:
            return {"state": "fatigued", "confidence": 0.7}
        if 6 <= hour <= 11:
            return {"state": "focused", "confidence": 0.6}
        if 12 <= hour <= 18:
            return {"state": "motivated", "confidence": 0.58}
        return {"state": "neutral", "confidence": 0.55}
