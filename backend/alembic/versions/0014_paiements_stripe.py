"""Add Stripe fields to paiements + subscriptions table.

Revision ID: 0014
Revises: 0013
Create Date: 2026-04-09
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── paiements : champs Stripe ─────────────────────────────────────────────
    op.execute("""
        ALTER TABLE paiements
            ADD COLUMN IF NOT EXISTS net_montant NUMERIC(10,2),
            ADD COLUMN IF NOT EXISTS stripe_payment_intent_id VARCHAR(100),
            ADD COLUMN IF NOT EXISTS stripe_charge_id VARCHAR(100)
    """)

    # ── subscriptions : ensure table exists + add missing columns ────────────
    # The table may already exist (created by schema.sql) without is_active.
    # Use ADD COLUMN IF NOT EXISTS to safely bring it up to spec.
    op.execute("""
        CREATE TABLE IF NOT EXISTS subscriptions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            plan VARCHAR(50) NOT NULL DEFAULT 'starter',
            status VARCHAR(50) NOT NULL DEFAULT 'active',
            stripe_customer_id VARCHAR(100),
            stripe_subscription_id VARCHAR(100),
            current_period_start TIMESTAMPTZ,
            current_period_end TIMESTAMPTZ,
            cancelled_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    # Add is_active separately so it works whether the table is new or pre-existing
    op.execute("""
        ALTER TABLE subscriptions
            ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true
    """)
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_subscriptions_user
            ON subscriptions(user_id) WHERE is_active = true
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer
            ON subscriptions(stripe_customer_id)
    """)

    # ── profiles : ensure stripe columns exist ────────────────────────────────
    op.execute("""
        ALTER TABLE profiles
            ADD COLUMN IF NOT EXISTS stripe_account_id VARCHAR(100),
            ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(100),
            ADD COLUMN IF NOT EXISTS stripe_card_pm_id VARCHAR(100)
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE paiements
            DROP COLUMN IF EXISTS net_montant,
            DROP COLUMN IF EXISTS stripe_payment_intent_id,
            DROP COLUMN IF EXISTS stripe_charge_id
    """)
