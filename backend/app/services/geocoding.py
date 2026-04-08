"""Service de géocodage — Nominatim OpenStreetMap + cache Redis 24h."""

from __future__ import annotations

import json
import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

_NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
_USER_AGENT = "Althy/1.0 (contact@althy.ch)"
_CACHE_TTL = 86_400  # 24 h


def _redis():
    """Lazy Redis client (sync)."""
    import redis as redis_lib  # type: ignore[import]
    return redis_lib.from_url(settings.REDIS_URL, socket_connect_timeout=1, decode_responses=True)


def _cache_key(query: str) -> str:
    return f"geocode:{query.lower().strip()}"


async def geocode(address: str, ville: str = "", cp: str = "") -> tuple[float, float] | None:
    """Return (lat, lng) for an address, or None if not found.

    Order of preference:
      1. Redis cache
      2. Nominatim API (async, httpx)
    Result is cached for 24 h.
    """
    q = ", ".join(part for part in [address, cp, ville, "Suisse"] if part)
    cache_key = _cache_key(q)

    # ── 1. Cache hit ──────────────────────────────────────────────────────────
    try:
        r = _redis()
        cached = r.get(cache_key)
        if cached:
            data = json.loads(cached)
            return float(data["lat"]), float(data["lng"])
    except Exception:
        pass  # Redis unavailable — proceed to API

    # ── 2. Nominatim ──────────────────────────────────────────────────────────
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                _NOMINATIM_URL,
                params={"q": q, "format": "json", "limit": 1, "addressdetails": 0},
                headers={"User-Agent": _USER_AGENT},
            )
            resp.raise_for_status()
            results = resp.json()
    except Exception as exc:
        logger.warning("Nominatim error for %r: %s", q, exc)
        return None

    if not results:
        return None

    lat = float(results[0]["lat"])
    lng = float(results[0]["lon"])

    # ── 3. Store in cache ─────────────────────────────────────────────────────
    try:
        r = _redis()
        r.setex(cache_key, _CACHE_TTL, json.dumps({"lat": lat, "lng": lng}))
    except Exception:
        pass

    return lat, lng
