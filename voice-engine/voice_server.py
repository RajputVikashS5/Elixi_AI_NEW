"""Voice engine API and streaming bridge endpoints."""

import json
from collections import defaultdict

from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from stt_engine import STTEngine

app = FastAPI(title="ELIXI Voice Engine", version="0.2.0")

stt_engine = STTEngine()
session_connections: dict[str, set[WebSocket]] = defaultdict(set)


class TranscriptPayload(BaseModel):
    sessionId: str
    text: str
    final: bool = True


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
    }


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


@app.websocket("/voice/stream")
async def voice_stream(websocket: WebSocket, sessionId: str = Query(...)):
    await websocket.accept()
    session_connections[sessionId].add(websocket)

    await websocket.send_json({"type": "status", "sessionId": sessionId, "status": "listening"})

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
                    await websocket.send_json({"type": "status", "sessionId": sessionId, "status": "idle"})
                    break

                if payload_type == "transcript":
                    await websocket.send_json(
                        {
                            "type": "transcript",
                            "sessionId": sessionId,
                            "text": payload.get("text", ""),
                            "final": bool(payload.get("final", True)),
                        }
                    )
                    continue

            if bytes_data:
                transcript = stt_engine.transcribe(bytes_data)
                if transcript:
                    await websocket.send_json(
                        {
                            "type": "transcript",
                            "sessionId": sessionId,
                            "text": transcript,
                            "final": True,
                        }
                    )
    except WebSocketDisconnect:
        pass
    finally:
        sockets = session_connections.get(sessionId)
        if sockets:
            sockets.discard(websocket)
            if not sockets:
                session_connections.pop(sessionId, None)


@app.post("/stt")
async def speech_to_text():
    return {"transcript": "", "status": "stub"}


@app.post("/voice/tts")
@app.post("/tts")
async def text_to_speech():
    return {"audio": None, "status": "stub"}
