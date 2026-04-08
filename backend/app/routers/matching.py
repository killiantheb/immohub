"""Router FastAPI — /api/v1/matching.

Retourne les profils ouvreurs ou artisans disponibles pour une mission/devis,
filtrés par distance Haversine, jour, créneau et conflits d'agenda.
"""

from __future__ import annotations

import math
import uuid
from datetime import datetime
from typing import Annotated

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.bien import Bien
from app.models.mission_ouvreur import MissionOuvreur, ProfileOuvreur
from app.models.profile_artisan import ProfileArtisan
from app.models.user import User
from app.services.geocoding import geocode
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy import and_, select
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
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    )
    return R * 2 * math.asin(math.sqrt(a))


def _weekday_from_date(date_str: str) -> int | None:
    """Parse YYYY-MM-DD → weekday (0=Mon … 6=Sun). Returns None on error."""
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").weekday()
    except ValueError:
        return None


def _hhmm_to_minutes(hhmm: str) -> int | None:
    """'HH:MM' → total minutes since midnight. Returns None on error."""
    try:
        h, m = hhmm.split(":")
        return int(h) * 60 + int(m)
    except Exception:
        return None


# ── Response schemas ──────────────────────────────────────────────────────────

class MatchOuvreur(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    profile_id: uuid.UUID
    user_id: uuid.UUID
    nom: str
    prenom: str
    distance_km: float | None
    note_moyenne: float
    nb_missions: int
    vehicule: bool
    statut: str  # "disponible" | "indisponible"


class MatchArtisan(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    profile_id: uuid.UUID
    user_id: uuid.UUID
    nom: str
    prenom: str
    distance_km: float | None
    note_moyenne: float
    nb_chantiers: int
    assurance_rc: bool
    specialites: list[str] | None
    statut: str  # "disponible" | "indisponible"


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/ouvreurs", response_model=list[MatchOuvreur])
async def match_ouvreurs(
    current_user: AuthDep,
    db: DbDep,
    bien_id: uuid.UUID = Query(...),
    date: str = Query(..., description="YYYY-MM-DD"),
    creneau_debut: str = Query(..., description="HH:MM"),
    rayon_km: int = Query(50, ge=1, le=200),
    types_missions: list[str] = Query(default=[]),
    vehicule: bool | None = Query(None),
) -> list[MatchOuvreur]:
    """Ouvreurs disponibles triés par distance ASC, note DESC."""

    # ── 1. Géolocaliser le bien ───────────────────────────────────────────────
    res = await db.execute(select(Bien).where(Bien.id == bien_id))
    bien = res.scalar_one_or_none()
    if bien is None:
        raise HTTPException(status_code=404, detail="Bien introuvable")

    bien_lat: float | None = getattr(bien, "lat", None)
    bien_lng: float | None = getattr(bien, "lng", None)

    if bien_lat is None or bien_lng is None:
        coords = await geocode(bien.adresse, bien.ville, bien.cp)
        if coords:
            bien_lat, bien_lng = coords

    # ── 2. Jour de la semaine ─────────────────────────────────────────────────
    weekday = _weekday_from_date(date)
    debut_min = _hhmm_to_minutes(creneau_debut)

    # ── 3. Conflits acceptés pour cet ouvreur ce jour ─────────────────────────
    # (fetched later per ouvreur — pre-fetch all conflicting ouvreur_ids)
    conflict_res = await db.execute(
        select(MissionOuvreur.ouvreur_id).where(
            and_(
                MissionOuvreur.date_mission == date,
                MissionOuvreur.statut == "acceptee",
                MissionOuvreur.ouvreur_id.isnot(None),
            )
        )
    )
    conflicting_ids: set[uuid.UUID] = {row[0] for row in conflict_res.fetchall()}

    # ── 4. Charger les profils + users ────────────────────────────────────────
    q = select(ProfileOuvreur, User).join(User, User.id == ProfileOuvreur.user_id)
    if vehicule is True:
        q = q.where(ProfileOuvreur.vehicule.is_(True))
    rows = await db.execute(q)
    pairs = rows.fetchall()

    # ── 5. Filtrer et scorer ──────────────────────────────────────────────────
    results: list[MatchOuvreur] = []

    for profile, user in pairs:
        # Distance
        dist: float | None = None
        if bien_lat is not None and bien_lng is not None and profile.lat and profile.lng:
            dist = round(_haversine_km(bien_lat, bien_lng, profile.lat, profile.lng), 1)
            if dist > rayon_km:
                continue

        # Jour de la semaine
        if weekday is not None and profile.jours_dispo:
            if weekday not in profile.jours_dispo:
                continue

        # Créneau dans la plage dispo
        if debut_min is not None and profile.heure_debut and profile.heure_fin:
            p_debut = profile.heure_debut.hour * 60 + profile.heure_debut.minute
            p_fin = profile.heure_fin.hour * 60 + profile.heure_fin.minute
            if not (p_debut <= debut_min <= p_fin):
                continue

        # Types de missions
        if types_missions and profile.types_missions:
            if not set(types_missions).intersection(set(profile.types_missions)):
                continue

        # Conflit d'agenda
        statut = "indisponible" if profile.user_id in conflicting_ids else "disponible"

        nom = user.last_name or ""
        prenom = user.first_name or ""

        results.append(MatchOuvreur(
            profile_id=profile.id,
            user_id=profile.user_id,
            nom=nom,
            prenom=prenom,
            distance_km=dist,
            note_moyenne=profile.note_moyenne,
            nb_missions=profile.nb_missions,
            vehicule=profile.vehicule,
            statut=statut,
        ))

    # ── 6. Trier distance ASC, note DESC ──────────────────────────────────────
    results.sort(key=lambda x: (x.distance_km or 9999, -x.note_moyenne))
    return results[:50]


@router.get("/artisans", response_model=list[MatchArtisan])
async def match_artisans(
    current_user: AuthDep,
    db: DbDep,
    bien_id: uuid.UUID = Query(...),
    rayon_km: int = Query(50, ge=1, le=200),
    specialites: list[str] = Query(default=[]),
    assurance_rc: bool | None = Query(None),
) -> list[MatchArtisan]:
    """Artisans disponibles triés par distance ASC, note DESC."""

    # ── 1. Géolocaliser le bien ───────────────────────────────────────────────
    res = await db.execute(select(Bien).where(Bien.id == bien_id))
    bien = res.scalar_one_or_none()
    if bien is None:
        raise HTTPException(status_code=404, detail="Bien introuvable")

    bien_lat: float | None = getattr(bien, "lat", None)
    bien_lng: float | None = getattr(bien, "lng", None)

    if bien_lat is None or bien_lng is None:
        coords = await geocode(bien.adresse, bien.ville, bien.cp)
        if coords:
            bien_lat, bien_lng = coords

    # ── 2. Charger profils + users ────────────────────────────────────────────
    q = select(ProfileArtisan, User).join(User, User.id == ProfileArtisan.user_id)
    if assurance_rc is True:
        q = q.where(ProfileArtisan.assurance_rc.is_(True))
    rows = await db.execute(q)
    pairs = rows.fetchall()

    # ── 3. Filtrer et scorer ──────────────────────────────────────────────────
    results: list[MatchArtisan] = []

    for profile, user in pairs:
        # Distance
        dist: float | None = None
        if bien_lat is not None and bien_lng is not None and profile.lat and profile.lng:
            dist = round(_haversine_km(bien_lat, bien_lng, profile.lat, profile.lng), 1)
            if dist > rayon_km:
                continue

        # Spécialités
        if specialites and profile.specialites:
            if not set(specialites).intersection(set(profile.specialites)):
                continue

        nom = user.last_name or ""
        prenom = user.first_name or ""

        results.append(MatchArtisan(
            profile_id=profile.id,
            user_id=profile.user_id,
            nom=nom,
            prenom=prenom,
            distance_km=dist,
            note_moyenne=profile.note_moyenne,
            nb_chantiers=profile.nb_chantiers,
            assurance_rc=profile.assurance_rc,
            specialites=profile.specialites,
            statut="disponible",
        ))

    results.sort(key=lambda x: (x.distance_km or 9999, -x.note_moyenne))
    return results[:50]
