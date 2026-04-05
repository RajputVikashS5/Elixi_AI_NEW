"""Voice engine API and streaming bridge endpoints."""

import asyncio
import base64
import io
import json
import wave
from collections import defaultdict

from fastapi import FastAPI, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from stt_engine import STTEngine
from tts_engine import TTSEngine, TTSSettings
from voice_activity_detector import VoiceActivityDetector
from wake_word_detector import WakeWordDetector

app = FastAPI(title="ELIXI Voice Engine", version="0.2.0")

stt_engine = STTEngine()
tts_engine = TTSEngine()
vad = VoiceActivityDetector()
wake_word_detector = WakeWordDetector()
session_connections: dict[str, set[WebSocket]] = defaultdict(set)
wake_word_detector.start()


class TranscriptPayload(BaseModel):
    sessionId: str
    text: str
    final: bool = True


class TTSRequest(BaseModel):
    text: str


class WakeWordPayload(BaseModel):
    active: bool


class VoiceSettingsPayload(BaseModel):
    rate: int | None = None        # WPM, 50–400
    volume: float | None = None    # 0.0–1.0
    voice_id: str | None = None    # SAPI voice ID or name substring


async def broadcast_to_session(session_id: str, payload: dict) -> int:
    sockets = session_connections.get(session_id, set())
    if not sockets:
        return 0

    stale_connections: list[WebSocket] = []
    for ws in sockets:
        try:
            await ws.send_json(payload)
        except Exception:
            stale_connections.append(ws)

    for ws in stale_connections:
        sockets.discard(ws)

    if not sockets:
        session_connections.pop(session_id, None)

    return len(sockets)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "voice-engine", "version": "0.2.0"}


@app.get("/voice/status")
async def voice_status():
    return {
        "status": "ok",
        "activeSessions": len(session_connections),
        "activeConnections": sum(len(sockets) for sockets in session_connections.values()),
        "wakeWordActive": wake_word_detector.running,
        "lastWakeWord": wake_word_detector.last_detected_phrase,
        "offline": {
            "stt": True,
            "tts": True,
            "vad": True,
            "wakeWord": True,
        },
    }


@app.post("/voice/wake-word")
async def set_wake_word(payload: WakeWordPayload):
    if payload.active:
        state = wake_word_detector.start()
    else:
        state = wake_word_detector.stop()
    return {"status": "ok", **state}


@app.post("/voice/transcript")
async def push_transcript(payload: TranscriptPayload):
    listeners = await broadcast_to_session(
        payload.sessionId,
        {
            "type": "transcript",
            "sessionId": payload.sessionId,
            "text": payload.text,
            "final": payload.final,
        },
    )
    return {
        "status": "ok",
        "listeners": listeners,
    }


def _process_transcript(session_id: str, transcript: str, final: bool) -> list[dict]:
    cleaned = transcript.strip()
    if not cleaned:
        return []

    if wake_word_detector.running:
        detection = wake_word_detector.detect_text(cleaned)
        if (not detection["detected"]) or (detection.get("confidence", 0.0) < wake_word_detector.min_confidence):
            return [{"type": "status", "sessionId": session_id, "status": "wake-word"}]

        events = [
            {
                "type": "wake-word",
                "sessionId": session_id,
                "matchedPhrase": detection["matchedPhrase"],
            }
        ]
        command = detection["command"]
        if command:
            events.append(
                {
                    "type": "transcript",
                    "sessionId": session_id,
                    "text": command,
                    "final": final,
                }
            )
        else:
            events.append({"type": "status", "sessionId": session_id, "status": "listening"})
        return events

    return [
        {
            "type": "transcript",
            "sessionId": session_id,
            "text": cleaned,
            "final": final,
        }
    ]


def _pcm_s16le_to_wav(audio_bytes: bytes, sample_rate: int, channels: int) -> bytes:
    if not audio_bytes:
        return b""

    rate = sample_rate if sample_rate > 0 else 16000
    ch = channels if channels > 0 else 1

    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav_file:
        wav_file.setnchannels(ch)
        wav_file.setsampwidth(2)
        wav_file.setframerate(rate)
        wav_file.writeframes(audio_bytes)
    return buffer.getvalue()


def _extract_audio_payload(payload: dict) -> bytes:
    audio_base64 = payload.get("audioBase64")
    if not isinstance(audio_base64, str) or not audio_base64:
        return b""

    try:
        audio_bytes = base64.b64decode(audio_base64)
    except (ValueError, TypeError):
        return b""

    if not audio_bytes:
        return b""

    fmt = str(payload.get("format") or "pcm_s16le").lower()
    sample_rate = int(payload.get("sampleRate") or 16000)
    channels = int(payload.get("channels") or 1)

    if fmt in {"wav", "audio/wav"}:
        return audio_bytes

    if fmt in {"pcm_s16le", "pcm"}:
        return _pcm_s16le_to_wav(audio_bytes, sample_rate, channels)

    return b""


@app.websocket("/voice/stream")
async def voice_stream(websocket: WebSocket, sessionId: str = Query(...)):
    await websocket.accept()
    session_connections[sessionId].add(websocket)
    last_status_sent: str | None = None

    async def send_status_if_changed(next_status: str) -> None:
        nonlocal last_status_sent
        if last_status_sent == next_status:
            return
        last_status_sent = next_status
        await websocket.send_json({"type": "status", "sessionId": sessionId, "status": next_status})

    await send_status_if_changed("wake-word" if wake_word_detector.running else "listening")

    try:
        while True:
            message = await websocket.receive()

            message_type = message.get("type")
            text_data = message.get("text")
            bytes_data = message.get("bytes")

            if message_type == "websocket.disconnect":
                break

            if text_data:
                try:
                    payload = json.loads(text_data)
                except json.JSONDecodeError:
                    payload = {"type": "transcript", "text": text_data, "final": True}

                payload_type = payload.get("type")
                if payload_type == "stop":
                    await send_status_if_changed("idle")
                    break

                if payload_type == "wake-word":
                    if bool(payload.get("active", True)):
                        wake_word_detector.start()
                        await send_status_if_changed("wake-word")
                    else:
                        wake_word_detector.stop()
                        await send_status_if_changed("listening")
                    continue

                if payload_type == "transcript":
                    for event in _process_transcript(
                        sessionId,
                        payload.get("text", ""),
                        bool(payload.get("final", True)),
                    ):
                        await websocket.send_json(event)
                    continue

                if payload_type == "audio":
                    normalized_audio = _extract_audio_payload(payload)
                    if not normalized_audio:
                        continue

                    analysis = await asyncio.to_thread(vad.analyze, normalized_audio)
                    if not analysis["speech_detected"]:
                        await send_status_if_changed("wake-word" if wake_word_detector.running else "listening")
                        continue

                    transcript = await asyncio.to_thread(stt_engine.transcribe, normalized_audio)
                    if transcript:
                        for event in _process_transcript(sessionId, transcript, True):
                            await websocket.send_json(event)
                    continue

            if bytes_data:
                analysis = await asyncio.to_thread(vad.analyze, bytes_data)
                if not analysis["speech_detected"]:
                    await send_status_if_changed("wake-word" if wake_word_detector.running else "listening")
                    continue

                transcript = await asyncio.to_thread(stt_engine.transcribe, bytes_data)
                if transcript:
                    for event in _process_transcript(sessionId, transcript, True):
                        await websocket.send_json(event)
    except WebSocketDisconnect:
        pass
    finally:
        sockets = session_connections.get(sessionId)
        if sockets:
            sockets.discard(websocket)
            if not sockets:
                session_connections.pop(sessionId, None)


@app.post("/stt")
async def speech_to_text(request: Request):
    audio_bytes = await request.body()
    transcript = await asyncio.to_thread(stt_engine.transcribe, audio_bytes)
    return {"transcript": transcript, "status": "ok" if transcript else "empty"}


@app.post("/voice/tts")
@app.post("/tts")
async def text_to_speech(payload: TTSRequest):
    audio = await asyncio.to_thread(tts_engine.synthesize, payload.text)
    if not audio:
        raise HTTPException(status_code=502, detail="Failed to synthesize audio")

    return {
        "audioBase64": base64.b64encode(audio).decode("ascii"),
        "mimeType": "audio/wav",
        "status": "ok",
    }


@app.get("/voice/settings")
async def get_voice_settings():
    s = tts_engine._settings
    return {
        "rate": s.rate,
        "volume": s.volume,
        "voice_id": s.voice_id,
        "status": "ok",
    }


@app.post("/voice/settings")
async def update_voice_settings(payload: VoiceSettingsPayload):
    current = tts_engine._settings
    new_settings = TTSSettings(
        rate=payload.rate if payload.rate is not None else current.rate,
        volume=payload.volume if payload.volume is not None else current.volume,
        voice_id=payload.voice_id if payload.voice_id is not None else current.voice_id,
    )
    tts_engine.apply_settings(new_settings)
    return {
        "rate": new_settings.rate,
        "volume": new_settings.volume,
        "voice_id": new_settings.voice_id,
        "status": "ok",
    }


@app.get("/voice/voices")
async def list_voices():
    voices = tts_engine.list_voices()
    return {"voices": voices, "count": len(voices), "status": "ok"}


@app.get("/voice/capabilities")
async def get_capabilities():
    caps = stt_engine.get_capabilities()
    return {
        "stt": caps,
        "tts": {
            "pyttsx3": tts_engine._pyttsx3_engine is not None,
            "windowsFallback": True,
        },
        "vad": {
            "webrtcvad": vad._vad is not None,
            "rmsFallback": True,
        },
        "status": "ok",
    }
