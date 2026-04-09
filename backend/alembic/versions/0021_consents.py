"""Add consent fields to users and dossier_fee_consent to locataires/dossiers_locataires

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
    op.execute(sa.text("""
        ALTER TABLE users
            ADD COLUMN IF NOT EXISTS cgu_accepted_at      TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS cgu_version          VARCHAR(20),
            ADD COLUMN IF NOT EXISTS marketing_consent    BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS marketing_consent_at TIMESTAMPTZ
    """))

    # ── locataires: dossier fee consent ──────────────────────────────────────
    # CHF 90 prélevé uniquement si le candidat est retenu (jamais avant)
    op.execute(sa.text("""
        ALTER TABLE locataires
            ADD COLUMN IF NOT EXISTS dossier_fee_consented_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS dossier_fee_amount        NUMERIC(10,2) DEFAULT 90.00
    """))

    # ── dossiers_locataires: même champs (table de candidature) ──────────────
    op.execute(sa.text("""
        ALTER TABLE dossiers_locataires
            ADD COLUMN IF NOT EXISTS dossier_fee_consented_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS dossier_fee_amount        NUMERIC(10,2) DEFAULT 90.00
    """))

    # ── Index marketing consent (campagnes newsletter) ────────────────────────
    op.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS idx_users_marketing_consent
            ON users (marketing_consent)
            WHERE marketing_consent = TRUE
    """))


def downgrade() -> None:
    op.execute(sa.text("""
        ALTER TABLE users
            DROP COLUMN IF EXISTS cgu_accepted_at,
            DROP COLUMN IF EXISTS cgu_version,
            DROP COLUMN IF EXISTS marketing_consent,
            DROP COLUMN IF EXISTS marketing_consent_at
    """))
    op.execute(sa.text("DROP INDEX IF EXISTS idx_users_marketing_consent"))
    op.execute(sa.text("""
        ALTER TABLE locataires
            DROP COLUMN IF EXISTS dossier_fee_consented_at,
            DROP COLUMN IF EXISTS dossier_fee_amount
    """))
    op.execute(sa.text("""
        ALTER TABLE dossiers_locataires
            DROP COLUMN IF EXISTS dossier_fee_consented_at,
            DROP COLUMN IF EXISTS dossier_fee_amount
    """))
