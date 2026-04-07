"""ratings, favorites, agency_settings, insurance role

Revision ID: 0004
Revises: 0003
Create Date: 2026-04-07 00:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ── 1. Ajouter valeurs aux enums ──────────────────────────────────────────
    # PostgreSQL ne supporte pas ADD VALUE dans une transaction; on utilise
    # des commandes directes (hors transaction implicite d'Alembic).
    op.execute("ALTER TYPE user_role_enum ADD VALUE IF NOT EXISTS 'insurance'")
    op.execute("ALTER TYPE rfq_category_enum ADD VALUE IF NOT EXISTS 'insurance'")

    # ── 2. agency_settings ────────────────────────────────────────────────────
    op.create_table(
        "agency_settings",
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
            unique=True,
        ),
        # Commissions
        sa.Column("commission_location_pct", sa.Numeric(5, 2), nullable=False, server_default="8.33"),
        sa.Column("commission_management_pct", sa.Numeric(5, 2), nullable=False, server_default="5.0"),
        sa.Column("commission_sale_pct", sa.Numeric(5, 2), nullable=False, server_default="3.0"),
        sa.Column("deposit_months", sa.Integer(), nullable=False, server_default="3"),
        # Défauts contrat
        sa.Column("default_contract_type", sa.String(20), nullable=False, server_default="'long_term'"),
        sa.Column("default_notice_months", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("default_included_charges", sa.Boolean(), nullable=False, server_default="false"),
        # Identité agence
        sa.Column("agency_name", sa.String(200), nullable=True),
        sa.Column("agency_address", sa.String(300), nullable=True),
        sa.Column("agency_phone", sa.String(30), nullable=True),
        sa.Column("agency_email", sa.String(200), nullable=True),
        sa.Column("agency_rc_number", sa.String(50), nullable=True),
        sa.Column("agency_da_number", sa.String(50), nullable=True),
        sa.Column("agency_website", sa.String(300), nullable=True),
        sa.Column("agency_logo_url", sa.Text(), nullable=True),
        sa.Column("agency_description", sa.Text(), nullable=True),
        # Notifications
        sa.Column("notify_late_rent_days", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("notify_expiry_days", sa.Integer(), nullable=False, server_default="60"),
        sa.Column("notify_via_email", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("notify_via_whatsapp", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("whatsapp_number", sa.String(30), nullable=True),
        # IA
        sa.Column("ai_auto_actions", sa.Boolean(), nullable=False, server_default="false"),
        # Timestamps
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_agency_settings_user", "agency_settings", ["user_id"])

    # ── 3. ratings ────────────────────────────────────────────────────────────
    op.create_table(
        "ratings",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("rater_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("rater_role", sa.String(30), nullable=False),
        sa.Column("entity_type", sa.String(30), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("contract_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("rfq_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("mission_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_ratings_entity", "ratings", ["entity_type", "entity_id"])
    op.create_index("ix_ratings_rater", "ratings", ["rater_id"])

    # ── 4. favorites ──────────────────────────────────────────────────────────
    op.create_table(
        "favorites",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("property_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("user_id", "property_id", name="uq_favorites_user_property"),
    )
    op.create_index("ix_favorites_user", "favorites", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_favorites_user", table_name="favorites")
    op.drop_table("favorites")
    op.drop_index("ix_ratings_rater", table_name="ratings")
    op.drop_index("ix_ratings_entity", table_name="ratings")
    op.drop_table("ratings")
    op.drop_index("ix_agency_settings_user", table_name="agency_settings")
    op.drop_table("agency_settings")
    # Note: PostgreSQL ne supporte pas DROP VALUE sur les enums
