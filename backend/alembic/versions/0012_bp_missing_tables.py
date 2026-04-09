"""Business plan missing tables — listings, offers, partners, commissions,
hunters, subscriptions, ai_sessions, analytics, profiles.

Revision ID: 0012
Revises: 0011
Create Date: 2026-04-09
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None

TABLES: list[str] = []


def upgrade() -> None:
    # ── 1. profiles — infos étendues utilisateurs ──────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS profiles (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id     UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
            first_name  VARCHAR(100),
            last_name   VARCHAR(100),
            phone       VARCHAR(30),
            avatar_url  TEXT,
            bio         TEXT,
            address     VARCHAR(300),
            city        VARCHAR(100),
            zip_code    VARCHAR(10),
            country     VARCHAR(2)   NOT NULL DEFAULT 'CH',
            canton      VARCHAR(2),
            timezone    VARCHAR(50)  NOT NULL DEFAULT 'Europe/Zurich',
            language    VARCHAR(5)   NOT NULL DEFAULT 'fr',
            preferences JSONB        NOT NULL DEFAULT '{}',
            stripe_customer_id VARCHAR(100),
            created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
            updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_profiles_user_id ON profiles(user_id)")

    # ── 2. listings — already created in migration 0001, skip table creation ──
    # Only add indexes that don't exist yet (0001 already created property_id + status indexes)
    # No-op block kept for reference

    # ── 3. offers — offres acheteurs/locataires ────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS offers (
            id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            listing_id     UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
            buyer_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            amount         NUMERIC(12,2) NOT NULL,
            message        TEXT,
            status         VARCHAR(20)  NOT NULL DEFAULT 'pending', -- pending | accepted | rejected | countered
            counter_amount NUMERIC(12,2),
            counter_message TEXT,
            expires_at     TIMESTAMPTZ,
            responded_at   TIMESTAMPTZ,
            created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_offers_listing_id ON offers(listing_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_offers_buyer_id   ON offers(buyer_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_offers_status     ON offers(status)")

    # ── 4. partners — partenaires invisibles ──────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS partners (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name            VARCHAR(200) NOT NULL,
            category        VARCHAR(50)  NOT NULL,  -- insurance | bail | energy | internet | moving | other
            description     TEXT,
            logo_url        TEXT,
            website         TEXT,
            contact_email   VARCHAR(200),
            contact_phone   VARCHAR(30),
            commission_pct  NUMERIC(5,2) NOT NULL DEFAULT 0,
            commission_flat NUMERIC(8,2) NOT NULL DEFAULT 0,
            tracking_url    TEXT,
            is_active       BOOLEAN NOT NULL DEFAULT true,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_partners_category  ON partners(category)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_partners_is_active ON partners(is_active)")

    # ── 5. commissions — commissions apporteur Althy ──────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS commissions (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            owner_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            partner_id      UUID REFERENCES partners(id) ON DELETE SET NULL,
            property_id     UUID REFERENCES properties(id) ON DELETE SET NULL,
            contract_id     UUID REFERENCES contracts(id) ON DELETE SET NULL,
            source          VARCHAR(50) NOT NULL,  -- stripe_connect | bail_fee | partner | opener | artisan
            amount          NUMERIC(10,2) NOT NULL,
            currency        VARCHAR(3)   NOT NULL DEFAULT 'CHF',
            status          VARCHAR(20)  NOT NULL DEFAULT 'pending',  -- pending | paid | cancelled
            stripe_payout_id VARCHAR(100),
            paid_at         TIMESTAMPTZ,
            description     TEXT,
            meta            JSONB NOT NULL DEFAULT '{}',
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_commissions_owner_id   ON commissions(owner_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_commissions_status     ON commissions(status)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_commissions_source     ON commissions(source)")

    # ── 6. hunters — leads off-market ─────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS hunters (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            hunter_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            address         VARCHAR(300) NOT NULL,
            city            VARCHAR(100) NOT NULL,
            zip_code        VARCHAR(10),
            description     TEXT,
            estimated_price NUMERIC(12,2),
            contact_name    VARCHAR(200),
            contact_phone   VARCHAR(30),
            contact_email   VARCHAR(200),
            status          VARCHAR(20)  NOT NULL DEFAULT 'new',  -- new | contacted | under_offer | closed | lost
            referral_amount NUMERIC(8,2),
            referral_paid   BOOLEAN NOT NULL DEFAULT false,
            notes           TEXT,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_hunters_hunter_id ON hunters(hunter_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_hunters_status    ON hunters(status)")

    # ── 7. subscriptions — abonnements Stripe ─────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS subscriptions (
            id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id             UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
            stripe_subscription_id VARCHAR(100) UNIQUE,
            stripe_customer_id  VARCHAR(100),
            plan                VARCHAR(30)  NOT NULL DEFAULT 'starter',  -- starter | pro | agency | enterprise
            status              VARCHAR(20)  NOT NULL DEFAULT 'trialing', -- trialing | active | past_due | cancelled
            price_chf_monthly   NUMERIC(8,2) NOT NULL DEFAULT 29,
            seats               INTEGER NOT NULL DEFAULT 1,
            trial_ends_at       TIMESTAMPTZ,
            current_period_start TIMESTAMPTZ,
            current_period_end  TIMESTAMPTZ,
            cancelled_at        TIMESTAMPTZ,
            cancel_at           TIMESTAMPTZ,
            meta                JSONB NOT NULL DEFAULT '{}',
            created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_subscriptions_user_id ON subscriptions(user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_subscriptions_status  ON subscriptions(status)")

    # ── 8. ai_sessions — historique sphère IA ─────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS ai_sessions (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title           VARCHAR(300),
            messages        JSONB NOT NULL DEFAULT '[]',
            context         JSONB NOT NULL DEFAULT '{}',  -- snapshot biens/locataires au moment de la session
            tokens_input    INTEGER NOT NULL DEFAULT 0,
            tokens_output   INTEGER NOT NULL DEFAULT 0,
            model           VARCHAR(50)  NOT NULL DEFAULT 'claude-sonnet-4-6',
            ended_at        TIMESTAMPTZ,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_ai_sessions_user_id    ON ai_sessions(user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_ai_sessions_created_at ON ai_sessions(created_at DESC)")

    # ── 9. analytics — événements plateforme ──────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS analytics (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
            event       VARCHAR(100) NOT NULL,   -- page_view | feature_used | document_generated | etc.
            category    VARCHAR(50),             -- acquisition | activation | retention | revenue | referral
            resource_type VARCHAR(50),
            resource_id VARCHAR(100),
            properties  JSONB NOT NULL DEFAULT '{}',
            ip          VARCHAR(45),
            user_agent  TEXT,
            session_id  VARCHAR(100),
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_analytics_user_id    ON analytics(user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_analytics_event      ON analytics(event)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_analytics_created_at ON analytics(created_at DESC)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_analytics_category   ON analytics(category)")

    # ── Row Level Security ────────────────────────────────────────────────────
    for table in [
        "profiles", "listings", "offers", "hunters",
        "subscriptions", "ai_sessions",
        # partners / commissions / analytics sont interne ou append-only
    ]:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")

    # RLS policies — chaque user ne voit que ses propres données
    # profiles
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='profiles_self') THEN
                CREATE POLICY profiles_self ON profiles
                    USING (user_id = auth.uid());
            END IF;
        END $$;
    """)

    # listings
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='listings' AND policyname='listings_owner') THEN
                CREATE POLICY listings_owner ON listings
                    USING (owner_id = auth.uid());
            END IF;
        END $$;
    """)

    # offers — acheteur ou propriétaire du listing
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='offers' AND policyname='offers_participant') THEN
                CREATE POLICY offers_participant ON offers
                    USING (
                        buyer_id = auth.uid()
                        OR listing_id IN (SELECT id FROM listings WHERE owner_id = auth.uid())
                    );
            END IF;
        END $$;
    """)

    # hunters
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='hunters' AND policyname='hunters_self') THEN
                CREATE POLICY hunters_self ON hunters
                    USING (hunter_id = auth.uid());
            END IF;
        END $$;
    """)

    # subscriptions
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='subscriptions' AND policyname='subscriptions_self') THEN
                CREATE POLICY subscriptions_self ON subscriptions
                    USING (user_id = auth.uid());
            END IF;
        END $$;
    """)

    # ai_sessions
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ai_sessions' AND policyname='ai_sessions_self') THEN
                CREATE POLICY ai_sessions_self ON ai_sessions
                    USING (user_id = auth.uid());
            END IF;
        END $$;
    """)


def downgrade() -> None:
    for table in [
        "analytics", "ai_sessions", "subscriptions", "hunters",
        "commissions", "partners", "offers", "listings", "profiles",
    ]:
        op.execute(f"DROP TABLE IF EXISTS {table} CASCADE")
