"""Add consent fields to users and dossier_fee_consent to tenants/applications

Revision ID: 0021
Revises: 0020
Create Date: 2026-04-09
"""
from alembic import op
import sqlalchemy as sa

revision = "0021"
down_revision = "0020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── users: CGU + marketing consent ──────────────────────────────────────
    op.execute("""
        ALTER TABLE users
            ADD COLUMN IF NOT EXISTS cgu_accepted_at       TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS cgu_version           VARCHAR(20),
            ADD COLUMN IF NOT EXISTS marketing_consent     BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS marketing_consent_at  TIMESTAMPTZ
    """)

    # ── tenants: dossier fee consent ─────────────────────────────────────────
    # Applied when candidate submits their application (CHF 90 only if retained)
    op.execute("""
        ALTER TABLE tenants
            ADD COLUMN IF NOT EXISTS dossier_fee_consented_at  TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS dossier_fee_amount         NUMERIC(10,2) DEFAULT 90.00
    """)

    # Also add to a generic applications table if it exists
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'applications') THEN
                ALTER TABLE applications
                    ADD COLUMN IF NOT EXISTS dossier_fee_consented_at  TIMESTAMPTZ,
                    ADD COLUMN IF NOT EXISTS dossier_fee_amount         NUMERIC(10,2) DEFAULT 90.00;
            END IF;
        END
        $$
    """)

    # Index for marketing consent queries (newsletter campaigns)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_users_marketing_consent
            ON users (marketing_consent)
            WHERE marketing_consent = TRUE
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE users
            DROP COLUMN IF EXISTS cgu_accepted_at,
            DROP COLUMN IF EXISTS cgu_version,
            DROP COLUMN IF EXISTS marketing_consent,
            DROP COLUMN IF EXISTS marketing_consent_at
    """)
    op.execute("DROP INDEX IF EXISTS idx_users_marketing_consent")
    op.execute("""
        ALTER TABLE tenants
            DROP COLUMN IF EXISTS dossier_fee_consented_at,
            DROP COLUMN IF EXISTS dossier_fee_amount
    """)
