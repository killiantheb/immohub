"""0023 — Ajout ctx_hash sur ai_briefing_cache (cache MD5 contexte Sphère).

Revision ID: 0023
Revises: 0022
Create Date: 2026-04-10
"""

from __future__ import annotations
from alembic import op
import sqlalchemy as sa

revision = "0023"
down_revision = "0022"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(sa.text("""
        ALTER TABLE ai_briefing_cache
        ADD COLUMN IF NOT EXISTS ctx_hash VARCHAR(32)
    """))
    op.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS idx_briefing_cache_hash
            ON ai_briefing_cache (user_id, ctx_hash)
    """))


def downgrade() -> None:
    op.execute(sa.text("DROP INDEX IF EXISTS idx_briefing_cache_hash"))
    op.execute(sa.text("ALTER TABLE ai_briefing_cache DROP COLUMN IF EXISTS ctx_hash"))
