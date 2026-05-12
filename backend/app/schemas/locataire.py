"""Schémas Pydantic v2 — locataires + dossiers_locataires."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict

# ── Locataire ─────────────────────────────────────────────────────────────────

class LocataireBase(BaseModel):
    bien_id: uuid.UUID
    user_id: uuid.UUID | None = None
    date_entree: date | None = None
    date_sortie: date | None = None
    loyer: Decimal | None = None
    charges: Decimal | None = None
    depot_garantie: Decimal | None = None
    type_caution: Literal["cash", "compte_bloque", "organisme"] | None = None
    banque_caution: str | None = None
    iban_caution: str | None = None
    statut: Literal["actif", "sorti"] = "actif"
    motif_depart: str | None = None
    note_interne: str | None = None


class LocataireCreate(LocataireBase):
    pass


class LocataireUpdate(BaseModel):
    date_entree: date | None = None
    date_sortie: date | None = None
    loyer: Decimal | None = None
    charges: Decimal | None = None
    depot_garantie: Decimal | None = None
    type_caution: Literal["cash", "compte_bloque", "organisme"] | None = None
    banque_caution: str | None = None
    iban_caution: str | None = None
    statut: Literal["actif", "sorti"] | None = None
    motif_depart: str | None = None
    note_interne: str | None = None


class LocataireRead(LocataireBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime


# ── Dossier locataire ─────────────────────────────────────────────────────────

class DossierLocataireBase(BaseModel):
    locataire_id: uuid.UUID
    employeur: str | None = None
    poste: str | None = None
    type_contrat: Literal["cdi", "cdd", "independant", "retraite", "autre"] | None = None
    salaire_net: Decimal | None = None
    anciennete: int | None = None
    assureur_rc: str | None = None
    numero_police: str | None = None
    validite_assurance: date | None = None
    resultat_poursuites: str | None = None
    date_poursuites: date | None = None
    office_poursuites: str | None = None


class DossierLocataireCreate(DossierLocataireBase):
    pass


class DossierLocataireUpdate(BaseModel):
    employeur: str | None = None
    poste: str | None = None
    type_contrat: Literal["cdi", "cdd", "independant", "retraite", "autre"] | None = None
    salaire_net: Decimal | None = None
    anciennete: int | None = None
    assureur_rc: str | None = None
    numero_police: str | None = None
    validite_assurance: date | None = None
    resultat_poursuites: str | None = None
    date_poursuites: date | None = None
    office_poursuites: str | None = None


class DossierLocataireRead(DossierLocataireBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
