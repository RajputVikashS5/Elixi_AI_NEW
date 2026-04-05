"""Strict AI response validation and normalization."""

from __future__ import annotations

from pydantic import BaseModel, Field


class StrictAIResponse(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    intent: str = Field(..., min_length=1, max_length=120)
    emotion: str = Field(default="neutral", min_length=1, max_length=120)



def validate_ai_response(parsed: dict, fallback_intent: str, fallback_emotion: str | None) -> StrictAIResponse:
    message = (
        str(parsed.get("response_text") or parsed.get("content") or "").strip()
    )
    intent = str(parsed.get("intent") or fallback_intent or "chat.general").strip() or "chat.general"
    emotion = str(parsed.get("emotion_detected") or fallback_emotion or "neutral").strip() or "neutral"

    return StrictAIResponse(message=message, intent=intent, emotion=emotion)
