"""Schémas Pydantic v2 — locataires + dossiers_locataires + cosignataires."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationInfo, field_validator


# ── Cosignataires (Sprint 1A.5 — couple/famille sans refacto multi-comptes) ──


class CosignataireBase(BaseModel):
    """Un cosignataire d'un bail.

    Sémantique Phase 1.0 :
      - `conjoint` : adulte qui cosigne le bail (signature_requise = True par défaut)
      - `enfant`   : occupant déclaré, pas de signature (signature_requise forcé False)
      - `autre`    : tiers cosignataire ou occupant (parent, ami, etc. — choix par
                     défaut signature_requise = True)

    Validation stricte (§B.10) :
      - prenom / nom : non vides (min 1 char après trim)
      - lien_filial optionnel (utile pour clarifier « fils », « belle-fille », etc.)
      - signature_requise forcé False si type == 'enfant' (cf field_validator)
    """

    model_config = ConfigDict(extra="forbid")

    type: Literal["conjoint", "enfant", "autre"]
    prenom: str = Field(min_length=1, max_length=100)
    nom: str = Field(min_length=1, max_length=100)
    date_naissance: date | None = None
    signature_requise: bool = True
    lien_filial: str | None = Field(default=None, max_length=50)

    @field_validator("prenom", "nom", "lien_filial")
    @classmethod
    def _strip_whitespace(cls, v: str | None) -> str | None:
        if v is None:
            return None
        trimmed = v.strip()
        return trimmed if trimmed else None

    @field_validator("signature_requise", mode="after")
    @classmethod
    def _force_false_for_enfant(cls, v: bool, info: ValidationInfo) -> bool:
        """Si type == 'enfant', signature_requise est toujours False
        (les enfants n'ont pas la capacité juridique de cosigner un bail CH)."""
        if info.data.get("type") == "enfant":
            return False
        return v


class UpdateCosignatairesRequest(BaseModel):
    """Body PATCH /locataires/{id}/cosignataires — remplace l'array complet.

    Max 20 entrées (limite arbitraire Phase 1.0 — la majorité des familles
    Sunimmo aura 0 à 5 cosignataires).
    """

    model_config = ConfigDict(extra="forbid")

    cosignataires: list[CosignataireBase] = Field(default_factory=list, max_length=20)


# ── UserMini (Sprint 6 K1) ────────────────────────────────────────────────────


class UserMini(BaseModel):
    """Sous-set minimal de User exposé dans LocataireRead.

    Sprint 6 K1 (2026-05-13) : permet d'afficher prénom + nom + email + tel
    côté UI bailleur au lieu d'un hash UUID. Tous les champs sont nullable
    (un User locataire fraîchement créé via /invite peut avoir first_name/
    last_name vides tant qu'il n'a pas complété son profil).
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None


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
    # Cosignataires (Sprint 1A.5) — array JSONB, vide par défaut.
    cosignataires: list[CosignataireBase] = Field(default_factory=list)
    # Sprint 6 K1 — user lié au locataire (nom + email + tel pour UI).
    # `None` si le locataire n'est pas encore lié à un compte (invitation
    # pas encore consommée, drift DB) ou si la relation n'a pas été chargée.
    user: UserMini | None = None


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
