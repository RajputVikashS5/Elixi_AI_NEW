"""Emotion detection endpoints."""

from fastapi import APIRouter

from models.schemas import EmotionRequest, EmotionResponse
from emotion_engine.typing_analyzer import TypingAnalyzer
from emotion_engine.voice_tone_analyzer import VoiceToneAnalyzer
from emotion_engine.time_behavior_analyzer import TimeBehaviorAnalyzer
from emotion_engine.emotion_aggregator import EmotionAggregator

router = APIRouter()

typing_analyzer = TypingAnalyzer()
voice_analyzer = VoiceToneAnalyzer()
time_analyzer = TimeBehaviorAnalyzer()
aggregator = EmotionAggregator()


@router.post("/emotion", response_model=EmotionResponse)
async def detect_emotion(body: EmotionRequest) -> EmotionResponse:
    signals = [
        typing_analyzer.analyze(body.typing_wpm, body.errors),
        voice_analyzer.analyze(body.voice_pitch),
        time_analyzer.analyze(body.time_of_day),
    ]
    final = aggregator.aggregate(signals)
    return EmotionResponse(state=final["state"], confidence=final["confidence"])
