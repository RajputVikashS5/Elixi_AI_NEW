"""Maps emotion state to response style hints."""


class ResponseModulator:
    def style_hint(self, emotion_state: str) -> str:
        mapping = {
            "stressed": "Use calm, reassuring language and shorter sentences.",
            "fatigued": "Use very concise responses with clear steps.",
            "frustrated": "Acknowledge difficulty and provide direct actionable guidance.",
            "focused": "Be terse and technical.",
            "motivated": "Keep tone energetic and solution-oriented.",
            "neutral": "Balanced helpful tone.",
        }
        return mapping.get(emotion_state, mapping["neutral"])
