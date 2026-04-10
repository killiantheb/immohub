"""0024 — Ajout type_entretien + affectation sur depenses_scannees.

Revision ID: 0024
Revises: 0023
Create Date: 2026-04-10
"""

from __future__ import annotations
from alembic import op
import sqlalchemy as sa

revision = "0024"
down_revision = "0023"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(sa.text("""
        ALTER TABLE depenses_scannees
        ADD COLUMN IF NOT EXISTS type_entretien VARCHAR(30)
            CHECK (type_entretien IN ('gros_entretien', 'menu_entretien', 'autre'))
    """))
    op.execute(sa.text("""
        ALTER TABLE depenses_scannees
        ADD COLUMN IF NOT EXISTS affectation VARCHAR(20)
            CHECK (affectation IN ('proprio', 'locataire', 'partage'))
    """))
    op.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS idx_depenses_type
            ON depenses_scannees (owner_id, type_entretien)
    """))


def downgrade() -> None:
    op.execute(sa.text("DROP INDEX IF EXISTS idx_depenses_type"))
    op.execute(sa.text("ALTER TABLE depenses_scannees DROP COLUMN IF EXISTS affectation"))
    op.execute(sa.text("ALTER TABLE depenses_scannees DROP COLUMN IF EXISTS type_entretien"))
