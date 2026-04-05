"""Authentication router for issuing JWT access tokens."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from fastapi import Depends

from core.security import create_access_token, get_security_settings

router = APIRouter()


@router.post("/token")
async def issue_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
):
    settings = get_security_settings()

    if form_data.username != settings.auth_username or form_data.password != settings.auth_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    token = create_access_token(subject=form_data.username, settings=settings)
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": settings.jwt_expire_minutes * 60,
    }
