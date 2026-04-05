"""Simple async-safe in-memory rate limiting middleware."""

from __future__ import annotations

import asyncio
import time
from collections import defaultdict
from collections.abc import Awaitable, Callable

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from starlette.types import ASGIApp

from core.config import Settings
from core.security import decode_access_token


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp, settings: Settings):
        super().__init__(app)
        self.settings = settings
        self._lock = asyncio.Lock()
        self._buckets: dict[str, tuple[float, int]] = defaultdict(lambda: (time.time(), 0))

    async def dispatch(self, request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        if request.url.path.startswith("/health") or request.url.path.startswith("/auth/token"):
            return await call_next(request)

        identity = self._resolve_identity(request)
        now = time.time()

        async with self._lock:
            window_started_at, count = self._buckets[identity]
            if now - window_started_at >= self.settings.rate_limit_window_seconds:
                window_started_at = now
                count = 0

            count += 1
            self._buckets[identity] = (window_started_at, count)

            if count > self.settings.rate_limit_requests:
                retry_after = max(1, int(self.settings.rate_limit_window_seconds - (now - window_started_at)))
                return JSONResponse(
                    status_code=429,
                    content={
                        "error": {
                            "code": "rate_limited",
                            "message": "Rate limit exceeded",
                            "retry_after_seconds": retry_after,
                            "request_id": getattr(request.state, "request_id", None),
                        }
                    },
                    headers={"Retry-After": str(retry_after)},
                )

        return await call_next(request)

    def _resolve_identity(self, request: Request) -> str:
        client_host = request.client.host if request.client else "unknown"
        auth = request.headers.get("authorization", "")
        if not auth.lower().startswith("bearer "):
            return f"ip:{client_host}"

        token = auth.split(" ", 1)[1].strip()
        if not token:
            return f"ip:{client_host}"

        try:
            user = decode_access_token(token, self.settings)
            return f"user:{user.sub}"
        except Exception:
            return f"ip:{client_host}"
