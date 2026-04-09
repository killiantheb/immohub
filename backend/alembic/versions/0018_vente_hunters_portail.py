"""0018 — vente, hunters off-market, portail invitations + messages"""

from __future__ import annotations
from alembic import op

revision = "0018"
down_revision = "0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Sale mandates ─────────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS sale_mandates (
            id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            property_id         UUID REFERENCES properties(id) ON DELETE SET NULL,
            owner_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            asking_price        NUMERIC(14,2),
            ia_estimate         NUMERIC(14,2),
            ia_estimate_at      TIMESTAMP WITH TIME ZONE,
            ia_estimate_report  TEXT,
            mandate_type        VARCHAR(20) NOT NULL DEFAULT 'solo',
            agent_id            UUID REFERENCES users(id) ON DELETE SET NULL,
            status              VARCHAR(20) NOT NULL DEFAULT 'actif',
            notary_referral_fee NUMERIC(8,2),
            notary_referral_at  TIMESTAMP WITH TIME ZONE,
            sale_price_final    NUMERIC(14,2),
            sold_at             TIMESTAMP WITH TIME ZONE,
            address             VARCHAR(300),
            city                VARCHAR(100),
            surface_m2          NUMERIC(8,1),
            nb_rooms            NUMERIC(4,1),
            year_built          INT,
            description         TEXT,
            created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            is_active           BOOLEAN NOT NULL DEFAULT TRUE
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_sale_mandates_owner ON sale_mandates(owner_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_sale_mandates_status ON sale_mandates(status)")

    # ── Sale offers ───────────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS sale_offers (
            id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            mandate_id           UUID NOT NULL REFERENCES sale_mandates(id) ON DELETE CASCADE,
            buyer_name           VARCHAR(200),
            buyer_email          VARCHAR(300),
            buyer_phone          VARCHAR(30),
            offer_price          NUMERIC(14,2) NOT NULL,
            counter_offer_price  NUMERIC(14,2),
            status               VARCHAR(20) NOT NULL DEFAULT 'recu',
            message              TEXT,
            created_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            updated_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_sale_offers_mandate ON sale_offers(mandate_id)")

    # ── Hunters: add off-market columns ──────────────────────────────────────
    op.execute("ALTER TABLE hunters ADD COLUMN IF NOT EXISTS off_market_visible BOOLEAN NOT NULL DEFAULT FALSE")
    op.execute("ALTER TABLE hunters ADD COLUMN IF NOT EXISTS referral_type VARCHAR(20) DEFAULT 'vente'")
    op.execute("ALTER TABLE hunters ADD COLUMN IF NOT EXISTS stripe_transfer_id TEXT")
    op.execute("CREATE INDEX IF NOT EXISTS idx_hunters_off_market ON hunters(off_market_visible) WHERE off_market_visible = TRUE")

    # ── Portail invitations (token-based, no Supabase account required) ───────
    op.execute("""
        CREATE TABLE IF NOT EXISTS portail_invitations (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            agency_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            proprio_email   VARCHAR(300) NOT NULL,
            proprio_name    VARCHAR(200),
            bien_id         UUID REFERENCES biens(id) ON DELETE SET NULL,
            token           UUID NOT NULL DEFAULT gen_random_uuid(),
            status          VARCHAR(20) NOT NULL DEFAULT 'pending',
            created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            accepted_at     TIMESTAMP WITH TIME ZONE,
            UNIQUE(token)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_portail_inv_agency ON portail_invitations(agency_user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_portail_inv_token ON portail_invitations(token)")

    # ── Portail messages ──────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS portail_messages (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            invitation_id   UUID NOT NULL REFERENCES portail_invitations(id) ON DELETE CASCADE,
            sender_type     VARCHAR(10) NOT NULL,
            content         TEXT NOT NULL,
            created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            read_at         TIMESTAMP WITH TIME ZONE
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_portail_msg_inv ON portail_messages(invitation_id)")


def downgrade() -> None:
    pass
