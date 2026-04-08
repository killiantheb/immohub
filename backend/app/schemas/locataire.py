"""Schémas Pydantic v2 — locataires + dossiers_locataires."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict


# ── Locataire ─────────────────────────────────────────────────────────────────

class LocataireBase(BaseModel):
    bien_id: uuid.UUID
    user_id: Optional[uuid.UUID] = None
    date_entree: Optional[date] = None
    date_sortie: Optional[date] = None
    loyer: Optional[Decimal] = None
    charges: Optional[Decimal] = None
    depot_garantie: Optional[Decimal] = None
    type_caution: Optional[Literal["cash", "compte_bloque", "organisme"]] = None
    banque_caution: Optional[str] = None
    iban_caution: Optional[str] = None
    statut: Literal["actif", "sorti"] = "actif"
    motif_depart: Optional[str] = None
    note_interne: Optional[str] = None


class LocataireCreate(LocataireBase):
    pass


class LocataireUpdate(BaseModel):
    date_entree: Optional[date] = None
    date_sortie: Optional[date] = None
    loyer: Optional[Decimal] = None
    charges: Optional[Decimal] = None
    depot_garantie: Optional[Decimal] = None
    type_caution: Optional[Literal["cash", "compte_bloque", "organisme"]] = None
    banque_caution: Optional[str] = None
    iban_caution: Optional[str] = None
    statut: Optional[Literal["actif", "sorti"]] = None
    motif_depart: Optional[str] = None
    note_interne: Optional[str] = None


class LocataireRead(LocataireBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime


# ── Dossier locataire ─────────────────────────────────────────────────────────

class DossierLocataireBase(BaseModel):
    locataire_id: uuid.UUID
    employeur: Optional[str] = None
    poste: Optional[str] = None
    type_contrat: Optional[Literal["cdi", "cdd", "independant", "retraite", "autre"]] = None
    salaire_net: Optional[Decimal] = None
    anciennete: Optional[int] = None
    assureur_rc: Optional[str] = None
    numero_police: Optional[str] = None
    validite_assurance: Optional[date] = None
    resultat_poursuites: Optional[str] = None
    date_poursuites: Optional[date] = None
    office_poursuites: Optional[str] = None


class DossierLocataireCreate(DossierLocataireBase):
    pass


class DossierLocataireUpdate(BaseModel):
    employeur: Optional[str] = None
    poste: Optional[str] = None
    type_contrat: Optional[Literal["cdi", "cdd", "independant", "retraite", "autre"]] = None
    salaire_net: Optional[Decimal] = None
    anciennete: Optional[int] = None
    assureur_rc: Optional[str] = None
    numero_police: Optional[str] = None
    validite_assurance: Optional[date] = None
    resultat_poursuites: Optional[str] = None
    date_poursuites: Optional[date] = None
    office_poursuites: Optional[str] = None


class DossierLocataireRead(DossierLocataireBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
