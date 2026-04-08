"""Add lat/lng to biens table.

Revision ID: 0009
Revises: 0008
Create Date: 2026-04-08
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("biens", sa.Column("lat", sa.Float(), nullable=True))
    op.add_column("biens", sa.Column("lng", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("biens", "lng")
    op.drop_column("biens", "lat")
