"""Emotion detection endpoints."""

from fastapi import APIRouter

from models.schemas import EmotionRequest, EmotionResponse
from emotion_engine.typing_analyzer import TypingAnalyzer
from emotion_engine.voice_tone_analyzer import VoiceToneAnalyzer
from emotion_engine.time_behavior_analyzer import TimeBehaviorAnalyzer
from emotion_engine.webcam_analyzer import WebcamAnalyzer
from emotion_engine.emotion_aggregator import EmotionAggregator

router = APIRouter()

typing_analyzer = TypingAnalyzer()
voice_analyzer = VoiceToneAnalyzer()
time_analyzer = TimeBehaviorAnalyzer()
webcam_analyzer = WebcamAnalyzer()
aggregator = EmotionAggregator()


@router.post("/emotion", response_model=EmotionResponse)
async def detect_emotion(body: EmotionRequest) -> EmotionResponse:
    signals = [
        typing_analyzer.analyze(body.typing_wpm, body.errors, body.typing_pause_ms),
        voice_analyzer.analyze(body.voice_pitch, body.voice_energy, body.voice_speech_rate, body.voice_jitter),
        time_analyzer.analyze(body.time_of_day),
        webcam_analyzer.analyze(body.webcam_face_engagement, body.webcam_eye_strain),
    ]
    final = aggregator.aggregate(signals)
    return EmotionResponse(state=final["state"], confidence=final["confidence"], signals=final["signals"])
