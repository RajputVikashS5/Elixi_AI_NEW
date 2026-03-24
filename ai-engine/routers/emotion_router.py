"""Emotion detection endpoints."""

from fastapi import APIRouter

from models.schemas import EmotionRequest, EmotionResponse
from emotion_engine.typing_analyzer import TypingAnalyzer
from emotion_engine.voice_tone_analyzer import VoiceToneAnalyzer
from emotion_engine.time_behavior_analyzer import TimeBehaviorAnalyzer
from emotion_engine.webcam_analyzer import WebcamAnalyzer
from emotion_engine.emotion_aggregator import EmotionAggregator
from emotion_engine.camera_manager import get_camera_manager

router = APIRouter()

typing_analyzer = TypingAnalyzer()
voice_analyzer = VoiceToneAnalyzer()
time_analyzer = TimeBehaviorAnalyzer()
webcam_analyzer = WebcamAnalyzer()
aggregator = EmotionAggregator()
camera_manager = get_camera_manager(enabled=False)  # Disabled by default (privacy-first)


@router.post("/emotion", response_model=EmotionResponse)
async def detect_emotion(body: EmotionRequest) -> EmotionResponse:
    signals = [
        typing_analyzer.analyze(body.typing_wpm, body.errors, body.typing_pause_ms),
        voice_analyzer.analyze(body.voice_pitch, body.voice_energy, body.voice_speech_rate, body.voice_jitter),
        time_analyzer.analyze(body.time_of_day),
    ]
    
    # Include camera data if available (from request body OR from live camera)
    if camera_manager.is_enabled():
        # Use live camera data
        camera_signal = camera_manager.get_emotion_signal()
        signals.append(camera_signal)
    else:
        # Use provided webcam metrics from request (if any)
        signals.append(
            webcam_analyzer.analyze(body.webcam_face_engagement, body.webcam_eye_strain)
        )
    
    final = aggregator.aggregate(signals)
    return EmotionResponse(state=final["state"], confidence=final["confidence"], signals=final["signals"])


@router.post("/camera/enable")
async def enable_camera() -> dict:
    """Enable real-time camera emotion detection."""
    success = camera_manager.enable()
    status = camera_manager.get_status()
    return {
        "success": success,
        "enabled": camera_manager.is_enabled(),
        "status": status,
    }


@router.post("/camera/disable")
async def disable_camera() -> dict:
    """Disable real-time camera emotion detection."""
    camera_manager.disable()
    return {
        "enabled": camera_manager.is_enabled(),
        "status": camera_manager.get_status(),
    }


@router.get("/camera/status")
async def get_camera_status() -> dict:
    """Get current camera status and metrics."""
    status = camera_manager.get_status()
    signal = camera_manager.get_emotion_signal()
    return {
        "status": status,
        "emotion_signal": signal,
    }
