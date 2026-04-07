"""add iban/bic, ai token quota, conversation_messages

Revision ID: 0003
Revises: 0002
Create Date: 2026-04-07 00:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ── users — coordonnées bancaires ─────────────────────────────────────────
    op.add_column("users", sa.Column("iban", sa.String(34), nullable=True))
    op.add_column("users", sa.Column("bic", sa.String(11), nullable=True))
    op.add_column("users", sa.Column("bank_account_holder", sa.String(200), nullable=True))

    # ── users — quota IA mensuel ──────────────────────────────────────────────
    op.add_column(
        "users",
        sa.Column("monthly_ai_tokens_used", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "users",
        sa.Column("monthly_ai_reset_date", sa.DateTime(timezone=True), nullable=True),
    )

    # ── conversation_messages ─────────────────────────────────────────────────
    op.create_table(
        "conversation_messages",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("session_id", sa.String(36), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_conv_user_session", "conversation_messages", ["user_id", "session_id"])
    op.create_index("ix_conv_created_at", "conversation_messages", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_conv_created_at", table_name="conversation_messages")
    op.drop_index("ix_conv_user_session", table_name="conversation_messages")
    op.drop_table("conversation_messages")

    op.drop_column("users", "monthly_ai_reset_date")
    op.drop_column("users", "monthly_ai_tokens_used")
    op.drop_column("users", "bank_account_holder")
    op.drop_column("users", "bic")
    op.drop_column("users", "iban")
