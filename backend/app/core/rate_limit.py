"""Rate limiting — slowapi + Redis.

Limits:
- AI endpoints : 30 requests/day (standard) | 100/day (Pro)
- General API  : 200 requests/minute per user
- Public       : 20 requests/minute per IP
"""

from __future__ import annotations

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.core.config import settings


def _get_user_or_ip(request: Request) -> str:
    """Key function: use user_id from JWT if available, else IP."""
    # JWT sub is injected by auth middleware into request.state
    user_id = getattr(request.state, "user_id", None)
    if user_id:
        return str(user_id)
    return get_remote_address(request)


# Main limiter backed by Redis
limiter = Limiter(
    key_func=_get_user_or_ip,
    storage_uri=settings.REDIS_URL,
    default_limits=["200/minute"],
)


def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> Response:
    return JSONResponse(
        status_code=429,
        content={
            "detail": "Trop de requêtes. Veuillez réessayer plus tard.",
            "limit": str(exc.limit),
            "retry_after": exc.retry_after if hasattr(exc, "retry_after") else None,
        },
    )


# Re-export decorators for AI endpoints
AI_LIMIT_STANDARD = "30/day"
AI_LIMIT_PRO      = "100/day"
