"""Schémas Pydantic v2 — missions_ouvreurs + profiles_ouvreurs."""

from __future__ import annotations

import uuid
from datetime import datetime, time
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict


# ── Mission ouvreur ───────────────────────────────────────────────────────────

class MissionOuvreurBase(BaseModel):
    bien_id: uuid.UUID
    agence_id: Optional[uuid.UUID] = None
    ouvreur_id: Optional[uuid.UUID] = None
    type: Literal["visite", "edl_entree", "edl_sortie", "remise_cles", "expertise"]
    date_mission: Optional[str] = None  # YYYY-MM-DD
    creneau_debut: Optional[time] = None
    creneau_fin: Optional[time] = None
    nb_candidats: int = 0
    instructions: Optional[str] = None
    remuneration: Optional[Decimal] = None
    statut: Literal["proposee", "acceptee", "effectuee", "annulee"] = "proposee"
    rayon_km: int = 20


class MissionOuvreurCreate(MissionOuvreurBase):
    pass


class MissionOuvreurUpdate(BaseModel):
    ouvreur_id: Optional[uuid.UUID] = None
    date_mission: Optional[str] = None
    creneau_debut: Optional[time] = None
    creneau_fin: Optional[time] = None
    nb_candidats: Optional[int] = None
    instructions: Optional[str] = None
    remuneration: Optional[Decimal] = None
    statut: Optional[Literal["proposee", "acceptee", "effectuee", "annulee"]] = None


class MissionOuvreurRead(MissionOuvreurBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime


# ── Profile ouvreur ───────────────────────────────────────────────────────────

class ProfileOuvreurBase(BaseModel):
    rayon_km: int = 20
    jours_dispo: Optional[list[int]] = None
    heure_debut: Optional[time] = None
    heure_fin: Optional[time] = None
    types_missions: Optional[list[str]] = None
    vehicule: bool = False
    lat: Optional[float] = None
    lng: Optional[float] = None


class ProfileOuvreurCreate(ProfileOuvreurBase):
    user_id: uuid.UUID


class ProfileOuvreurUpdate(ProfileOuvreurBase):
    rayon_km: Optional[int] = None  # type: ignore[assignment]
    vehicule: Optional[bool] = None  # type: ignore[assignment]


class ProfileOuvreurRead(ProfileOuvreurBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    note_moyenne: float
    nb_missions: int
    created_at: datetime
