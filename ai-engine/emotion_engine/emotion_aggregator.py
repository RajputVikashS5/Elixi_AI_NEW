"""Combines emotion signals into one final state."""

from __future__ import annotations

from typing import Any


def _clamp(value: float, min_value: float, max_value: float) -> float:
    return max(min_value, min(max_value, value))


class EmotionAggregator:
    _DEFAULT_SOURCE_WEIGHTS: dict[str, float] = {
        "typing": 1.0,
        "voice": 1.0,
        "time": 0.7,
        "webcam": 0.8,
    }

    def __init__(
        self,
        source_weights: dict[str, float] | None = None,
        min_confidence: float = 0.0,
    ) -> None:
        self._source_weights = {**self._DEFAULT_SOURCE_WEIGHTS}
        self._min_confidence = _clamp(float(min_confidence), 0.0, 1.0)
        if source_weights:
            self.update_config(source_weights=source_weights)

    def get_config(self) -> dict[str, Any]:
        return {
            "source_weights": {**self._source_weights},
            "min_confidence": self._min_confidence,
        }

    def update_config(
        self,
        source_weights: dict[str, float] | None = None,
        min_confidence: float | None = None,
    ) -> dict[str, Any]:
        if source_weights:
            for source, weight in source_weights.items():
                if source not in self._source_weights:
                    continue
                self._source_weights[source] = _clamp(float(weight), 0.0, 3.0)

        if min_confidence is not None:
            self._min_confidence = _clamp(float(min_confidence), 0.0, 1.0)

        return self.get_config()

    def aggregate(self, signals: list[dict[str, Any]]) -> dict[str, Any]:
        if not signals:
            return {"state": "neutral", "confidence": 0.5, "signals": []}

        score: dict[str, float] = {}
        normalised_signals: list[dict[str, Any]] = []
        for signal in signals:
            source = str(signal.get("source", "unknown"))
            state = str(signal.get("state", "neutral"))
            confidence = _clamp(float(signal.get("confidence", 0.0)), 0.0, 1.0)
            base_weight = max(float(signal.get("weight", 1.0)), 0.0)
            source_weight = self._source_weights.get(source, 1.0)

            adjusted_confidence = confidence if confidence >= self._min_confidence else 0.0
            weighted = adjusted_confidence * base_weight * source_weight

            if weighted > 0:
                score[state] = score.get(state, 0.0) + weighted

            normalised_signals.append(
                {
                    **signal,
                    "source": source,
                    "state": state,
                    "adjusted_confidence": round(adjusted_confidence, 4),
                    "source_weight": round(source_weight, 4),
                    "weighted_confidence": round(weighted, 4),
                }
            )

        if not score:
            return {
                "state": "neutral",
                "confidence": 0.5,
                "signals": sorted(normalised_signals, key=lambda item: item["weighted_confidence"], reverse=True),
            }

        state, dominant = max(score.items(), key=lambda item: item[1])
        total = sum(score.values()) or 1.0
        return {
            "state": state,
            "confidence": min(round(dominant / total, 4), 1.0),
            "signals": sorted(normalised_signals, key=lambda item: item["weighted_confidence"], reverse=True),
        }
