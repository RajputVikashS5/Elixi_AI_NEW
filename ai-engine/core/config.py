"""Application configuration and startup environment validation."""

from __future__ import annotations

import os
from dataclasses import dataclass


def _split_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    app_name: str
    app_version: str
    environment: str
    jwt_secret_key: str
    jwt_algorithm: str
    jwt_expire_minutes: int
    auth_username: str
    auth_password: str
    allowed_origins: list[str]
    rate_limit_requests: int
    rate_limit_window_seconds: int
    memory_max_facts_per_user: int
    memory_ttl_days: int



def load_settings() -> Settings:
    allowed_origins_raw = os.getenv("ALLOWED_ORIGINS", "http://127.0.0.1:5173,http://localhost:5173")

    return Settings(
        app_name=os.getenv("APP_NAME", "ELIXI AI Engine"),
        app_version=os.getenv("APP_VERSION", "1.0.0"),
        environment=os.getenv("ENVIRONMENT", "development"),
        jwt_secret_key=os.getenv("JWT_SECRET_KEY", "").strip(),
        jwt_algorithm=os.getenv("JWT_ALGORITHM", "HS256").strip() or "HS256",
        jwt_expire_minutes=int(os.getenv("JWT_EXPIRE_MINUTES", "60")),
        auth_username=os.getenv("AUTH_USERNAME", "").strip(),
        auth_password=os.getenv("AUTH_PASSWORD", "").strip(),
        allowed_origins=_split_csv(allowed_origins_raw),
        rate_limit_requests=int(os.getenv("RATE_LIMIT_REQUESTS", "120")),
        rate_limit_window_seconds=int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60")),
        memory_max_facts_per_user=int(os.getenv("MEMORY_MAX_FACTS_PER_USER", "2000")),
        memory_ttl_days=int(os.getenv("MEMORY_TTL_DAYS", "30")),
    )


def validate_settings(settings: Settings) -> None:
    missing: list[str] = []

    if not settings.jwt_secret_key:
        missing.append("JWT_SECRET_KEY")
    if not settings.auth_username:
        missing.append("AUTH_USERNAME")
    if not settings.auth_password:
        missing.append("AUTH_PASSWORD")
    if not settings.allowed_origins:
        missing.append("ALLOWED_ORIGINS")

    if missing:
        raise RuntimeError(
            "Missing required environment variables: " + ", ".join(missing)
        )

    if settings.rate_limit_requests <= 0:
        raise RuntimeError("RATE_LIMIT_REQUESTS must be greater than 0")
    if settings.rate_limit_window_seconds <= 0:
        raise RuntimeError("RATE_LIMIT_WINDOW_SECONDS must be greater than 0")
    if settings.memory_max_facts_per_user <= 0:
        raise RuntimeError("MEMORY_MAX_FACTS_PER_USER must be greater than 0")
    if settings.memory_ttl_days <= 0:
        raise RuntimeError("MEMORY_TTL_DAYS must be greater than 0")
