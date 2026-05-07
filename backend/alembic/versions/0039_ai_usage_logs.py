"""ai_usage_logs table — création réelle via Alembic Python.

Contexte (2026-05-08) :
  Le modèle SQLAlchemy `AIUsageLog` (`backend/app/models/ai_log.py`) existait
  depuis avril 2026, mais la table n'a jamais été créée en prod. La migration
  initialement prévue était un fichier `.sql` orphelin
  (`alembic/versions/0003_ai_usage_logs.sql`) destiné au Supabase SQL Editor —
  jamais appliqué via `alembic upgrade head` (Alembic ne charge que les `.py`).

  Conséquence : 17 endpoints qui appelaient `_log_usage` plantaient en prod
  avec `UndefinedTableError: relation "ai_usage_logs" does not exist` dès la
  première sollicitation. Bug visible sur `/ai/draft-edl` (PR-EDL-2) au matin
  du 2026-05-08, latent sur tous les autres (chat sphère, briefing, scoring,
  draft-lease, etc.).

Cette migration :
  - Crée la table `ai_usage_logs` exactement comme le modèle SQLAlchemy
    l'attend (UUID PK, user_id sans FK — choix conservé tel quel pour ne pas
    casser la suppression user → preservation logs).
  - Ajoute les 2 index `user_id` / `created_at` requis pour les requêtes
    de quota mensuel + audit chronologique.

Le fichier `0003_ai_usage_logs.sql` est supprimé dans le même commit (cf
CLAUDE.md §B.13 : migrations Alembic exclusivement Python).

Revision ID: 0039
Revises: 0038
Create Date: 2026-05-08
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision = "0039"
down_revision = "0038"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_usage_logs",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("action", sa.String(64), nullable=False),
        sa.Column("model", sa.String(64), nullable=False),
        sa.Column("input_tokens", sa.Integer(), nullable=True),
        sa.Column("output_tokens", sa.Integer(), nullable=True),
        sa.Column("cost_usd", sa.Numeric(10, 6), nullable=True),
        sa.Column("context_ref", sa.String(255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_ai_usage_logs_user_id", "ai_usage_logs", ["user_id"], unique=False
    )
    op.create_index(
        "ix_ai_usage_logs_created_at", "ai_usage_logs", ["created_at"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_ai_usage_logs_created_at", table_name="ai_usage_logs")
    op.drop_index("ix_ai_usage_logs_user_id", table_name="ai_usage_logs")
    op.drop_table("ai_usage_logs")
