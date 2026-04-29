"""Ajout residence_type + location_type_actuel à `biens` (PR-A9.1).

Estimation IA enrichie : 2 champs P0 nécessaires pour le prompt Claude
v2 (analyse selon résidence principale/secondaire et type de location
annuelle/saisonnière/semaine — vision Killian).

Champ `quartier` reporté Phase 2 — Claude peut le déduire de
adresse + lat/lng.

Les deux colonnes sont NULLABLE (rétrocompatibilité avec biens existants).
CHECK constraints garantissent l'intégrité des valeurs côté DB.

Revision ID: 0033
Revises: 0032
Create Date: 2026-04-29
"""

from __future__ import annotations

from alembic import op
from sqlalchemy import text


revision = "0033"
down_revision = "0032"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Ajoute 2 colonnes nullables + CHECK constraints (idempotent)."""
    # 1. Colonnes nullables — IF NOT EXISTS pour idempotence (re-run safe).
    op.execute(
        text(
            "ALTER TABLE biens "
            "ADD COLUMN IF NOT EXISTS residence_type VARCHAR(20)"
        )
    )
    op.execute(
        text(
            "ALTER TABLE biens "
            "ADD COLUMN IF NOT EXISTS location_type_actuel VARCHAR(20)"
        )
    )

    # 2. CHECK constraints — DROP puis ADD pour idempotence (PG ne supporte
    #    pas ADD CONSTRAINT IF NOT EXISTS sur CHECK).
    op.execute(
        text(
            "ALTER TABLE biens "
            "DROP CONSTRAINT IF EXISTS ck_biens_residence_type"
        )
    )
    op.execute(
        text(
            "ALTER TABLE biens "
            "ADD CONSTRAINT ck_biens_residence_type "
            "CHECK (residence_type IS NULL "
            "OR residence_type IN ('principale', 'secondaire', 'mixte'))"
        )
    )

    op.execute(
        text(
            "ALTER TABLE biens "
            "DROP CONSTRAINT IF EXISTS ck_biens_location_type_actuel"
        )
    )
    op.execute(
        text(
            "ALTER TABLE biens "
            "ADD CONSTRAINT ck_biens_location_type_actuel "
            "CHECK (location_type_actuel IS NULL "
            "OR location_type_actuel IN ('annuelle', 'saisonniere', 'semaine', 'vide'))"
        )
    )


def downgrade() -> None:
    """Rollback safe (Phase 1)."""
    op.execute(
        text(
            "ALTER TABLE biens "
            "DROP CONSTRAINT IF EXISTS ck_biens_location_type_actuel"
        )
    )
    op.execute(
        text(
            "ALTER TABLE biens "
            "DROP CONSTRAINT IF EXISTS ck_biens_residence_type"
        )
    )
    op.execute(
        text("ALTER TABLE biens DROP COLUMN IF EXISTS location_type_actuel")
    )
    op.execute(
        text("ALTER TABLE biens DROP COLUMN IF EXISTS residence_type")
    )
