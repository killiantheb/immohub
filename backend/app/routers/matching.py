"""Router FastAPI — /api/v1/matching.

Retourne les profils ouvreurs ou artisans disponibles pour une mission/devis,
triés par pertinence (note, rayon, types de missions acceptées).
"""

from __future__ import annotations

import math
import uuid
from typing import Annotated

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.bien import Bien
from app.models.mission_ouvreur import ProfileOuvreur
from app.models.profile_artisan import ProfileArtisan
from app.models.user import User
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

DbDep = Annotated[AsyncSession, Depends(get_db)]
AuthDep = Annotated[User, Depends(get_current_user)]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Haversine distance in km between two WGS-84 points."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


# ── Response schemas ──────────────────────────────────────────────────────────

class MatchOuvreur(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    user_id: uuid.UUID
    note_moyenne: float
    nb_missions: int
    rayon_km: int
    types_missions: list[str] | None
    vehicule: bool
    jours_dispo: list[int] | None
    lat: float | None
    lng: float | None
    distance_km: float | None = None


class MatchArtisan(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    user_id: uuid.UUID
    note_moyenne: float
    nb_chantiers: int
    rayon_km: int
    specialites: list[str] | None
    assurance_rc: bool
    lat: float | None
    lng: float | None
    distance_km: float | None = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/ouvreurs", response_model=list[MatchOuvreur])
async def match_ouvreurs(
    current_user: AuthDep,
    db: DbDep,
    bien_id: uuid.UUID | None = Query(None),
    rayon_km: int = Query(50, ge=1, le=200),
    type_mission: str | None = Query(None),
    date: str | None = Query(None),
    vehicule: bool | None = Query(None),
) -> list[MatchOuvreur]:
    """Retourne les ouvreurs disponibles triés par note et distance."""
    # Fetch bien coordinates if provided
    bien_lat: float | None = None
    bien_lng: float | None = None
    if bien_id:
        res = await db.execute(select(Bien).where(Bien.id == bien_id))
        bien = res.scalar_one_or_none()
        # biens don't have lat/lng yet — geocoding integration TBD

    q = select(ProfileOuvreur)
    if vehicule:
        q = q.where(ProfileOuvreur.vehicule == True)  # noqa: E712
    rows = await db.execute(q)
    profiles = list(rows.scalars())

    results: list[MatchOuvreur] = []
    for p in profiles:
        dist: float | None = None
        if bien_lat and bien_lng and p.lat and p.lng:
            dist = round(_haversine_km(bien_lat, bien_lng, p.lat, p.lng), 1)
            if dist > rayon_km:
                continue

        # Filter by type_mission if profile has types set
        if type_mission and p.types_missions and type_mission not in p.types_missions:
            continue

        results.append(MatchOuvreur(
            id=p.id, user_id=p.user_id, note_moyenne=p.note_moyenne,
            nb_missions=p.nb_missions, rayon_km=p.rayon_km,
            types_missions=p.types_missions, vehicule=p.vehicule,
            jours_dispo=p.jours_dispo, lat=p.lat, lng=p.lng,
            distance_km=dist,
        ))

    results.sort(key=lambda x: (-x.note_moyenne, x.distance_km or 9999))
    return results[:50]


@router.get("/artisans", response_model=list[MatchArtisan])
async def match_artisans(
    current_user: AuthDep,
    db: DbDep,
    bien_id: uuid.UUID | None = Query(None),
    rayon_km: int = Query(50, ge=1, le=200),
    specialite: str | None = Query(None),
    assurance_rc: bool | None = Query(None),
) -> list[MatchArtisan]:
    """Retourne les artisans disponibles triés par note et distance."""
    bien_lat: float | None = None
    bien_lng: float | None = None
    if bien_id:
        res = await db.execute(select(Bien).where(Bien.id == bien_id))
        # geocoding integration TBD

    q = select(ProfileArtisan)
    if assurance_rc:
        q = q.where(ProfileArtisan.assurance_rc == True)  # noqa: E712
    rows = await db.execute(q)
    profiles = list(rows.scalars())

    results: list[MatchArtisan] = []
    for p in profiles:
        dist: float | None = None
        if bien_lat and bien_lng and p.lat and p.lng:
            dist = round(_haversine_km(bien_lat, bien_lng, p.lat, p.lng), 1)
            if dist > rayon_km:
                continue

        if specialite and p.specialites and specialite not in p.specialites:
            continue

        results.append(MatchArtisan(
            id=p.id, user_id=p.user_id, note_moyenne=p.note_moyenne,
            nb_chantiers=p.nb_chantiers, rayon_km=p.rayon_km,
            specialites=p.specialites, assurance_rc=p.assurance_rc,
            lat=p.lat, lng=p.lng, distance_km=dist,
        ))

    results.sort(key=lambda x: (-x.note_moyenne, x.distance_km or 9999))
    return results[:50]
