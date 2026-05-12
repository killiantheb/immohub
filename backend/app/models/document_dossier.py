"""Modèle SQLAlchemy — table documents_dossier (Module Dossier Locataire P1.0).

Le locataire upload jusqu'à 8 types de documents pour compléter son dossier.
Chaque doc est validé / rejeté manuellement par le bailleur (Sprint 1) puis
scoré automatiquement par Claude (Sprint 2 — slots `ai_*` pré-créés).

Référence : docs/4-PRODUIT.md §4.7, migration 0041, CLAUDE.md §B.10/§B.13.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from app.models.base import BaseModel
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship


# ── Constantes métier (source unique côté Python) ─────────────────────────────

# Poids progression par type. Total cumulé avec les 2 booléens d'étape de
# dossiers_locataires (renseignements_complets=15, loyer_caution_verses=5) = 100.
# Doit rester en sync avec le CHECK constraint de la migration 0041.
TYPE_DOCUMENT_POIDS: dict[str, int] = {
    "piece_identite":     15,
    "permis_sejour":      10,
    "contrat_travail":    15,
    "fiches_salaire":     10,   # global ; max 3 fichiers, prorata 1/3 chacun
    "assurance_rc":       10,
    "caution":             5,
    "extrait_poursuites":  5,
    "bail_signe":         10,   # uploaded_by = bailleur (Sprint 3 côté front)
}

# Poids des 2 étapes booléennes côté dossiers_locataires.
POIDS_RENSEIGNEMENTS = 15
POIDS_LOYER_CAUTION_VERSES = 5

# Types qui acceptent un équivalent textuel (cf §4.7 — promesse embauche,
# mail attente extrait poursuites). Source : décision Killian 2026-05-13.
TYPES_AVEC_EQUIVALENT: frozenset[str] = frozenset(
    {"contrat_travail", "fiches_salaire", "extrait_poursuites"}
)

# Types qu'un locataire peut uploader (tous sauf bail_signe = uploaded par bailleur).
TYPES_LOCATAIRE: frozenset[str] = frozenset(
    set(TYPE_DOCUMENT_POIDS.keys()) - {"bail_signe"}
)

# Types qu'un bailleur peut uploader (uniquement bail_signe Phase 1.0).
TYPES_BAILLEUR: frozenset[str] = frozenset({"bail_signe"})

# Types multi-fichiers (count max). Tous les autres = 1 fichier exact.
TYPES_MULTI_FICHIERS: dict[str, int] = {"fiches_salaire": 3}

# Mime types acceptés (doit matcher CHECK constraint migration 0041).
ALLOWED_MIME_TYPES: frozenset[str] = frozenset(
    {"application/pdf", "image/jpeg", "image/png"}
)

# Taille max par fichier (doit matcher CHECK constraint migration 0041).
MAX_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

# Statuts valides (doit matcher CHECK constraint migration 0041).
STATUTS_VALIDES: frozenset[str] = frozenset({"uploaded", "valide", "rejete"})


# ── Modèle ────────────────────────────────────────────────────────────────────


class DocumentDossier(BaseModel):
    """Document uploadé dans le dossier d'un locataire.

    Sémantique :
      - 1 locataire → N documents (cascade DELETE depuis locataire).
      - Pas de UNIQUE(locataire_id, type_document) — fiches_salaire accepte
        jusqu'à 3 fichiers. Pour les autres types, la validation max-1 est
        faite côté service Python.
      - `uploaded_by_user_id` distingue locataire (cas standard) vs bailleur
        (cas `bail_signe`).
      - Statut transitionne `uploaded` → `valide` ou `rejete` (idempotent
        irréversible Phase 1.0 ; ré-upload = DELETE + INSERT, autorisé tant
        que statut = `uploaded` côté DELETE policy).
      - Slots `ai_*` NULL Sprint 1, remplis Sprint 2 via Claude.
    """

    __tablename__ = "documents_dossier"

    locataire_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("locataires.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    type_document: Mapped[str] = mapped_column(String(50), nullable=False)
    storage_key: Mapped[str] = mapped_column(Text, nullable=False)
    filename_original: Mapped[str] = mapped_column(String(300), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    statut: Mapped[str] = mapped_column(
        String(20), nullable=False, default="uploaded", server_default="uploaded"
    )
    poids_progression: Mapped[int] = mapped_column(Integer, nullable=False)
    est_equivalent: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    equivalent_libelle: Mapped[str | None] = mapped_column(String(200))
    commentaire_rejet: Mapped[str | None] = mapped_column(Text)

    uploaded_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    valide_par_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
    )
    valide_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Sprint 2 — Scoring IA Claude (slots pré-créés Sprint 1)
    ai_score_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ai_recommendation: Mapped[str | None] = mapped_column(String(20))
    ai_details: Mapped[Any | None] = mapped_column(JSONB)

    # Relations
    locataire: Mapped["Locataire"] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "Locataire",
        back_populates="documents_dossier",
        foreign_keys=[locataire_id],
    )
    uploaded_by: Mapped["User"] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "User",
        foreign_keys=[uploaded_by_user_id],
    )
    valide_par: Mapped["User | None"] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "User",
        foreign_keys=[valide_par_user_id],
    )
