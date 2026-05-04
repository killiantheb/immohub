"""Extension BienKey : code_grave + carte_securite + numero_carte_securite (PR-A11.A.6.h).

Innovation métier (sprint A11.A.6.h, retour terrain agence immobilière suisse) :

  - `code_grave` : code inscrit sur la clé pour refabrication chez serrurier
                   en cas de perte (str nullable, max 100 chars).
  - `carte_securite` : présence d'une carte de sécurité brevetée fournie par
                       le proprio (Mul-T-Lock / Kaba / Assa). Bool default
                       false.
  - `numero_carte_securite` : n° officiel de la carte de sécurité (str
                              nullable, max 100 chars). Visible UI seulement
                              si carte_securite=true.

Backlog cohérence docs : ajouter ces 3 champs au catalogue 7-CATALOGUE
l. 392-401 (Sécurité opérationnelle, acquisition 👤 USER Phase 1).

Revision ID: 0038
Revises: 0037
Create Date: 2026-05-04
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "0038"
down_revision = "0037"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "bien_keys",
        sa.Column("code_grave", sa.String(length=100), nullable=True),
    )
    op.add_column(
        "bien_keys",
        sa.Column(
            "carte_securite",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "bien_keys",
        sa.Column("numero_carte_securite", sa.String(length=100), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("bien_keys", "numero_carte_securite")
    op.drop_column("bien_keys", "carte_securite")
    op.drop_column("bien_keys", "code_grave")
