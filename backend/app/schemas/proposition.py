"""Schémas Pydantic v2 — Module Proposition de dates locataire (Sprint 4B).

Workflow back-and-forth bailleur ↔ locataire plafonné à 4 tours (cf
migration 0046 + proposition_service.py).

États possibles (cf CHECK constraint ck_dossiers_statut_proposition) :
  non_propose                    — état initial, locataire n'a rien envoyé
  propose_par_locataire          — locataire a proposé, bailleur doit répondre
  contre_propose_par_bailleur    — bailleur a contre-proposé, locataire répond
  accepte                        — accord conclu, date_accord fixée
  refuse                         — refus définitif, peut être reset par locataire

Doctrine §B.10 : pas de faux statut. Les CHECK constraints DB + Literal
Python double-verrouillent. Les requests ne tolèrent pas de champ optionnel
ambigu (les commentaires sont strictement bornés à 500 chars).
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

# ── Types Literal (source unique côté Pydantic) ──────────────────────────────

DureeEnvisagee = Literal["court", "moyen", "long", "indetermine"]
StatutProposition = Literal[
    "non_propose",
    "propose_par_locataire",
    "contre_propose_par_bailleur",
    "accepte",
    "refuse",
]
LastProposedBy = Literal["locataire", "bailleur"]

# Préférences locataire (4 axes, structurés en JSONB côté DB).
AnimauxPreference = Literal["oui", "non", "sous_conditions"]
FlexibiliteDate = Literal["rigide", "plus_moins_1_semaine", "plus_moins_1_mois"]
MeublePreference = Literal["meuble", "non_meuble", "indifferent"]


# ── Preferences ───────────────────────────────────────────────────────────────


class PreferencesLocataire(BaseModel):
    """Préférences structurées (persistées en JSONB sur dossiers_locataires)."""

    animaux: AnimauxPreference | None = None
    flexibilite_date: FlexibiliteDate | None = None
    colocation: bool | None = None
    meuble: MeublePreference | None = None


# ── Requests ──────────────────────────────────────────────────────────────────


class ProposerDatesRequest(BaseModel):
    """Body POST /locataires/{id}/proposition/proposer (locataire — état initial).

    Date d'entrée souhaitée OBLIGATOIRE — c'est le pivot du workflow. La durée
    et les préférences sont optionnelles mais fortement recommandées (UI les
    affiche en pré-remplissage côté bailleur).
    """

    date_entree_souhaitee: date
    duree_envisagee: DureeEnvisagee | None = None
    preferences: PreferencesLocataire = Field(default_factory=PreferencesLocataire)
    commentaire: str | None = Field(None, max_length=500)

    @field_validator("commentaire")
    @classmethod
    def _trim_or_none(cls, v: str | None) -> str | None:
        if v is None:
            return None
        trimmed = v.strip()
        return trimmed or None


class ContrePropositionBailleurRequest(BaseModel):
    """Body POST /locataires/{id}/proposition/contre-proposer (bailleur)."""

    date_contre_proposee: date
    commentaire: str | None = Field(None, max_length=500)

    @field_validator("commentaire")
    @classmethod
    def _trim_or_none(cls, v: str | None) -> str | None:
        if v is None:
            return None
        trimmed = v.strip()
        return trimmed or None


class ReContrePropositionLocataireRequest(BaseModel):
    """Body POST /locataires/{id}/proposition/re-contre-proposer (locataire).

    Identique à `ProposerDatesRequest` (la nouvelle date proposée) mais sans
    re-saisir préférences/durée déjà capturées au tour initial — seule la
    date change.
    """

    date_entree_souhaitee: date
    commentaire: str | None = Field(None, max_length=500)

    @field_validator("commentaire")
    @classmethod
    def _trim_or_none(cls, v: str | None) -> str | None:
        if v is None:
            return None
        trimmed = v.strip()
        return trimmed or None


class RefuserPropositionRequest(BaseModel):
    """Body POST /locataires/{id}/proposition/refuser (bailleur OU locataire)."""

    motif_refus: str | None = Field(None, max_length=500)

    @field_validator("motif_refus")
    @classmethod
    def _trim_or_none(cls, v: str | None) -> str | None:
        if v is None:
            return None
        trimmed = v.strip()
        return trimmed or None


# ── Response ──────────────────────────────────────────────────────────────────


class PropositionStatusResponse(BaseModel):
    """Réponse GET /locataires/{id}/proposition (status complet + flags UI).

    Les flags `peut_*` sont calculés côté backend et permettent au frontend
    d'afficher / cacher les CTA sans dupliquer la logique de transition.
    """

    model_config = ConfigDict(from_attributes=True)

    # État
    locataire_id: uuid.UUID
    statut_proposition: StatutProposition
    proposition_count: int

    # Données locataire
    date_entree_souhaitee: date | None = None
    duree_envisagee: DureeEnvisagee | None = None
    preferences: PreferencesLocataire = Field(default_factory=PreferencesLocataire)
    commentaire_locataire: str | None = None

    # Données bailleur
    date_contre_proposee_bailleur: date | None = None
    commentaire_bailleur: str | None = None

    # Final state
    motif_refus: str | None = None
    date_accord: date | None = None

    # Tracking
    last_proposed_at: datetime | None = None
    last_proposed_by: LastProposedBy | None = None

    # Flags UI (computed côté backend)
    peut_proposer: bool
    peut_contre_proposer: bool
    peut_accepter_locataire: bool
    peut_accepter_bailleur: bool
    peut_re_contre_proposer: bool
    peut_refuser: bool
    peut_reset: bool
    limite_atteinte: bool
