"""Maps emotion state to response style hints."""


class ResponseModulator:
    _STYLE_HINTS = {
        "stressed": "Use calm, reassuring language and shorter sentences.",
        "fatigued": "Use very concise responses with clear steps.",
        "frustrated": "Acknowledge difficulty and provide direct actionable guidance.",
        "focused": "Be terse and technical.",
        "motivated": "Keep tone energetic and solution-oriented.",
        "neutral": "Balanced helpful tone.",
    }

    _EMPATHY_TEMPLATES = {
        "stressed": (
            "I hear this feels intense right now. "
            "Let us stabilize first with one small step, then continue."
        ),
        "fatigued": (
            "You seem low on energy, so I will keep this light. "
            "Here is the shortest path to move forward."
        ),
        "frustrated": (
            "That is frustrating, and you are not wrong to feel it. "
            "I will provide a direct fix path with minimal back-and-forth."
        ),
        "focused": (
            "You are in flow. "
            "I will stay compact and execution-oriented."
        ),
        "motivated": (
            "Great momentum. "
            "I will keep the pace high and actions concrete."
        ),
        "neutral": (
            "I will keep this clear and practical."
        ),
    }

    def style_hint(self, emotion_state: str) -> str:
        return self._STYLE_HINTS.get(emotion_state, self._STYLE_HINTS["neutral"])

    def empathy_template(self, emotion_state: str) -> str:
        return self._EMPATHY_TEMPLATES.get(emotion_state, self._EMPATHY_TEMPLATES["neutral"])

    def guidance_block(self, emotion_state: str, confidence: float | None = None) -> str:
        confidence_text = ""
        if confidence is not None:
            confidence_text = f"(emotion confidence: {max(0.0, min(confidence, 1.0)):.2f})"

        return (
            "Empathetic response guidance "
            f"{confidence_text}\n"
            f"- Tone: {self.style_hint(emotion_state)}\n"
            f"- Template seed: {self.empathy_template(emotion_state)}"
        ).strip()
