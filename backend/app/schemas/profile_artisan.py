"""Schémas Pydantic v2 — profiles_artisans."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class ProfileArtisanBase(BaseModel):
    # Identité
    raison_sociale: Optional[str] = None
    uid_ide: Optional[str] = None
    numero_tva: Optional[str] = None
    statut_juridique: Optional[str] = None   # independant/sarl/sa
    annees_experience: Optional[int] = None
    site_web: Optional[str] = None
    # Activité
    specialites: Optional[list[str]] = None
    rayon_km: int = 30
    assurance_rc: bool = False
    lat: Optional[float] = None
    lng: Optional[float] = None
    # Préférences charge
    montant_min_mission: Optional[float] = None
    urgences_acceptees: bool = False
    majoration_urgence_pct: int = 0
    chantiers_simultanees: int = 3
    # Paiement
    iban: Optional[str] = None
    delai_paiement_jours: int = 30
    billing_name: Optional[str] = None
    billing_adresse: Optional[str] = None
    virement_auto: bool = False
    facturation_auto: bool = False
    relance_auto: bool = False


class ProfileArtisanCreate(ProfileArtisanBase):
    user_id: uuid.UUID


class ProfileArtisanUpdate(BaseModel):
    raison_sociale: Optional[str] = None
    uid_ide: Optional[str] = None
    numero_tva: Optional[str] = None
    statut_juridique: Optional[str] = None
    annees_experience: Optional[int] = None
    site_web: Optional[str] = None
    specialites: Optional[list[str]] = None
    rayon_km: Optional[int] = None
    assurance_rc: Optional[bool] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    montant_min_mission: Optional[float] = None
    urgences_acceptees: Optional[bool] = None
    majoration_urgence_pct: Optional[int] = None
    chantiers_simultanees: Optional[int] = None
    iban: Optional[str] = None
    delai_paiement_jours: Optional[int] = None
    billing_name: Optional[str] = None
    billing_adresse: Optional[str] = None
    virement_auto: Optional[bool] = None
    facturation_auto: Optional[bool] = None
    relance_auto: Optional[bool] = None


class ProfileArtisanRead(ProfileArtisanBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    note_moyenne: float
    nb_chantiers: int
    created_at: datetime
