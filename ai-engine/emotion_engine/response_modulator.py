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

    _OPENING_PHRASES = {
        "stressed": [
            "I hear this feels intense right now.",
            "Let us take this one step at a time.",
        ],
        "fatigued": [
            "I will keep this light and easy to follow.",
            "Here is the shortest path forward.",
        ],
        "frustrated": [
            "That is frustrating, and your reaction makes sense.",
            "Let us solve this directly.",
        ],
        "focused": [
            "Understood. Staying concise.",
            "Direct execution path below.",
        ],
        "motivated": [
            "Great momentum. Let us use it.",
            "Fast path below.",
        ],
        "neutral": [
            "Got it.",
            "Here is the best next step.",
        ],
    }

    _FORMAT_RULES = {
        "stressed": "Keep to 2 short sentences max. Sentence 1 validates emotion. Sentence 2 gives one concrete next step.",
        "fatigued": "Use 1-2 very short sentences. Avoid optional branches. Provide only the easiest next action.",
        "frustrated": "Use 2 compact sentences. First acknowledges friction, second gives a direct fix path.",
        "focused": "Use terse, execution-first wording. Prefer compact bullet-style phrasing in one sentence.",
        "motivated": "Use energetic but concise wording with immediate action language.",
        "neutral": "Use clear, practical wording in 1-2 sentences.",
    }

    def style_hint(self, emotion_state: str) -> str:
        return self._STYLE_HINTS.get(emotion_state, self._STYLE_HINTS["neutral"])

    def empathy_template(self, emotion_state: str) -> str:
        return self._EMPATHY_TEMPLATES.get(emotion_state, self._EMPATHY_TEMPLATES["neutral"])

    def opening_phrases(self, emotion_state: str) -> list[str]:
        return self._OPENING_PHRASES.get(emotion_state, self._OPENING_PHRASES["neutral"])

    def format_rule(self, emotion_state: str) -> str:
        return self._FORMAT_RULES.get(emotion_state, self._FORMAT_RULES["neutral"])

    def response_contract(self, emotion_state: str) -> str:
        openings = " | ".join(self.opening_phrases(emotion_state))
        return (
            "Emotion Response Contract:\n"
            f"- Required opening style (pick one): {openings}\n"
            f"- Response formatting rule: {self.format_rule(emotion_state)}\n"
            "- Keep language natural and human, not clinical.\n"
            "- Avoid mentioning confidence scores, detectors, or internal analysis in response_text."
        )

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
