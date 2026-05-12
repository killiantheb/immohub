"""Hotfix : add is_active column on documents_dossier (oversight 0041).

Contexte (2026-05-13) :
  La migration 0041 a créé `documents_dossier` sans la colonne `is_active`
  alors que le modèle Python `DocumentDossier` hérite de `BaseModel` qui la
  déclare. SQLAlchemy émet donc systématiquement `INSERT/SELECT` avec
  is_active, ce qui aurait fait planter Postgres avec UndefinedColumn au
  premier upload.

  Bug détecté avant le premier appel API E2E (audit base.py 2026-05-13).
  Hotfix avant que le bug ne soit reproductible en prod.

Modification :
  - ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true sur documents_dossier
  - Les lignes éventuelles déjà insérées (aucune en prod a priori) reçoivent
    le default 'true' automatiquement.

Doctrine appliquée :
  - §B.10 : pas de mensonge — on ne maquille pas l'oversight, on l'écrit
    explicitement dans le commit + dans cette migration.
  - §B.13 : migration Alembic Python only.

Revision ID: 0043
Revises: 0042
Create Date: 2026-05-13
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "0043"
down_revision = "0042"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "documents_dossier",
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )


def downgrade() -> None:
    op.drop_column("documents_dossier", "is_active")
