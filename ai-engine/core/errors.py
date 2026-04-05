"""Global exception handling with consistent JSON error responses."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


def _error_body(
    *,
    request: Request,
    code: str,
    message: str,
    details: object | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "error": {
            "code": code,
            "message": message,
            "request_id": getattr(request.state, "request_id", None),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    }
    if details is not None:
        payload["error"]["details"] = details
    return payload


async def validation_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    details = exc.errors() if isinstance(exc, RequestValidationError) else [{"msg": str(exc)}]
    return JSONResponse(
        status_code=422,
        content=_error_body(
            request=request,
            code="validation_error",
            message="Request validation failed",
            details=details,
        ),
    )


async def http_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    status_code = exc.status_code if isinstance(exc, HTTPException) else 500
    detail = str(exc.detail) if isinstance(exc, HTTPException) else str(exc)
    return JSONResponse(
        status_code=status_code,
        content=_error_body(
            request=request,
            code="http_error",
            message=detail,
        ),
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content=_error_body(
            request=request,
            code="internal_server_error",
            message="Unexpected server error",
            details=str(exc),
        ),
    )


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
