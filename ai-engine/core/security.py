"""JWT authentication helpers and dependencies."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt  # type: ignore[import-not-found]
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from core.config import Settings


@dataclass(frozen=True)
class AuthUser:
    sub: str


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")
_settings: Settings | None = None
jwt_lib: Any = jwt


def configure_security(settings: Settings) -> None:
    global _settings
    _settings = settings


def get_security_settings() -> Settings:
    if _settings is None:
        raise RuntimeError("Security settings are not configured")
    return _settings


def create_access_token(subject: str, settings: Settings) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": subject,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.jwt_expire_minutes)).timestamp()),
    }
    encoded = jwt_lib.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    return str(encoded)


def decode_access_token(token: str, settings: Settings) -> AuthUser:
    try:
        payload: dict[str, Any] = dict(jwt_lib.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
        ) from exc

    subject = str(payload.get("sub", "")).strip()
    if not subject:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token is missing subject",
        )

    return AuthUser(sub=subject)


def require_auth(token: str = Depends(oauth2_scheme)) -> AuthUser:
    settings = get_security_settings()
    return decode_access_token(token, settings)


