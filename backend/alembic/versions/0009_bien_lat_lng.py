"""Add lat/lng to biens table.

Revision ID: 0009
Revises: 0008
Create Date: 2026-04-08
"""

from __future__ import annotations

from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def _add_col(table: str, column: str, ddl: str) -> None:
    op.execute(f"""
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = '{table}' AND column_name = '{column}'
            ) THEN
                ALTER TABLE {table} ADD COLUMN {column} {ddl};
            END IF;
        END $$;
    """)


def upgrade() -> None:
    _add_col("biens", "lat", "FLOAT")
    _add_col("biens", "lng", "FLOAT")


def downgrade() -> None:
    op.execute("ALTER TABLE biens DROP COLUMN IF EXISTS lng")
    op.execute("ALTER TABLE biens DROP COLUMN IF EXISTS lat")
