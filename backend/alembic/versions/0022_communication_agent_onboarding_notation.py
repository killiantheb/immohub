"""0022 — Communication, Agent IA, Onboarding, Notation tables.

Revision ID: 0022
Revises: 0021
Create Date: 2026-04-10
"""

from __future__ import annotations
from alembic import op
import sqlalchemy as sa

revision = "0022"
down_revision = "0021"
branch_labels = None
depends_on = None


def _exec(sql: str) -> None:
    """Execute a single SQL statement (asyncpg forbids multi-statement strings)."""
    op.execute(sa.text(sql.strip()))


def _rls(table: str, *policies: str) -> None:
    """Enable RLS on a table then execute each policy statement individually."""
    _exec(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
    for stmt in policies:
        _exec(stmt)


# ── UPGRADE ───────────────────────────────────────────────────────────────────

def upgrade() -> None:

    # ═══════════════════════════════════════════════════════════════════════════
    # COMMUNICATION
    # ═══════════════════════════════════════════════════════════════════════════

    # user_oauth_tokens — jetons OAuth Gmail / Outlook
    _exec("""
        CREATE TABLE IF NOT EXISTS user_oauth_tokens (
            id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id       UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            provider      VARCHAR(50)  NOT NULL,
            access_token  TEXT         NOT NULL,
            refresh_token TEXT,
            expires_at    TIMESTAMPTZ,
            scopes        TEXT[],
            created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
            updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
            UNIQUE (user_id, provider)
        )
    """)
    _exec("""
        CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user
            ON user_oauth_tokens (user_id)
    """)

    # email_cache — emails immobiliers importés et pré-analysés
    _exec("""
        CREATE TABLE IF NOT EXISTS email_cache (
            id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            provider      VARCHAR(50) NOT NULL,
            message_id    TEXT        NOT NULL,
            subject       TEXT,
            sender        TEXT,
            received_at   TIMESTAMPTZ,
            body_preview  TEXT,
            labels        TEXT[],
            is_processed  BOOLEAN     NOT NULL DEFAULT FALSE,
            ai_action_id  UUID,
            created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE (user_id, provider, message_id)
        )
    """)
    _exec("""
        CREATE INDEX IF NOT EXISTS idx_email_cache_user
            ON email_cache (user_id, received_at DESC)
    """)
    _exec("""
        CREATE INDEX IF NOT EXISTS idx_email_cache_unprocessed
            ON email_cache (is_processed)
            WHERE is_processed = FALSE
    """)

    # calendar_events — rendez-vous (Google / Outlook / Althy natif)
    _exec("""
        CREATE TABLE IF NOT EXISTS calendar_events (
            id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            provider      VARCHAR(50),
            external_id   TEXT,
            title         TEXT        NOT NULL,
            description   TEXT,
            location      TEXT,
            start_at      TIMESTAMPTZ NOT NULL,
            end_at        TIMESTAMPTZ NOT NULL,
            all_day       BOOLEAN     NOT NULL DEFAULT FALSE,
            attendees     JSONB,
            contexte_type VARCHAR(50),
            contexte_id   UUID,
            synced_at     TIMESTAMPTZ,
            created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    _exec("""
        CREATE INDEX IF NOT EXISTS idx_calendar_events_user
            ON calendar_events (user_id, start_at)
    """)
    _exec("""
        CREATE INDEX IF NOT EXISTS idx_calendar_events_contexte
            ON calendar_events (contexte_type, contexte_id)
            WHERE contexte_type IS NOT NULL
    """)

    # whatsapp_conversations
    _exec("""
        CREATE TABLE IF NOT EXISTS whatsapp_conversations (
            id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            contact_phone   VARCHAR(30) NOT NULL,
            contact_name    TEXT,
            last_message_at TIMESTAMPTZ,
            unread_count    INT         NOT NULL DEFAULT 0,
            contexte_type   VARCHAR(50),
            contexte_id     UUID,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE (user_id, contact_phone)
        )
    """)
    _exec("""
        CREATE INDEX IF NOT EXISTS idx_wa_conv_user
            ON whatsapp_conversations (user_id, last_message_at DESC)
    """)

    # whatsapp_messages
    _exec("""
        CREATE TABLE IF NOT EXISTS whatsapp_messages (
            id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            conversation_id UUID        NOT NULL REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
            direction       VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
            body            TEXT        NOT NULL,
            media_url       TEXT,
            status          VARCHAR(20) NOT NULL DEFAULT 'sent'
                            CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
            external_id     TEXT,
            sent_at         TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    _exec("""
        CREATE INDEX IF NOT EXISTS idx_wa_msg_conv
            ON whatsapp_messages (conversation_id, sent_at)
    """)

    # ═══════════════════════════════════════════════════════════════════════════
    # AGENT IA
    # ═══════════════════════════════════════════════════════════════════════════

    # ai_actions — actions proposées et exécutées par la Sphère IA
    _exec("""
        CREATE TABLE IF NOT EXISTS ai_actions (
            id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            session_id    TEXT,
            action_type   VARCHAR(50) NOT NULL,
            titre         TEXT,
            description   TEXT,
            urgence       VARCHAR(20) NOT NULL DEFAULT 'normale'
                          CHECK (urgence IN ('haute', 'normale', 'info')),
            payload       JSONB,
            status        VARCHAR(20) NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'executed', 'dismissed', 'expired')),
            modifications TEXT,
            executed_at   TIMESTAMPTZ,
            dismissed_at  TIMESTAMPTZ,
            expires_at    TIMESTAMPTZ,
            created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    _exec("""
        CREATE INDEX IF NOT EXISTS idx_ai_actions_user
            ON ai_actions (user_id, created_at DESC)
    """)
    _exec("""
        CREATE INDEX IF NOT EXISTS idx_ai_actions_pending
            ON ai_actions (user_id, urgence)
            WHERE status = 'pending'
    """)

    # FK différée : email_cache.ai_action_id -> ai_actions.id
    _exec("""
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'fk_email_cache_ai_action'
            ) THEN
                ALTER TABLE email_cache
                    ADD CONSTRAINT fk_email_cache_ai_action
                    FOREIGN KEY (ai_action_id) REFERENCES ai_actions(id) ON DELETE SET NULL;
            END IF;
        END $$
    """)

    # ai_user_preferences — préférences apprises (ton, style, format)
    _exec("""
        CREATE TABLE IF NOT EXISTS ai_user_preferences (
            id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id    UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            cle        VARCHAR(200) NOT NULL,
            valeur     TEXT         NOT NULL,
            hits       INT          NOT NULL DEFAULT 1,
            updated_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
            UNIQUE (user_id, cle)
        )
    """)
    _exec("""
        CREATE INDEX IF NOT EXISTS idx_ai_prefs_user
            ON ai_user_preferences (user_id)
    """)

    # ai_briefing_cache — briefing quotidien mis en cache par utilisateur
    _exec("""
        CREATE TABLE IF NOT EXISTS ai_briefing_cache (
            id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            date          DATE        NOT NULL,
            summary       TEXT,
            actions       JSONB       NOT NULL DEFAULT '[]',
            pending_count INT         NOT NULL DEFAULT 0,
            generated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
            expires_at    TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '20 hours'),
            UNIQUE (user_id, date)
        )
    """)
    _exec("""
        CREATE INDEX IF NOT EXISTS idx_briefing_cache_user
            ON ai_briefing_cache (user_id, date DESC)
    """)
    _exec("""
        CREATE INDEX IF NOT EXISTS idx_briefing_cache_expires
            ON ai_briefing_cache (expires_at)
    """)

    # ai_conversation_memory — mémoire longue durée par utilisateur / session
    _exec("""
        CREATE TABLE IF NOT EXISTS ai_conversation_memory (
            id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            session_id TEXT,
            role       VARCHAR(10) NOT NULL CHECK (role IN ('user', 'assistant')),
            content    TEXT        NOT NULL,
            tokens     INT,
            importance FLOAT       NOT NULL DEFAULT 0.5,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    _exec("""
        CREATE INDEX IF NOT EXISTS idx_conv_memory_user
            ON ai_conversation_memory (user_id, created_at DESC)
    """)
    _exec("""
        CREATE INDEX IF NOT EXISTS idx_conv_memory_session
            ON ai_conversation_memory (session_id)
            WHERE session_id IS NOT NULL
    """)

    # ═══════════════════════════════════════════════════════════════════════════
    # ONBOARDING
    # ═══════════════════════════════════════════════════════════════════════════

    # onboarding_sessions — état de l'onboarding en cours (standard / auto / invitation)
    _exec("""
        CREATE TABLE IF NOT EXISTS onboarding_sessions (
            id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id       UUID        REFERENCES users(id) ON DELETE CASCADE,
            session_token TEXT        NOT NULL UNIQUE,
            mode          VARCHAR(20) NOT NULL DEFAULT 'standard'
                          CHECK (mode IN ('standard', 'auto', 'invitation')),
            role          VARCHAR(50),
            step          INT         NOT NULL DEFAULT 1,
            data          JSONB       NOT NULL DEFAULT '{}',
            completed     BOOLEAN     NOT NULL DEFAULT FALSE,
            completed_at  TIMESTAMPTZ,
            expires_at    TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
            created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    _exec("""
        CREATE INDEX IF NOT EXISTS idx_onboarding_token
            ON onboarding_sessions (session_token)
    """)
    _exec("""
        CREATE INDEX IF NOT EXISTS idx_onboarding_user
            ON onboarding_sessions (user_id)
            WHERE user_id IS NOT NULL
    """)
    _exec("""
        CREATE INDEX IF NOT EXISTS idx_onboarding_expires
            ON onboarding_sessions (expires_at)
            WHERE completed = FALSE
    """)

    # agency_scrape_cache — données scrapées lors du smart-onboarding agence
    _exec("""
        CREATE TABLE IF NOT EXISTS agency_scrape_cache (
            id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            query        TEXT        NOT NULL,
            source_url   TEXT,
            scraped_data JSONB       NOT NULL DEFAULT '{}',
            confidence   FLOAT,
            agents_found JSONB,
            logo_url     TEXT,
            expires_at   TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
            created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    _exec("""
        CREATE INDEX IF NOT EXISTS idx_agency_scrape_query
            ON agency_scrape_cache (query)
    """)
    _exec("""
        CREATE INDEX IF NOT EXISTS idx_agency_scrape_expires
            ON agency_scrape_cache (expires_at)
    """)

    # magic_links — liens d'invitation / portail / reset à usage unique
    _exec("""
        CREATE TABLE IF NOT EXISTS magic_links (
            id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            token        TEXT        NOT NULL UNIQUE,
            type         VARCHAR(50) NOT NULL
                         CHECK (type IN ('invitation', 'portail', 'onboarding', 'reset', 'magic')),
            created_by   UUID        REFERENCES users(id) ON DELETE SET NULL,
            target_email TEXT,
            target_role  VARCHAR(50),
            payload      JSONB,
            used         BOOLEAN     NOT NULL DEFAULT FALSE,
            used_at      TIMESTAMPTZ,
            used_by      UUID        REFERENCES users(id) ON DELETE SET NULL,
            expires_at   TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
            created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    _exec("""
        CREATE INDEX IF NOT EXISTS idx_magic_links_token
            ON magic_links (token)
    """)
    _exec("""
        CREATE INDEX IF NOT EXISTS idx_magic_links_email
            ON magic_links (target_email)
            WHERE target_email IS NOT NULL
    """)
    _exec("""
        CREATE INDEX IF NOT EXISTS idx_magic_links_unused
            ON magic_links (expires_at)
            WHERE used = FALSE
    """)

    # qr_codes — QR pour portail proprio / bien / état des lieux terrain
    _exec("""
        CREATE TABLE IF NOT EXISTS qr_codes (
            id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id    UUID        REFERENCES users(id) ON DELETE CASCADE,
            code       TEXT        NOT NULL UNIQUE,
            type       VARCHAR(50) NOT NULL
                       CHECK (type IN ('portail', 'bien', 'etat_des_lieux', 'invitation')),
            payload    JSONB,
            scans      INT         NOT NULL DEFAULT 0,
            max_scans  INT,
            expires_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    _exec("""
        CREATE INDEX IF NOT EXISTS idx_qr_codes_code
            ON qr_codes (code)
    """)
    _exec("""
        CREATE INDEX IF NOT EXISTS idx_qr_codes_user
            ON qr_codes (user_id)
            WHERE user_id IS NOT NULL
    """)

    # invite_queue — file d'attente des invitations (email / SMS / WhatsApp)
    _exec("""
        CREATE TABLE IF NOT EXISTS invite_queue (
            id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            invited_by     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            target_email   TEXT        NOT NULL,
            target_role    VARCHAR(50) NOT NULL,
            target_name    TEXT,
            magic_link_id  UUID        REFERENCES magic_links(id) ON DELETE SET NULL,
            channel        VARCHAR(20) NOT NULL DEFAULT 'email'
                           CHECK (channel IN ('email', 'sms', 'whatsapp')),
            status         VARCHAR(20) NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'sent', 'accepted', 'failed')),
            sent_at        TIMESTAMPTZ,
            accepted_at    TIMESTAMPTZ,
            retry_count    INT         NOT NULL DEFAULT 0,
            created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    _exec("""
        CREATE INDEX IF NOT EXISTS idx_invite_queue_pending
            ON invite_queue (created_at)
            WHERE status = 'pending'
    """)
    _exec("""
        CREATE INDEX IF NOT EXISTS idx_invite_queue_invited_by
            ON invite_queue (invited_by)
    """)

    # ═══════════════════════════════════════════════════════════════════════════
    # NOTATION
    # ═══════════════════════════════════════════════════════════════════════════

    # notations — évaluations après chaque transaction réelle vérifiée
    _exec("""
        CREATE TABLE IF NOT EXISTS notations (
            id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            auteur_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            acteur_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            acteur_role   VARCHAR(50) NOT NULL
                          CHECK (acteur_role IN ('artisan', 'opener', 'agence', 'proprio', 'locataire', 'hunter', 'expert')),
            contexte_type VARCHAR(50) NOT NULL
                          CHECK (contexte_type IN ('intervention', 'mission', 'location', 'vente', 'livraison', 'expertise')),
            contexte_id   UUID,
            score         INT         NOT NULL CHECK (score BETWEEN 1 AND 5),
            commentaire   TEXT,
            verifie       BOOLEAN     NOT NULL DEFAULT TRUE,
            created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE (auteur_id, contexte_type, contexte_id)
        )
    """)
    _exec("""
        CREATE INDEX IF NOT EXISTS idx_notations_acteur
            ON notations (acteur_id, created_at DESC)
    """)
    _exec("""
        CREATE INDEX IF NOT EXISTS idx_notations_auteur
            ON notations (auteur_id)
    """)
    _exec("""
        CREATE INDEX IF NOT EXISTS idx_notations_contexte
            ON notations (contexte_type, contexte_id)
            WHERE contexte_id IS NOT NULL
    """)

    # notation_stats — agrégats mis à jour automatiquement par trigger
    _exec("""
        CREATE TABLE IF NOT EXISTS notation_stats (
            acteur_id        UUID  PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            note_moyenne     FLOAT NOT NULL DEFAULT 0,
            nombre_notes     INT   NOT NULL DEFAULT 0,
            derniere_note_at TIMESTAMPTZ
        )
    """)

    # Trigger function : recalcule les stats après chaque INSERT / UPDATE / DELETE
    _exec("""
        CREATE OR REPLACE FUNCTION update_notation_stats()
        RETURNS TRIGGER
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        DECLARE
            v_acteur_id UUID;
        BEGIN
            v_acteur_id := COALESCE(NEW.acteur_id, OLD.acteur_id);

            INSERT INTO notation_stats (acteur_id, note_moyenne, nombre_notes, derniere_note_at)
            SELECT
                v_acteur_id,
                ROUND(AVG(score)::numeric, 2),
                COUNT(*),
                MAX(created_at)
            FROM notations
            WHERE acteur_id = v_acteur_id
            ON CONFLICT (acteur_id) DO UPDATE SET
                note_moyenne     = EXCLUDED.note_moyenne,
                nombre_notes     = EXCLUDED.nombre_notes,
                derniere_note_at = EXCLUDED.derniere_note_at;

            RETURN NULL;
        END
        $$
    """)

    _exec("""
        DROP TRIGGER IF EXISTS trg_update_notation_stats ON notations
    """)
    _exec("""
        CREATE TRIGGER trg_update_notation_stats
            AFTER INSERT OR UPDATE OR DELETE ON notations
            FOR EACH ROW
            EXECUTE FUNCTION update_notation_stats()
    """)

    # ═══════════════════════════════════════════════════════════════════════════
    # RLS
    # ═══════════════════════════════════════════════════════════════════════════

    # user_oauth_tokens — propriétaire uniquement
    _rls("user_oauth_tokens",
        "DROP POLICY IF EXISTS owner_own_oauth ON user_oauth_tokens",
        """CREATE POLICY owner_own_oauth ON user_oauth_tokens
            FOR ALL TO authenticated
            USING (user_id = althy_current_user_id())
            WITH CHECK (user_id = althy_current_user_id())""",
    )

    # email_cache — propriétaire uniquement
    _rls("email_cache",
        "DROP POLICY IF EXISTS owner_own_email_cache ON email_cache",
        """CREATE POLICY owner_own_email_cache ON email_cache
            FOR ALL TO authenticated
            USING (user_id = althy_current_user_id())
            WITH CHECK (user_id = althy_current_user_id())""",
    )

    # whatsapp_conversations — propriétaire uniquement
    _rls("whatsapp_conversations",
        "DROP POLICY IF EXISTS owner_own_wa_conv ON whatsapp_conversations",
        """CREATE POLICY owner_own_wa_conv ON whatsapp_conversations
            FOR ALL TO authenticated
            USING (user_id = althy_current_user_id())
            WITH CHECK (user_id = althy_current_user_id())""",
    )

    # whatsapp_messages — via propriété de la conversation
    _rls("whatsapp_messages",
        "DROP POLICY IF EXISTS owner_own_wa_msg ON whatsapp_messages",
        """CREATE POLICY owner_own_wa_msg ON whatsapp_messages
            FOR ALL TO authenticated
            USING (
                conversation_id IN (
                    SELECT id FROM whatsapp_conversations
                    WHERE user_id = althy_current_user_id()
                )
            )""",
    )

    # ai_actions — propriétaire + admin
    _rls("ai_actions",
        "DROP POLICY IF EXISTS owner_own_ai_actions ON ai_actions",
        """CREATE POLICY owner_own_ai_actions ON ai_actions
            FOR ALL TO authenticated
            USING (user_id = althy_current_user_id())
            WITH CHECK (user_id = althy_current_user_id())""",
        "DROP POLICY IF EXISTS admin_all_ai_actions ON ai_actions",
        """CREATE POLICY admin_all_ai_actions ON ai_actions
            FOR ALL TO authenticated
            USING (althy_current_role() IN ('admin', 'super_admin'))""",
    )

    # ai_user_preferences — propriétaire uniquement
    _rls("ai_user_preferences",
        "DROP POLICY IF EXISTS owner_own_ai_prefs ON ai_user_preferences",
        """CREATE POLICY owner_own_ai_prefs ON ai_user_preferences
            FOR ALL TO authenticated
            USING (user_id = althy_current_user_id())
            WITH CHECK (user_id = althy_current_user_id())""",
    )

    # ai_briefing_cache — propriétaire uniquement
    _rls("ai_briefing_cache",
        "DROP POLICY IF EXISTS owner_own_briefing ON ai_briefing_cache",
        """CREATE POLICY owner_own_briefing ON ai_briefing_cache
            FOR ALL TO authenticated
            USING (user_id = althy_current_user_id())
            WITH CHECK (user_id = althy_current_user_id())""",
    )

    # ai_conversation_memory — propriétaire uniquement
    _rls("ai_conversation_memory",
        "DROP POLICY IF EXISTS owner_own_conv_memory ON ai_conversation_memory",
        """CREATE POLICY owner_own_conv_memory ON ai_conversation_memory
            FOR ALL TO authenticated
            USING (user_id = althy_current_user_id())
            WITH CHECK (user_id = althy_current_user_id())""",
    )

    # onboarding_sessions — propriétaire ou session anonyme
    _rls("onboarding_sessions",
        "DROP POLICY IF EXISTS owner_own_onboarding ON onboarding_sessions",
        """CREATE POLICY owner_own_onboarding ON onboarding_sessions
            FOR ALL TO authenticated
            USING (user_id = althy_current_user_id() OR user_id IS NULL)""",
    )

    # magic_links — créateur voit les siens / admin voit tout
    _rls("magic_links",
        "DROP POLICY IF EXISTS creator_own_magic_links ON magic_links",
        """CREATE POLICY creator_own_magic_links ON magic_links
            FOR ALL TO authenticated
            USING (created_by = althy_current_user_id())""",
        "DROP POLICY IF EXISTS admin_all_magic_links ON magic_links",
        """CREATE POLICY admin_all_magic_links ON magic_links
            FOR ALL TO authenticated
            USING (althy_current_role() IN ('admin', 'super_admin'))""",
    )

    # invite_queue — expéditeur voit les siennes / admin voit tout
    _rls("invite_queue",
        "DROP POLICY IF EXISTS owner_own_invites ON invite_queue",
        """CREATE POLICY owner_own_invites ON invite_queue
            FOR ALL TO authenticated
            USING (invited_by = althy_current_user_id())
            WITH CHECK (invited_by = althy_current_user_id())""",
        "DROP POLICY IF EXISTS admin_all_invites ON invite_queue",
        """CREATE POLICY admin_all_invites ON invite_queue
            FOR ALL TO authenticated
            USING (althy_current_role() IN ('admin', 'super_admin'))""",
    )

    # notations — INSERT/UPDATE si auteur = current_user | SELECT public (profils marketplace)
    _rls("notations",
        "DROP POLICY IF EXISTS author_insert_notation ON notations",
        """CREATE POLICY author_insert_notation ON notations
            FOR INSERT TO authenticated
            WITH CHECK (auteur_id = althy_current_user_id())""",
        "DROP POLICY IF EXISTS author_update_notation ON notations",
        """CREATE POLICY author_update_notation ON notations
            FOR UPDATE TO authenticated
            USING (auteur_id = althy_current_user_id())""",
        "DROP POLICY IF EXISTS public_read_notations ON notations",
        """CREATE POLICY public_read_notations ON notations
            FOR SELECT TO authenticated
            USING (TRUE)""",
    )

    # notation_stats — lecture publique (visible sur profils marketplace)
    # Écriture uniquement via trigger SECURITY DEFINER — pas de policy INSERT/UPDATE
    _rls("notation_stats",
        "DROP POLICY IF EXISTS public_read_notation_stats ON notation_stats",
        """CREATE POLICY public_read_notation_stats ON notation_stats
            FOR SELECT TO authenticated
            USING (TRUE)""",
    )


# ── DOWNGRADE ─────────────────────────────────────────────────────────────────

def downgrade() -> None:
    # Triggers
    _exec("DROP TRIGGER IF EXISTS trg_update_notation_stats ON notations")
    _exec("DROP FUNCTION IF EXISTS update_notation_stats()")

    # Notation
    _exec("DROP TABLE IF EXISTS notation_stats CASCADE")
    _exec("DROP TABLE IF EXISTS notations CASCADE")

    # Onboarding
    _exec("DROP TABLE IF EXISTS invite_queue CASCADE")
    _exec("DROP TABLE IF EXISTS qr_codes CASCADE")
    _exec("DROP TABLE IF EXISTS magic_links CASCADE")
    _exec("DROP TABLE IF EXISTS agency_scrape_cache CASCADE")
    _exec("DROP TABLE IF EXISTS onboarding_sessions CASCADE")

    # Agent IA
    _exec("DROP TABLE IF EXISTS ai_conversation_memory CASCADE")
    _exec("DROP TABLE IF EXISTS ai_briefing_cache CASCADE")
    _exec("DROP TABLE IF EXISTS ai_user_preferences CASCADE")
    _exec("DROP TABLE IF EXISTS ai_actions CASCADE")

    # Communication
    _exec("DROP TABLE IF EXISTS whatsapp_messages CASCADE")
    _exec("DROP TABLE IF EXISTS whatsapp_conversations CASCADE")
    _exec("DROP TABLE IF EXISTS calendar_events CASCADE")
    _exec("DROP TABLE IF EXISTS email_cache CASCADE")
    _exec("DROP TABLE IF EXISTS user_oauth_tokens CASCADE")
