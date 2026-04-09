"""0015 — Marketplace payments: Stripe fields for ouvreurs/artisans + mission payment tracking."""

from __future__ import annotations

from alembic import op

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Stripe Connect for ouvreurs ───────────────────────────────────────────
    op.execute("""
        ALTER TABLE profiles_ouvreurs
            ADD COLUMN IF NOT EXISTS stripe_account_id VARCHAR(100),
            ADD COLUMN IF NOT EXISTS stripe_connect_onboarded BOOLEAN NOT NULL DEFAULT FALSE
    """)

    # ── Stripe Connect for artisans ───────────────────────────────────────────
    op.execute("""
        ALTER TABLE profiles_artisans
            ADD COLUMN IF NOT EXISTS stripe_account_id VARCHAR(100),
            ADD COLUMN IF NOT EXISTS stripe_connect_onboarded BOOLEAN NOT NULL DEFAULT FALSE
    """)

    # ── Mission payment tracking ──────────────────────────────────────────────
    op.execute("""
        ALTER TABLE missions_ouvreurs
            ADD COLUMN IF NOT EXISTS commission_amount  NUMERIC(8,2),
            ADD COLUMN IF NOT EXISTS net_remuneration   NUMERIC(8,2),
            ADD COLUMN IF NOT EXISTS stripe_transfer_id VARCHAR(100),
            ADD COLUMN IF NOT EXISTS paid_at            TIMESTAMP WITH TIME ZONE,
            ADD COLUMN IF NOT EXISTS note_ouvreur       INTEGER CHECK (note_ouvreur BETWEEN 1 AND 5),
            ADD COLUMN IF NOT EXISTS note_commentaire   TEXT,
            ADD COLUMN IF NOT EXISTS refuse_reason      TEXT
    """)

    # ── RFQ quote commission tracking ────────────────────────────────────────
    op.execute("""
        ALTER TABLE rfq_quotes
            ADD COLUMN IF NOT EXISTS commission_amount  NUMERIC(8,2),
            ADD COLUMN IF NOT EXISTS net_amount         NUMERIC(10,2),
            ADD COLUMN IF NOT EXISTS stripe_transfer_id VARCHAR(100),
            ADD COLUMN IF NOT EXISTS paid_at            TIMESTAMP WITH TIME ZONE,
            ADD COLUMN IF NOT EXISTS ia_compare_report  TEXT
    """)

    # ── RFQ: store IA comparison report on the RFQ itself ────────────────────
    op.execute("""
        ALTER TABLE rfqs
            ADD COLUMN IF NOT EXISTS ia_compare_report TEXT,
            ADD COLUMN IF NOT EXISTS ia_compared_at    TIMESTAMP WITH TIME ZONE
    """)


def downgrade() -> None:
    pass
