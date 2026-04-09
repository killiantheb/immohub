"""Add missing is_active column to ratings, favorites, agency_settings tables.

Migration 0004 created these tables without the is_active column that
BaseModel provides. This migration adds it idempotently.

Revision ID: 0011
Revises: 0010
Create Date: 2026-04-09
"""

from __future__ import annotations

from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None

TABLES = [
    "ratings",
    "favorites",
    "agency_settings",
]


def upgrade() -> None:
    for table in TABLES:
        op.execute(f"""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = '{table}' AND column_name = 'is_active'
                ) THEN
                    ALTER TABLE {table}
                        ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
                END IF;
            END
            $$;
        """)


def downgrade() -> None:
    for table in reversed(TABLES):
        op.execute(f"""
            ALTER TABLE {table} DROP COLUMN IF EXISTS is_active;
        """)
