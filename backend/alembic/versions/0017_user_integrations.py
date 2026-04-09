"""0017 — user_integrations: OAuth tokens for Gmail / Outlook / Calendar."""

from __future__ import annotations

from alembic import op

revision = "0017"
down_revision = "0016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS user_integrations (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            provider        VARCHAR(30) NOT NULL,   -- gmail | outlook | google_calendar | outlook_calendar
            access_token    TEXT,
            refresh_token   TEXT,
            token_expires_at TIMESTAMP WITH TIME ZONE,
            scope           TEXT,
            email           VARCHAR(300),           -- email account connecté
            is_active       BOOLEAN NOT NULL DEFAULT TRUE,
            created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            UNIQUE (user_id, provider)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_user_integrations_user ON user_integrations(user_id)")

    # Calendar events pushed by Althy
    op.execute("""
        CREATE TABLE IF NOT EXISTS calendar_events (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            provider        VARCHAR(30) NOT NULL,   -- google | outlook
            external_id     VARCHAR(300),           -- ID de l'event chez Google/Microsoft
            title           TEXT,
            start_at        TIMESTAMP WITH TIME ZONE,
            end_at          TIMESTAMP WITH TIME ZONE,
            description     TEXT,
            bien_id         UUID REFERENCES biens(id) ON DELETE SET NULL,
            mission_id      UUID,                   -- référence libre (missions_ouvreurs)
            event_type      VARCHAR(30),            -- visite | edl | intervention | rappel
            created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
        )
    """)


def downgrade() -> None:
    pass
