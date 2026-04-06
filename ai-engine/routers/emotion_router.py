"""Emotion detection endpoints."""

import asyncio
import os

from fastapi import APIRouter

from models.schemas import EmotionRequest, EmotionResponse
from emotion_engine.typing_analyzer import TypingAnalyzer
from emotion_engine.voice_tone_analyzer import VoiceToneAnalyzer
from emotion_engine.time_behavior_analyzer import TimeBehaviorAnalyzer
from emotion_engine.webcam_analyzer import WebcamAnalyzer
from emotion_engine.emotion_aggregator import EmotionAggregator
from emotion_engine.camera_manager import get_camera_manager

router = APIRouter()


def _get_env_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return float(raw)
    except ValueError:
        return default

typing_analyzer = TypingAnalyzer()
voice_analyzer = VoiceToneAnalyzer()
time_analyzer = TimeBehaviorAnalyzer()
webcam_analyzer = WebcamAnalyzer()
aggregator = EmotionAggregator(
    source_weights={
        "typing": _get_env_float("ELIXI_EMOTION_WEIGHT_TYPING", 1.0),
        "voice": _get_env_float("ELIXI_EMOTION_WEIGHT_VOICE", 1.0),
        "time": _get_env_float("ELIXI_EMOTION_WEIGHT_TIME", 0.7),
        "webcam": _get_env_float("ELIXI_EMOTION_WEIGHT_WEBCAM", 0.8),
    },
    min_confidence=_get_env_float("ELIXI_EMOTION_MIN_CONFIDENCE", 0.0),
)
camera_manager = get_camera_manager(enabled=False)  # Disabled by default (privacy-first)


@router.post("/emotion", response_model=EmotionResponse)
async def detect_emotion(body: EmotionRequest) -> EmotionResponse:
    signals = await asyncio.gather(
        asyncio.to_thread(typing_analyzer.analyze, body.typing_wpm, body.errors, body.typing_pause_ms),
        asyncio.to_thread(voice_analyzer.analyze, body.voice_pitch, body.voice_energy, body.voice_speech_rate, body.voice_jitter),
        asyncio.to_thread(time_analyzer.analyze, body.time_of_day),
    )
    
    # Include camera data if available (from request body OR from live camera)
    if camera_manager.is_enabled():
        # Use live camera data
        camera_signal = camera_manager.get_emotion_signal()
        signals.append(camera_signal)
    else:
        # Use provided webcam metrics from request (if any)
        signals.append(
            await asyncio.to_thread(
                webcam_analyzer.analyze,
                body.webcam_face_engagement,
                body.webcam_eye_strain,
                body.webcam_facial_expression,
                body.webcam_expression_confidence,
                body.webcam_facial_cues,
            )
        )
    
    final = await asyncio.to_thread(aggregator.aggregate, signals)
    return EmotionResponse(state=final["state"], confidence=final["confidence"], signals=final["signals"])


@router.get("/emotion/config")
async def get_emotion_config() -> dict:
    """Get current emotion aggregation calibration settings."""
    return aggregator.get_config()


@router.post("/emotion/config")
async def update_emotion_config(payload: dict) -> dict:
    """Update emotion aggregation calibration settings."""
    source_weights = payload.get("source_weights") if isinstance(payload.get("source_weights"), dict) else None
    min_confidence = payload.get("min_confidence")
    updated = aggregator.update_config(
        source_weights=source_weights,
        min_confidence=min_confidence if isinstance(min_confidence, (int, float)) else None,
    )
    return updated


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
