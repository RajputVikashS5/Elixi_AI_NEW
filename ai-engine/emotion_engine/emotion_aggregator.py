"""Combines emotion signals into one final state."""


class EmotionAggregator:
    def aggregate(self, signals: list[dict]) -> dict:
        if not signals:
            return {"state": "neutral", "confidence": 0.5, "signals": []}

        score: dict[str, float] = {}
        normalised_signals: list[dict] = []
        for signal in signals:
            state = signal.get("state", "neutral")
            confidence = float(signal.get("confidence", 0.0))
            weight = float(signal.get("weight", 1.0))
            if confidence <= 0:
                continue
            weighted = confidence * weight
            score[state] = score.get(state, 0.0) + weighted
            normalised_signals.append({**signal, "weighted_confidence": round(weighted, 4)})

        if not score:
            return {"state": "neutral", "confidence": 0.5, "signals": normalised_signals}

        state, dominant = max(score.items(), key=lambda item: item[1])
        total = sum(score.values()) or 1.0
        return {
            "state": state,
            "confidence": min(round(dominant / total, 4), 1.0),
            "signals": sorted(normalised_signals, key=lambda item: item["weighted_confidence"], reverse=True),
        }
