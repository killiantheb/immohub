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
    # Marketplace M1 (migration 0036)
    canton: Optional[str] = None
    specialties: Optional[list[str]] = None


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
    # Marketplace M1
    canton: Optional[str] = None
    specialties: Optional[list[str]] = None


class ProfileArtisanRead(ProfileArtisanBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    note_moyenne: float
    nb_chantiers: int
    created_at: datetime
    subscription_plan: Optional[str] = None
    is_founding_member: bool = False
    stripe_connect_id: Optional[str] = None
    stripe_connect_ready: bool = False
    subscription_activated_at: Optional[datetime] = None


# ── Subscribe (marketplace M1) ───────────────────────────────────────────────

class ArtisanSubscribeRequest(BaseModel):
    """Requête de souscription marketplace — décide plan final (founding si dispo)."""
    canton: str
    specialties: list[str]
    # Si desired_plan = artisan_free_early mais le canton est plein → fallback verified.
    desired_plan: str = "artisan_free_early"


class ArtisanSubscribeResponse(BaseModel):
    assigned_plan: str               # artisan_free_early ou artisan_verified
    is_founding_member: bool
    founding_spots_remaining: int    # sur 50
    requires_stripe_kyc: bool
    requires_payment: bool           # false si fondateur, true sinon


class FoundingSpotRead(BaseModel):
    canton: str
    total_spots: int
    taken: int
    remaining: int
