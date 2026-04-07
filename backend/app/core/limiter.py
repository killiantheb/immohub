"""
Rate limiter — FastAPI Depends factory backed by Redis.
Avoids slowapi decorator incompatibility with `from __future__ import annotations`.
"""
from __future__ import annotations

import redis as redis_lib
from app.core.config import settings
from fastapi import Depends, HTTPException, Request


def rate_limit(max_calls: int, window_seconds: int = 60):
    """
    FastAPI dependency factory — rate limits by IP using Redis.

    Usage:
        @router.post("/login")
        async def login(payload: LoginRequest, _=rate_limit(10, 60)):
            ...
    """
    def _check(request: Request) -> None:
        try:
            r = redis_lib.from_url(settings.REDIS_URL, socket_connect_timeout=1, decode_responses=True)
            ip = request.client.host if request.client else "unknown"
            key = f"rl:{ip}:{request.url.path}"
            count = r.incr(key)
            if count == 1:
                r.expire(key, window_seconds)
            if count > max_calls:
                raise HTTPException(
                    status_code=429,
                    detail="Trop de requêtes. Réessayez dans un moment.",
                )
        except HTTPException:
            raise
        except Exception:
            pass  # Redis indisponible → on laisse passer (fail open)

    return Depends(_check)
