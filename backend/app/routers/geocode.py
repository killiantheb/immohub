"""Router FastAPI — /api/v1/geocode.

Endpoints:
  POST /geocode          — géocode une adresse (auth requise)
  GET  /geocode/search   — proxy Nominatim avec cache Redis 24h (auth requise)
  GET  /geocode/reverse  — reverse geocoding lat/lng → adresse
"""

from __future__ import annotations

import json
from typing import Annotated

import httpx
from app.core.security import get_current_user
from app.models.user import User
from app.services.geocoding import geocode
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

router = APIRouter()

AuthDep = Annotated[User, Depends(get_current_user)]

_USER_AGENT = "Althy/1.0 (contact@althy.ch)"
_NOMINATIM = "https://nominatim.openstreetmap.org"
_CACHE_TTL = 86_400


def _redis():
    import redis as redis_lib  # type: ignore[import]
    from app.core.config import settings
    return redis_lib.from_url(settings.REDIS_URL, socket_connect_timeout=1, decode_responses=True)


class GeocodeRequest(BaseModel):
    adresse: str
    ville: str = ""
    cp: str = ""


class GeocodeResponse(BaseModel):
    lat: float
    lng: float
    query: str


@router.post("", response_model=GeocodeResponse)
async def geocode_address(
    payload: GeocodeRequest,
    current_user: AuthDep,
) -> GeocodeResponse:
    """Retourne les coordonnées WGS-84 pour une adresse suisse."""
    coords = await geocode(payload.adresse, payload.ville, payload.cp)
    if coords is None:
        raise HTTPException(status_code=404, detail="Adresse introuvable")

    q = ", ".join(p for p in [payload.adresse, payload.cp, payload.ville, "Suisse"] if p)
    return GeocodeResponse(lat=coords[0], lng=coords[1], query=q)


@router.get("/search")
async def nominatim_search(
    q: str = Query(..., min_length=3, max_length=200),
    limit: int = Query(6, ge=1, le=10),
    countrycodes: str = Query("ch,fr,de,at,it"),
    current_user: AuthDep = None,
) -> list[dict]:
    """Proxy Nominatim avec cache Redis 24h — respecte la fair-use policy OSM."""
    cache_key = f"nominatim:search:{q.lower().strip()}:{limit}:{countrycodes}"
    try:
        r = _redis()
        cached = r.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception:
        pass

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{_NOMINATIM}/search",
                params={"q": q, "format": "json", "addressdetails": 1, "limit": limit, "countrycodes": countrycodes},
                headers={"User-Agent": _USER_AGENT},
            )
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Nominatim unavailable: {exc}") from exc

    try:
        r = _redis()
        r.setex(cache_key, _CACHE_TTL, json.dumps(data))
    except Exception:
        pass

    return data


@router.get("/reverse")
async def nominatim_reverse(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    current_user: AuthDep = None,
) -> dict:
    """Reverse geocoding : lat/lng → adresse lisible."""
    cache_key = f"nominatim:reverse:{lat:.5f}:{lng:.5f}"
    try:
        r = _redis()
        cached = r.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception:
        pass

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{_NOMINATIM}/reverse",
                params={"lat": lat, "lon": lng, "format": "json", "addressdetails": 1},
                headers={"User-Agent": _USER_AGENT},
            )
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Nominatim unavailable: {exc}") from exc

    try:
        r = _redis()
        r.setex(cache_key, _CACHE_TTL, json.dumps(data))
    except Exception:
        pass

    return data
