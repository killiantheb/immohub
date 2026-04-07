"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-04-05 00:00:00.000000

"""

from __future__ import annotations

from typing import Union
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# ── enum type definitions ─────────────────────────────────────────────────────
# create_type=False: we handle creation ourselves via enum.create(checkfirst=True)
# so that op.create_table never emits a duplicate CREATE TYPE.

user_role_enum = postgresql.ENUM(
    "super_admin",
    "agency",
    "owner",
    "tenant",
    "opener",
    "company",
    name="user_role_enum",
    create_type=False,
)
property_type_enum = postgresql.ENUM(
    "apartment",
    "villa",
    "parking",
    "garage",
    "box",
    "cave",
    "depot",
    "office",
    "commercial",
    "hotel",
    name="property_type_enum",
    create_type=False,
)
property_status_enum = postgresql.ENUM(
    "available",
    "rented",
    "for_sale",
    "sold",
    "maintenance",
    name="property_status_enum",
    create_type=False,
)
property_document_type_enum = postgresql.ENUM(
    "lease",
    "inventory",
    "insurance",
    "notice",
    "deed",
    "diagnosis",
    "other",
    name="property_document_type_enum",
    create_type=False,
)
contract_type_enum = postgresql.ENUM(
    "long_term",
    "seasonal",
    "short_term",
    "sale",
    name="contract_type_enum",
    create_type=False,
)
contract_status_enum = postgresql.ENUM(
    "draft",
    "active",
    "terminated",
    "expired",
    name="contract_status_enum",
    create_type=False,
)
transaction_type_enum = postgresql.ENUM(
    "rent",
    "commission",
    "deposit",
    "service",
    "quote",
    name="transaction_type_enum",
    create_type=False,
)
transaction_status_enum = postgresql.ENUM(
    "pending",
    "paid",
    "late",
    "cancelled",
    name="transaction_status_enum",
    create_type=False,
)
mission_type_enum = postgresql.ENUM(
    "visit",
    "check_in",
    "check_out",
    "inspection",
    "photography",
    "other",
    name="mission_type_enum",
    create_type=False,
)
mission_status_enum = postgresql.ENUM(
    "pending",
    "confirmed",
    "in_progress",
    "completed",
    "cancelled",
    name="mission_status_enum",
    create_type=False,
)
company_type_enum = postgresql.ENUM(
    "plumber",
    "electrician",
    "cleaner",
    "painter",
    "locksmith",
    "other",
    name="company_type_enum",
    create_type=False,
)
quote_status_enum = postgresql.ENUM(
    "pending",
    "accepted",
    "rejected",
    "completed",
    name="quote_status_enum",
    create_type=False,
)
inspection_type_enum = postgresql.ENUM(
    "entry",
    "exit",
    name="inspection_type_enum",
    create_type=False,
)
inspection_condition_enum = postgresql.ENUM(
    "good",
    "fair",
    "poor",
    name="inspection_condition_enum",
    create_type=False,
)
listing_status_enum = postgresql.ENUM(
    "draft",
    "active",
    "paused",
    "archived",
    name="listing_status_enum",
    create_type=False,
)

_ALL_ENUMS = [
    user_role_enum,
    property_type_enum,
    property_status_enum,
    property_document_type_enum,
    contract_type_enum,
    contract_status_enum,
    transaction_type_enum,
    transaction_status_enum,
    mission_type_enum,
    mission_status_enum,
    company_type_enum,
    quote_status_enum,
    inspection_type_enum,
    inspection_condition_enum,
    listing_status_enum,
]


# ── column helpers ────────────────────────────────────────────────────────────


def _uuid_pk() -> sa.Column:
    return sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False)


def _timestamps() -> list[sa.Column]:
    return [
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
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
    ]


def _fk(col: str, ref: str, ondelete: str = "RESTRICT", nullable: bool = False) -> sa.Column:
    return sa.Column(
        col, postgresql.UUID(as_uuid=True), sa.ForeignKey(ref, ondelete=ondelete), nullable=nullable
    )


# ── upgrade ───────────────────────────────────────────────────────────────────


def upgrade() -> None:
    bind = op.get_bind()

    # Create all enum types first — checkfirst=True means safe to re-run
    for enum in _ALL_ENUMS:
        enum.create(bind, checkfirst=True)

    # ── users ─────────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        _uuid_pk(),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=True),
        sa.Column("role", user_role_enum, nullable=False),
        sa.Column("first_name", sa.String(100), nullable=True),
        sa.Column("last_name", sa.String(100), nullable=True),
        sa.Column("phone", sa.String(20), nullable=True),
        sa.Column("avatar_url", sa.Text(), nullable=True),
        sa.Column("is_verified", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("supabase_uid", sa.String(36), nullable=True),
        *_timestamps(),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_role", "users", ["role"])
    op.create_index("ix_users_supabase_uid", "users", ["supabase_uid"], unique=True)

    # ── properties ────────────────────────────────────────────────────────────
    op.create_table(
        "properties",
        _uuid_pk(),
        _fk("owner_id", "users.id"),
        _fk("agency_id", "users.id", ondelete="SET NULL", nullable=True),
        _fk("created_by_id", "users.id"),
        sa.Column("type", property_type_enum, nullable=False),
        sa.Column("status", property_status_enum, nullable=False, server_default="available"),
        sa.Column("address", sa.String(500), nullable=False),
        sa.Column("city", sa.String(100), nullable=False),
        sa.Column("zip_code", sa.String(10), nullable=False),
        sa.Column("country", sa.String(2), server_default="FR", nullable=False),
        sa.Column("surface", sa.Float(), nullable=True),
        sa.Column("rooms", sa.Integer(), nullable=True),
        sa.Column("floor", sa.Integer(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("monthly_rent", sa.Numeric(12, 2), nullable=True),
        sa.Column("charges", sa.Numeric(12, 2), nullable=True),
        sa.Column("deposit", sa.Numeric(12, 2), nullable=True),
        sa.Column("price_sale", sa.Numeric(14, 2), nullable=True),
        sa.Column("is_furnished", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("has_parking", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("pets_allowed", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        *_timestamps(),
    )
    op.create_index("ix_properties_owner_id", "properties", ["owner_id"])
    op.create_index("ix_properties_agency_id", "properties", ["agency_id"])
    op.create_index("ix_properties_created_by_id", "properties", ["created_by_id"])
    op.create_index("ix_properties_status", "properties", ["status"])
    op.create_index("ix_properties_type", "properties", ["type"])
    op.create_index("ix_properties_city", "properties", ["city"])
    op.create_index("ix_properties_zip_code", "properties", ["zip_code"])

    # ── property_images ───────────────────────────────────────────────────────
    op.create_table(
        "property_images",
        _uuid_pk(),
        _fk("property_id", "properties.id", ondelete="CASCADE"),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("order", sa.Integer(), server_default="0", nullable=False),
        sa.Column("is_cover", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        *_timestamps(),
    )
    op.create_index("ix_property_images_property_id", "property_images", ["property_id"])
    op.create_index("ix_property_images_order", "property_images", ["property_id", "order"])

    # ── property_documents ────────────────────────────────────────────────────
    op.create_table(
        "property_documents",
        _uuid_pk(),
        _fk("property_id", "properties.id", ondelete="CASCADE"),
        sa.Column("type", property_document_type_enum, nullable=False),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        *_timestamps(),
    )
    op.create_index("ix_property_documents_property_id", "property_documents", ["property_id"])
    op.create_index("ix_property_documents_type", "property_documents", ["type"])

    # ── contracts ─────────────────────────────────────────────────────────────
    op.create_table(
        "contracts",
        _uuid_pk(),
        _fk("property_id", "properties.id"),
        _fk("tenant_id", "users.id", ondelete="SET NULL", nullable=True),
        _fk("agency_id", "users.id", ondelete="SET NULL", nullable=True),
        sa.Column("type", contract_type_enum, nullable=False),
        sa.Column("status", contract_status_enum, nullable=False, server_default="draft"),
        sa.Column("start_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("monthly_rent", sa.Numeric(12, 2), nullable=True),
        sa.Column("charges", sa.Numeric(12, 2), nullable=True),
        sa.Column("deposit", sa.Numeric(12, 2), nullable=True),
        sa.Column("signed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("terminated_at", sa.DateTime(timezone=True), nullable=True),
        *_timestamps(),
    )
    op.create_index("ix_contracts_property_id", "contracts", ["property_id"])
    op.create_index("ix_contracts_tenant_id", "contracts", ["tenant_id"])
    op.create_index("ix_contracts_agency_id", "contracts", ["agency_id"])
    op.create_index("ix_contracts_status", "contracts", ["status"])
    op.create_index("ix_contracts_type", "contracts", ["type"])
    op.create_index("ix_contracts_start_date", "contracts", ["start_date"])

    # ── transactions ──────────────────────────────────────────────────────────
    op.create_table(
        "transactions",
        _uuid_pk(),
        _fk("contract_id", "contracts.id", ondelete="SET NULL", nullable=True),
        _fk("property_id", "properties.id", ondelete="SET NULL", nullable=True),
        _fk("owner_id", "users.id"),
        _fk("tenant_id", "users.id", ondelete="SET NULL", nullable=True),
        sa.Column("type", transaction_type_enum, nullable=False),
        sa.Column("status", transaction_status_enum, nullable=False, server_default="pending"),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("commission_front_pct", sa.Numeric(5, 2), nullable=True),
        sa.Column("commission_back_pct", sa.Numeric(5, 2), nullable=True),
        sa.Column("commission_amount", sa.Numeric(12, 2), nullable=True),
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("stripe_payment_id", sa.String(255), nullable=True),
        *_timestamps(),
    )
    op.create_index("ix_transactions_contract_id", "transactions", ["contract_id"])
    op.create_index("ix_transactions_property_id", "transactions", ["property_id"])
    op.create_index("ix_transactions_owner_id", "transactions", ["owner_id"])
    op.create_index("ix_transactions_tenant_id", "transactions", ["tenant_id"])
    op.create_index("ix_transactions_status", "transactions", ["status"])
    op.create_index("ix_transactions_type", "transactions", ["type"])
    op.create_index("ix_transactions_due_date", "transactions", ["due_date"])
    op.create_index("ix_transactions_stripe_payment_id", "transactions", ["stripe_payment_id"])

    # ── openers ───────────────────────────────────────────────────────────────
    op.create_table(
        "openers",
        _uuid_pk(),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("bio", sa.Text(), nullable=True),
        sa.Column("radius_km", sa.Float(), nullable=True),
        sa.Column("hourly_rate", sa.Numeric(8, 2), nullable=True),
        sa.Column("is_available", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("rating", sa.Numeric(3, 2), nullable=True),
        sa.Column("total_missions", sa.Integer(), server_default="0", nullable=False),
        *_timestamps(),
    )
    op.create_index("ix_openers_user_id", "openers", ["user_id"], unique=True)
    op.create_index("ix_openers_is_available", "openers", ["is_available"])

    # ── missions ──────────────────────────────────────────────────────────────
    op.create_table(
        "missions",
        _uuid_pk(),
        _fk("opener_id", "openers.id"),
        _fk("property_id", "properties.id"),
        sa.Column("type", mission_type_enum, nullable=False),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", mission_status_enum, nullable=False, server_default="pending"),
        sa.Column("price", sa.Numeric(8, 2), nullable=True),
        sa.Column("report_url", sa.Text(), nullable=True),
        sa.Column("photos_urls", postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column("rating_given", sa.Numeric(3, 2), nullable=True),
        *_timestamps(),
    )
    op.create_index("ix_missions_opener_id", "missions", ["opener_id"])
    op.create_index("ix_missions_property_id", "missions", ["property_id"])
    op.create_index("ix_missions_status", "missions", ["status"])
    op.create_index("ix_missions_scheduled_at", "missions", ["scheduled_at"])
    op.create_index("ix_missions_type", "missions", ["type"])

    # ── companies ─────────────────────────────────────────────────────────────
    op.create_table(
        "companies",
        _uuid_pk(),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("type", company_type_enum, nullable=False),
        sa.Column("siret", sa.String(14), nullable=True, unique=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("rating", sa.Numeric(3, 2), nullable=True),
        sa.Column("total_jobs", sa.Integer(), server_default="0", nullable=False),
        sa.Column("commission_pct", sa.Numeric(5, 2), nullable=True),
        *_timestamps(),
    )
    op.create_index("ix_companies_user_id", "companies", ["user_id"], unique=True)
    op.create_index("ix_companies_type", "companies", ["type"])
    op.create_index("ix_companies_siret", "companies", ["siret"])

    # ── quotes ────────────────────────────────────────────────────────────────
    op.create_table(
        "quotes",
        _uuid_pk(),
        _fk("company_id", "companies.id"),
        _fk("property_id", "properties.id"),
        _fk("owner_id", "users.id"),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("status", quote_status_enum, nullable=False, server_default="pending"),
        sa.Column("validated_at", sa.DateTime(timezone=True), nullable=True),
        *_timestamps(),
    )
    op.create_index("ix_quotes_company_id", "quotes", ["company_id"])
    op.create_index("ix_quotes_property_id", "quotes", ["property_id"])
    op.create_index("ix_quotes_owner_id", "quotes", ["owner_id"])
    op.create_index("ix_quotes_status", "quotes", ["status"])

    # ── inspections ───────────────────────────────────────────────────────────
    op.create_table(
        "inspections",
        _uuid_pk(),
        _fk("property_id", "properties.id"),
        _fk("contract_id", "contracts.id", ondelete="SET NULL", nullable=True),
        _fk("inspector_id", "users.id"),
        sa.Column("type", inspection_type_enum, nullable=False),
        sa.Column("date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("report_url", sa.Text(), nullable=True),
        sa.Column("photos_urls", postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column("condition", inspection_condition_enum, nullable=False, server_default="good"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("signature_tenant", sa.Text(), nullable=True),
        sa.Column("signature_owner", sa.Text(), nullable=True),
        *_timestamps(),
    )
    op.create_index("ix_inspections_property_id", "inspections", ["property_id"])
    op.create_index("ix_inspections_contract_id", "inspections", ["contract_id"])
    op.create_index("ix_inspections_inspector_id", "inspections", ["inspector_id"])
    op.create_index("ix_inspections_type", "inspections", ["type"])
    op.create_index("ix_inspections_date", "inspections", ["date"])

    # ── listings ──────────────────────────────────────────────────────────────
    op.create_table(
        "listings",
        _uuid_pk(),
        sa.Column(
            "property_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("properties.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("title", sa.Text(), nullable=True),
        sa.Column("description_ai", sa.Text(), nullable=True),
        sa.Column("price", sa.Numeric(12, 2), nullable=True),
        sa.Column("status", listing_status_enum, nullable=False, server_default="draft"),
        sa.Column("portals", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("ai_score", sa.Numeric(5, 2), nullable=True),
        sa.Column("views", sa.Integer(), server_default="0", nullable=False),
        sa.Column("leads_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        *_timestamps(),
    )
    op.create_index("ix_listings_property_id", "listings", ["property_id"], unique=True)
    op.create_index("ix_listings_status", "listings", ["status"])
    op.create_index("ix_listings_published_at", "listings", ["published_at"])
    op.create_index("ix_listings_portals", "listings", ["portals"], postgresql_using="gin")

    # ── audit_logs ────────────────────────────────────────────────────────────
    op.create_table(
        "audit_logs",
        _uuid_pk(),
        _fk("user_id", "users.id", ondelete="SET NULL", nullable=True),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("resource_type", sa.String(100), nullable=False),
        sa.Column("resource_id", sa.String(36), nullable=True),
        sa.Column("old_values", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("new_values", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_audit_logs_user_id", "audit_logs", ["user_id"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])
    op.create_index("ix_audit_logs_resource_type", "audit_logs", ["resource_type"])
    op.create_index("ix_audit_logs_resource_id", "audit_logs", ["resource_id"])
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"])
    op.create_index(
        "ix_audit_logs_old_values", "audit_logs", ["old_values"], postgresql_using="gin"
    )
    op.create_index(
        "ix_audit_logs_new_values", "audit_logs", ["new_values"], postgresql_using="gin"
    )


# ── downgrade ─────────────────────────────────────────────────────────────────


def downgrade() -> None:
    bind = op.get_bind()

    for table in [
        "audit_logs",
        "listings",
        "inspections",
        "quotes",
        "companies",
        "missions",
        "openers",
        "transactions",
        "contracts",
        "property_documents",
        "property_images",
        "properties",
        "users",
    ]:
        op.drop_table(table)

    for enum in reversed(_ALL_ENUMS):
        enum.drop(bind, checkfirst=True)
