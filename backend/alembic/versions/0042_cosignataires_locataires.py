"""Add cosignataires JSONB column on locataires (Sprint 1A.5 — couple/famille).

Contexte (2026-05-13) :
  Sprint 1A.5 Module Dossier Locataire — gérer le cas conjoint cosignataire
  + enfants occupants sans refactoring multi-comptes (Phase 1.1).

  1 compte Althy = 1 locataire principal. Le conjoint et les enfants
  vivent dans le bien mais n'ont pas de compte Phase 1.0. Ils sont stockés
  dans une colonne JSONB `cosignataires` (array d'objets).

  Couvre Solo (cosignataires = []), Couple (1 conjoint), Famille (1
  conjoint + N enfants) = ~95% des cas Sunimmo.

  Colocation N comptes → Phase 1.1 (refacto séparé).

Schéma JSON attendu (validé côté Pydantic, pas côté DB JSONB) :
    [
      {
        "type": "conjoint" | "enfant" | "autre",
        "prenom": str,
        "nom": str,
        "date_naissance": "YYYY-MM-DD" | null,
        "signature_requise": bool,
        "lien_filial": str | null
      },
      ...
    ]

Doctrine appliquée :
  - §B.13 : migration Alembic Python only.
  - Pas d'index Phase 1.0 — la colonne est lue intégralement à chaque GET
    locataire (≤ 20 cosignataires/locataire) et écrite via PATCH unique.
    Index GIN à ajouter si recherche cross-locataires Phase 2.

Revision ID: 0042
Revises: 0041
Create Date: 2026-05-13
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision = "0042"
down_revision = "0041"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "locataires",
        sa.Column(
            "cosignataires",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )


def downgrade() -> None:
    op.drop_column("locataires", "cosignataires")
