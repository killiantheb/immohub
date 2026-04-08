"""Router FastAPI — POST /api/v1/geocode.

Géocode une adresse via Nominatim avec cache Redis 24h.
"""

from __future__ import annotations

from typing import Annotated

from app.core.security import get_current_user
from app.models.user import User
from app.services.geocoding import geocode
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

router = APIRouter()

AuthDep = Annotated[User, Depends(get_current_user)]


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
