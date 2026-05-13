"""Add titre column to biens — corrige champ fantôme création.

Contexte (Sprint 7 Lot B — 2026-05-13) :
  Audit 4 (frontend ↔ backend contrats) a relevé que `frontend/src/app/app/
  (dashboard)/biens/nouveau/page.tsx` POSTe `titre: str` lors de la création
  d'un bien, mais que `backend/app/schemas/bien.py:BienBase` ne déclarait pas
  ce champ. Avec `extra="ignore"` par défaut, Pydantic le droppait
  silencieusement avant `Bien(**data)` → la valeur saisie était perdue
  côté DB sans erreur visible (§B.10 « pas de faux succès silencieux »).

  Cette migration ajoute la colonne, le modèle l'ajoute en Mapped, et les
  schemas BienBase/BienUpdate l'exposent. NULLABLE — fallback affichage =
  `{adresse} · {ville}` côté UI (cf BienHeader / fiche bien Sprint 4A).

Doctrine §B.13 : Python only (jamais de .sql brut dans versions/).

⚠️ Dépendance Lot A (Sprint 7) : down_revision = "0047" (qui sera créé par
   Lot A pour `loyers_transactions`). Si Lot A merge plus tard, séquencement
   alembic garantit l'ordre.

Revision ID: 0048
Revises: 0047
Create Date: 2026-05-13
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0048"
down_revision = "0047"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Colonne nullable — pas de backfill nécessaire (legacy biens ont
    # adresse+ville suffisamment descriptifs pour fallback UI).
    op.add_column(
        "biens",
        sa.Column("titre", sa.String(length=200), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("biens", "titre")
