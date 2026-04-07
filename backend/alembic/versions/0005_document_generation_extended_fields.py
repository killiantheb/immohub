"""Document generation — extended property/contract fields + document tables.

Revision ID: 0005
Revises: 0004
Create Date: 2026-04-07
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Property — new fields ──────────────────────────────────────────────────
    op.add_column("properties", sa.Column("reference_number", sa.String(50), nullable=True))
    op.add_column("properties", sa.Column("building_name", sa.String(200), nullable=True))
    op.add_column("properties", sa.Column("unit_number", sa.String(20), nullable=True))
    op.add_column("properties", sa.Column("bedrooms", sa.Integer(), nullable=True))
    op.add_column("properties", sa.Column("bathrooms", sa.Integer(), nullable=True))
    op.add_column("properties", sa.Column("canton", sa.String(10), nullable=True, server_default="VS"))
    op.add_column("properties", sa.Column("nearby_landmarks", sa.String(500), nullable=True))
    op.add_column("properties", sa.Column("has_balcony", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("properties", sa.Column("has_terrace", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("properties", sa.Column("has_garden", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("properties", sa.Column("has_storage", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("properties", sa.Column("has_fireplace", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("properties", sa.Column("has_laundry", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("properties", sa.Column("linen_provided", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("properties", sa.Column("smoking_allowed", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("properties", sa.Column("is_for_sale", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("properties", sa.Column("tourist_tax_amount", sa.Numeric(8, 2), nullable=True))
    op.add_column("properties", sa.Column("keys_count", sa.Integer(), nullable=True, server_default="3"))

    # ── Contract — new fields ─────────────────────────────────────────────────
    op.add_column("contracts", sa.Column("is_furnished", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("contracts", sa.Column("payment_day", sa.Integer(), nullable=False, server_default="5"))
    op.add_column("contracts", sa.Column("notice_period_months", sa.Integer(), nullable=False, server_default="3"))
    op.add_column("contracts", sa.Column("notice_deadline_date", sa.String(50), nullable=True))
    op.add_column("contracts", sa.Column("partial_period_days", sa.Integer(), nullable=True))
    op.add_column("contracts", sa.Column("partial_period_rent", sa.Numeric(12, 2), nullable=True))
    op.add_column("contracts", sa.Column("tourist_tax_amount", sa.Numeric(8, 2), nullable=True))
    op.add_column("contracts", sa.Column("cleaning_fee_hourly", sa.Numeric(8, 2), nullable=True, server_default="42"))
    op.add_column("contracts", sa.Column("linen_fee_included", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("contracts", sa.Column("reminder_fee", sa.Numeric(8, 2), nullable=False, server_default="35"))
    op.add_column("contracts", sa.Column("late_interest_rate", sa.Numeric(4, 2), nullable=False, server_default="6"))
    op.add_column("contracts", sa.Column("mortgage_rate_ref", sa.Numeric(4, 3), nullable=True))
    op.add_column("contracts", sa.Column("cpi_index_ref", sa.Numeric(6, 1), nullable=True))
    op.add_column("contracts", sa.Column("deposit_type", sa.String(30), nullable=True, server_default="gocaution"))
    op.add_column("contracts", sa.Column("deposit_payment_deadline_days", sa.Integer(), nullable=False, server_default="10"))
    op.add_column("contracts", sa.Column("early_termination_fee", sa.Numeric(10, 2), nullable=False, server_default="270"))
    op.add_column("contracts", sa.Column("payment_communication", sa.String(200), nullable=True))
    op.add_column("contracts", sa.Column("subletting_allowed", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("contracts", sa.Column("animals_allowed", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("contracts", sa.Column("smoking_allowed", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("contracts", sa.Column("is_for_sale", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("contracts", sa.Column("signed_at_city", sa.String(100), nullable=True))
    op.add_column("contracts", sa.Column("canton", sa.String(10), nullable=True, server_default="VS"))
    op.add_column("contracts", sa.Column("bank_name", sa.String(100), nullable=True))
    op.add_column("contracts", sa.Column("bank_iban", sa.String(34), nullable=True))
    op.add_column("contracts", sa.Column("bank_bic", sa.String(11), nullable=True))
    op.add_column("contracts", sa.Column("occupants_count", sa.Integer(), nullable=False, server_default="1"))
    op.add_column("contracts", sa.Column("tenant_nationality", sa.String(100), nullable=True))
    op.add_column("contracts", sa.Column("tenant_address", sa.String(500), nullable=True))

    # ── document_templates ────────────────────────────────────────────────────
    op.create_table(
        "document_templates",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("template_type", sa.String(60), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("language", sa.String(5), nullable=False, server_default="fr"),
        sa.Column("canton", sa.String(10), nullable=True),
        sa.Column("content_html", sa.Text(), nullable=False),
        sa.Column("variables_used", sa.JSON(), nullable=True),
        sa.Column("agency_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_document_templates_type", "document_templates", ["template_type"])
    op.create_index("ix_document_templates_agency", "document_templates", ["agency_id"])

    # ── generated_documents ───────────────────────────────────────────────────
    op.create_table(
        "generated_documents",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("template_type", sa.String(60), nullable=False),
        sa.Column("contract_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("property_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("owner_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("agency_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("generated_by_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("content_html", sa.Text(), nullable=False),
        sa.Column("context_data", sa.JSON(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_generated_documents_contract", "generated_documents", ["contract_id"])
    op.create_index("ix_generated_documents_owner", "generated_documents", ["owner_id"])
    op.create_index("ix_generated_documents_type", "generated_documents", ["template_type"])


def downgrade() -> None:
    op.drop_table("generated_documents")
    op.drop_table("document_templates")

    # Remove contract columns
    for col in [
        "tenant_address", "tenant_nationality", "occupants_count",
        "bank_bic", "bank_iban", "bank_name", "canton", "signed_at_city",
        "is_for_sale", "smoking_allowed", "animals_allowed", "subletting_allowed",
        "payment_communication", "early_termination_fee", "deposit_payment_deadline_days",
        "deposit_type", "cpi_index_ref", "mortgage_rate_ref", "late_interest_rate",
        "reminder_fee", "linen_fee_included", "cleaning_fee_hourly", "tourist_tax_amount",
        "partial_period_rent", "partial_period_days", "notice_deadline_date",
        "notice_period_months", "payment_day", "is_furnished",
    ]:
        op.drop_column("contracts", col)

    # Remove property columns
    for col in [
        "keys_count", "tourist_tax_amount", "is_for_sale", "smoking_allowed",
        "linen_provided", "has_laundry", "has_fireplace", "has_storage",
        "has_garden", "has_terrace", "has_balcony", "nearby_landmarks",
        "canton", "bathrooms", "bedrooms", "unit_number", "building_name",
        "reference_number",
    ]:
        op.drop_column("properties", col)
