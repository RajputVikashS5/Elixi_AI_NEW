"""ELIXI AI Engine – production-ready FastAPI entry point."""

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
import os
from dotenv import load_dotenv

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from core.config import load_settings, validate_settings, Settings
from core.errors import register_exception_handlers
from core.logging import configure_logging
from core.security import configure_security, require_auth
from middleware.request_logging import RequestLoggingMiddleware
from middleware.rate_limit import RateLimitMiddleware

# Prefer developer-local secrets, then shared defaults.
load_dotenv('.env.local', override=False)
load_dotenv()

settings: Settings = load_settings()
validate_settings(settings)
configure_security(settings)
configure_logging()

# Disable Chroma product telemetry to avoid noisy Posthog compatibility errors.
os.environ.setdefault("ANONYMIZED_TELEMETRY", "FALSE")
os.environ.setdefault("CHROMA_PRODUCT_TELEMETRY_IMPL", "chroma_telemetry.NullTelemetry")
os.environ.setdefault("CHROMA_TELEMETRY_IMPL", "chroma_telemetry.NullTelemetry")

from routers.auth_router import router as auth_router
from routers.chat_router import router as chat_router
from routers.memory_router import router as memory_router
from routers.emotion_router import router as emotion_router
from routers.task_router import router as task_router
from memory_engine.long_term_memory import init_database
from memory_engine.long_term_memory import LongTermMemory
from memory_engine.habit_summarizer import HabitSummarizer
from emotion_engine.camera_manager import get_camera_manager, shutdown_camera
from services.memory_retention_service import MemoryRetentionService

logger = logging.getLogger("elixi.ai")

# Global references for background jobs
scheduler: AsyncIOScheduler | None = None
habit_summarizer: HabitSummarizer | None = None
retention_service = MemoryRetentionService(settings=settings, memory=LongTermMemory())


def _env_bool(name: str, default: bool = False) -> bool:
    """Parse a boolean environment variable with sensible truthy values."""
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


async def _run_habit_summarization() -> None:
    """Background job to summarize habits periodically."""
    global habit_summarizer
    if habit_summarizer is None:
        habit_summarizer = HabitSummarizer()
    try:
        await habit_summarizer.summarize_habits()
    except Exception as exc:
        logger.error("Habit summarization job failed: %s", exc)


async def _run_memory_retention() -> None:
    try:
        await retention_service.enforce_global()
    except Exception as exc:
        logger.error("Memory retention job failed: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize resources on startup, clean up on shutdown."""
    global scheduler, habit_summarizer

    logger.info("%s starting up...", settings.app_name)
    await init_database()

    # Initialize camera manager (privacy-first). Auto-enable can be controlled by env flag.
    camera_manager = get_camera_manager(enabled=False)
    auto_enable_camera = _env_bool("ELIXI_CAMERA_AUTO_ENABLE", _env_bool("ELIXI_CAMERA_ENABLED", False))
    if auto_enable_camera:
        if camera_manager.enable():
            logger.info("Camera emotion detection auto-enabled via environment flag")
        else:
            logger.warning("Camera auto-enable requested but initialization failed")
    else:
        logger.info("Camera emotion detection available (disabled by default). Set ELIXI_CAMERA_AUTO_ENABLE=true to enable on startup")

    # Initialize habit summarizer and schedule periodic job
    habit_summarizer = HabitSummarizer()
    scheduler = AsyncIOScheduler()

    # Schedule habit summarization to run every 2 hours
    scheduler.add_job(
        _run_habit_summarization,
        "interval",
        hours=2,
        id="habit_summarization",
        name="Periodic Habit Summarization",
    )
    scheduler.add_job(
        _run_memory_retention,
        "interval",
        minutes=30,
        id="memory_retention",
        name="Periodic Memory Retention",
    )

    scheduler.start()
    # Prime summary metadata immediately so suggestions improve without waiting 2 hours.
    await _run_habit_summarization()
    await _run_memory_retention()
    logger.info("Habit summarization and memory retention jobs scheduled")
    logger.info("AI Engine ready on http://localhost:8000")

    yield

    # Cleanup on shutdown
    if scheduler and scheduler.running:
        scheduler.shutdown()
    
    # Shutdown camera resources
    shutdown_camera()
    
    logger.info("ELIXI AI Engine shutting down...")


app = FastAPI(
    title=settings.app_name,
    description="Local AI inference engine for ELIXI desktop assistant",
    version=settings.app_version,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url=None,
)

register_exception_handlers(app)
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(RateLimitMiddleware, settings=settings)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth_router, prefix="/auth", tags=["Auth"])
auth_deps = [Depends(require_auth)]
app.include_router(chat_router, prefix="/ai", tags=["Chat"], dependencies=auth_deps)
app.include_router(memory_router, prefix="/memory", tags=["Memory"], dependencies=auth_deps)
app.include_router(emotion_router, prefix="/ai", tags=["Emotion"], dependencies=auth_deps)
app.include_router(task_router, prefix="/tasks", tags=["Tasks"], dependencies=auth_deps)


@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint for load balancers and health monitors."""
    return {
        "status": "ok",
        "version": settings.app_version,
        "environment": settings.environment,
        "service": "elixi-ai-engine",
        "timestamp": __import__('datetime').datetime.utcnow().isoformat(),
    }
