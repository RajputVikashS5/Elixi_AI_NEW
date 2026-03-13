"""
ELIXI AI Engine – FastAPI entry point
Serves LLM inference, intent classification, emotion detection, and memory.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from routers.chat_router import router as chat_router
from routers.memory_router import router as memory_router
from routers.emotion_router import router as emotion_router
from routers.task_router import router as task_router
from memory_engine.long_term_memory import init_database

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("elixi.ai")

ALLOWED_ORIGINS = [
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://localhost:5173",
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize resources on startup, clean up on shutdown."""
    logger.info("ELIXI AI Engine starting up...")
    await init_database()
    logger.info("AI Engine ready on http://localhost:8000")
    yield
    logger.info("ELIXI AI Engine shutting down...")


app = FastAPI(
    title="ELIXI AI Engine",
    description="Local AI inference engine for ELIXI desktop assistant",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["*"],
)

# Register routers
app.include_router(chat_router, prefix="/ai", tags=["Chat"])
app.include_router(memory_router, prefix="/memory", tags=["Memory"])
app.include_router(emotion_router, prefix="/ai", tags=["Emotion"])
app.include_router(task_router, prefix="/tasks", tags=["Tasks"])


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "version": "1.0.0"}
