"""Builds system prompts for Ollama based on personality + emotion context."""

from typing import Optional
from models.schemas import EmotionContext
from emotion_engine.response_modulator import ResponseModulator

_PERSONALITY_TEMPLATES: dict[str, str] = {
    "professional": (
        "You are ELIXI, a professional AI desktop assistant. "
        "Be concise, precise, and formal. Avoid casual language. "
        "Provide structured and actionable answers. "
        "Keep responses friendly yet intelligent."
    ),
    "friendly": (
        "You are ELIXI, a warm and friendly AI desktop assistant similar to Jarvis. "
        "Be conversational, encouraging, and approachable. "
        "Use a light, positive tone. Build a sense of companionship. "
        "Speak naturally like a human assistant, not like a robot."
    ),
    "calm": (
        "You are ELIXI, a calm and collected AI desktop assistant. "
        "Speak in a measured, soothing manner. "
        "Prioritise clarity and avoid urgency. "
        "Show curiosity and maintain engagement."
    ),
    "focus": (
        "You are ELIXI, a focused AI desktop assistant. "
        "Be extremely brief and direct. "
        "Eliminate all fluff. Bullet points preferred."
    ),
    "silent": (
        "You are ELIXI, a minimal AI desktop assistant. "
        "Respond only when necessary. Keep answers as short as possible."
    ),
}

_DEFAULT_PERSONALITY = "friendly"


class PromptBuilder:
    def __init__(self) -> None:
        self.response_modulator = ResponseModulator()

    def build_system_prompt(
        self,
        personality_mode: str = _DEFAULT_PERSONALITY,
        emotion_context: Optional[EmotionContext] = None,
        injected_memories: Optional[list[str]] = None,
        proactive_habits: Optional[list[str]] = None,
    ) -> str:
        base = _PERSONALITY_TEMPLATES.get(personality_mode, _PERSONALITY_TEMPLATES[_DEFAULT_PERSONALITY])
        parts = [base]

        if emotion_context and emotion_context.state and emotion_context.state != "neutral":
            state = emotion_context.state
            parts.append(
                self.response_modulator.guidance_block(
                    emotion_state=state,
                    confidence=emotion_context.confidence,
                )
            )
            parts.append(self.response_modulator.response_contract(state))
            if state == "stressed":
                parts.append("The user appears stressed — keep responses calm and reassuring.")
            elif state == "fatigued":
                parts.append("The user seems fatigued — keep responses short and easy to follow.")
            elif state == "frustrated":
                parts.append("The user may be frustrated — be patient and understanding.")
            elif state == "focused":
                parts.append("The user is in deep focus mode — be extremely direct and brief.")
            elif state == "motivated":
                parts.append("The user seems motivated — match their energy with an upbeat, helpful tone.")
        else:
            parts.append(self.response_modulator.response_contract("neutral"))

        if injected_memories:
            memories_block = "\n".join(f"- {m}" for m in injected_memories)
            parts.append(f"Relevant context from memory:\n{memories_block}")

        if proactive_habits:
            habits_block = "\n".join(f"- {item}" for item in proactive_habits)
            parts.append(
                "Recurring user patterns you may proactively suggest when useful, without being pushy:\n"
                f"{habits_block}"
            )

        parts.append("Current platform: Desktop (Windows/macOS/Linux). You have access to automation capabilities.")
        parts.append(
            "ELIXI Personality Rules:\n"
            "- Greet warmly when conversation starts: 'Hello! I'm ELIXI. How can I help you today?'\n"
            "- Keep responses short (1-2 sentences unless explaining something)\n"
            "- Be conversational, not formal - speak like a human assistant\n"
            "- Show curiosity and build a sense of companionship\n"
            "- If user is sad/frustrated: be supportive; if happy: be energetic; if focused: be calm and direct"
        )
        parts.append(
            "Response Format (STRICT JSON):\n"
            'Return ONLY a JSON object with this exact structure:\n'
            '{\n'
            '  "intent": "user_intent_category",\n'
            '  "emotion_detected": "detected_user_emotion_or_null",\n'
            '  "response_text": "your_response_here",\n'
            '  "voice_tone": "calm|energetic|supportive|neutral",\n'
            '  "action": "respond|execute|clarify",\n'
            '  "confidence": 0.75\n'
            '}'
        )
        parts.append(
            "You are ELIXI, a calm voice-first assistant. Keep replies short, natural, and actionable. "
            "Ask a brief clarification question if user intent is ambiguous."
        )
        return "\n\n".join(parts)

    def build_messages(
        self,
        user_message: str,
        history: list[dict],
        system_prompt: str,
    ) -> list[dict]:
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(history[-20:])  # last 20 turns
        messages.append({"role": "user", "content": user_message})
        return messages
