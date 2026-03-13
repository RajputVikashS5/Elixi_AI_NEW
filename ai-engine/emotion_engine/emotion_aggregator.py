"""Combines emotion signals into one final state."""


class EmotionAggregator:
    def aggregate(self, signals: list[dict]) -> dict:
        if not signals:
            return {"state": "neutral", "confidence": 0.5}

        # Weighted vote by confidence.
        score: dict[str, float] = {}
        for signal in signals:
            state = signal.get("state", "neutral")
            confidence = float(signal.get("confidence", 0.0))
            score[state] = score.get(state, 0.0) + confidence

        state, total = max(score.items(), key=lambda x: x[1])
        return {"state": state, "confidence": min(total / max(len(signals), 1), 1.0)}
