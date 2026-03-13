"""Voice engine API scaffold for Phase 1."""

from fastapi import FastAPI

app = FastAPI(title="ELIXI Voice Engine", version="0.1.0")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "voice-engine"}


@app.post("/stt")
async def speech_to_text():
    return {"transcript": "", "status": "stub"}


@app.post("/tts")
async def text_to_speech():
    return {"audio": None, "status": "stub"}
