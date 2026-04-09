-- ═══════════════════════════════════════════════════════════════════════════
-- 007_integrations.sql — table integrations + chiffrement tokens + RLS
-- Stocke les tokens OAuth2 des intégrations tierces chiffrés via pgcrypto.
-- ⚠️  Les tokens ne sont JAMAIS stockés en clair.
--     Clé de chiffrement : current_setting('app.token_key', true)
--     À définir dans Supabase → Project Settings → Database → Custom config :
--       ALTER DATABASE postgres SET app.token_key = '<secret-64-chars>';
-- ═══════════════════════════════════════════════════════════════════════════

-- pgcrypto est requis pour pgp_sym_encrypt / pgp_sym_decrypt
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Table integrations ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS integrations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- ── Fournisseur ───────────────────────────────────────────────────────
    provider        VARCHAR(30) NOT NULL,
    -- Email : gmail | outlook
    -- Calendrier : google_calendar | outlook_calendar
    -- Messagerie : whatsapp
    -- Portails : homegate | immoscout24 | comparis | anibis | newhome | airbnb
    -- Réseaux : instagram | facebook | linkedin | tiktok
    provider_account_id VARCHAR(200),
    -- ID du compte tiers (ex: adresse Gmail, ID portail)

    -- ── Tokens OAuth2 chiffrés ────────────────────────────────────────────
    -- Chiffrés avec pgp_sym_encrypt(token, current_setting('app.token_key'))
    -- Déchiffrés avec pgp_sym_decrypt(enc_token, current_setting('app.token_key'))
    access_token_enc    BYTEA,
    refresh_token_enc   BYTEA,
    token_expires_at    TIMESTAMPTZ,

    -- ── Autorisations accordées ───────────────────────────────────────────
    scopes          TEXT[],
    -- Ex: ['https://www.googleapis.com/auth/gmail.send', 'calendar.readonly']

    -- ── Configuration spécifique au portail/service ───────────────────────
    -- Pour portails : { "listing_type": "rent|sale", "api_key": null,
    --                   "auto_publish": true, "portal_username": "..." }
    -- Pour calendriers : { "sync_direction": "read|write|both",
    --                      "calendar_id": "primary" }
    config          JSONB       NOT NULL DEFAULT '{}',

    -- ── État ──────────────────────────────────────────────────────────────
    is_connected    BOOLEAN     NOT NULL DEFAULT false,
    connected_at    TIMESTAMPTZ,
    disconnected_at TIMESTAMPTZ,
    last_sync_at    TIMESTAMPTZ,
    last_error      TEXT,
    -- Dernière erreur OAuth (token expiré, révoqué, etc.)

    -- ── Métadonnées libres ────────────────────────────────────────────────
    metadata        JSONB       NOT NULL DEFAULT '{}',
    -- Ex: { "email": "user@gmail.com", "display_name": "Jean Dupont" }

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Un utilisateur ne peut avoir qu'une intégration par fournisseur
    CONSTRAINT uq_integrations_user_provider UNIQUE (user_id, provider)
);

-- ── Index ─────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS ix_integrations_user_id
    ON integrations(user_id);
CREATE INDEX IF NOT EXISTS ix_integrations_provider
    ON integrations(provider);
CREATE INDEX IF NOT EXISTS ix_integrations_connected
    ON integrations(user_id, is_connected);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_integrations_updated_at ON integrations;
CREATE TRIGGER trg_integrations_updated_at
    BEFORE UPDATE ON integrations
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Fonctions de chiffrement/déchiffrement ────────────────────────────────────
-- Ces fonctions s'exécutent en SECURITY DEFINER pour accéder à la clé.
-- Le frontend ne reçoit JAMAIS les tokens déchiffrés — uniquement le backend
-- (via service_role) les déchiffre pour appeler les APIs tierces.

CREATE OR REPLACE FUNCTION public.encrypt_token(p_token TEXT)
RETURNS BYTEA
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_key TEXT;
BEGIN
    v_key := current_setting('app.token_key', true);
    IF v_key IS NULL OR v_key = '' THEN
        RAISE EXCEPTION 'app.token_key not configured';
    END IF;
    RETURN pgp_sym_encrypt(p_token, v_key);
END;
$$;

CREATE OR REPLACE FUNCTION public.decrypt_token(p_enc BYTEA)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_key TEXT;
BEGIN
    v_key := current_setting('app.token_key', true);
    IF v_key IS NULL OR v_key = '' THEN
        RAISE EXCEPTION 'app.token_key not configured';
    END IF;
    IF p_enc IS NULL THEN RETURN NULL; END IF;
    RETURN pgp_sym_decrypt(p_enc, v_key);
END;
$$;

-- ── Fonction upsert_integration ───────────────────────────────────────────────
-- Appelée par le backend (service_role) après un callback OAuth2.
-- Chiffre les tokens avant stockage.
CREATE OR REPLACE FUNCTION public.upsert_integration(
    p_user_id           UUID,
    p_provider          VARCHAR,
    p_provider_account  VARCHAR,
    p_access_token      TEXT,
    p_refresh_token     TEXT,
    p_token_expires_at  TIMESTAMPTZ,
    p_scopes            TEXT[],
    p_config            JSONB DEFAULT '{}',
    p_metadata          JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO public.integrations (
        user_id, provider, provider_account_id,
        access_token_enc, refresh_token_enc, token_expires_at,
        scopes, config, metadata,
        is_connected, connected_at
    ) VALUES (
        p_user_id, p_provider, p_provider_account,
        public.encrypt_token(p_access_token),
        public.encrypt_token(p_refresh_token),
        p_token_expires_at,
        p_scopes, p_config, p_metadata,
        true, now()
    )
    ON CONFLICT (user_id, provider) DO UPDATE SET
        provider_account_id = EXCLUDED.provider_account_id,
        access_token_enc    = EXCLUDED.access_token_enc,
        refresh_token_enc   = EXCLUDED.refresh_token_enc,
        token_expires_at    = EXCLUDED.token_expires_at,
        scopes              = EXCLUDED.scopes,
        config              = public.integrations.config || EXCLUDED.config,
        metadata            = EXCLUDED.metadata,
        is_connected        = true,
        connected_at        = COALESCE(public.integrations.connected_at, now()),
        disconnected_at     = NULL,
        last_error          = NULL,
        updated_at          = now()
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;

-- ── Vue sécurisée (sans tokens) ───────────────────────────────────────────────
-- Exposée au frontend via l'API Supabase — les tokens chiffrés sont exclus.
CREATE OR REPLACE VIEW integrations_safe AS
SELECT
    id,
    user_id,
    provider,
    provider_account_id,
    scopes,
    config,
    metadata,
    is_connected,
    connected_at,
    disconnected_at,
    last_sync_at,
    -- Expose uniquement si le token est expiré (pour forcer re-auth)
    CASE
        WHEN token_expires_at IS NOT NULL AND token_expires_at < now()
        THEN true ELSE false
    END AS token_expired,
    created_at,
    updated_at
FROM integrations;

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations FORCE ROW LEVEL SECURITY;

-- SELECT : l'utilisateur voit uniquement ses propres intégrations
-- ⚠️  Même avec RLS, access_token_enc/refresh_token_enc sont des BYTEA chiffrés.
--     Le frontend doit utiliser la vue integrations_safe qui les exclut.
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'integrations' AND policyname = 'integrations_select_self'
    ) THEN
        CREATE POLICY integrations_select_self ON integrations
            FOR SELECT USING (user_id = auth.uid());
    END IF;
END $$;

-- INSERT : l'utilisateur insère uniquement pour lui-même
-- (En pratique, l'insertion passe par upsert_integration en service_role)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'integrations' AND policyname = 'integrations_insert_self'
    ) THEN
        CREATE POLICY integrations_insert_self ON integrations
            FOR INSERT WITH CHECK (user_id = auth.uid());
    END IF;
END $$;

-- UPDATE : l'utilisateur peut mettre à jour uniquement ses propres intégrations
-- (config, metadata — pas les tokens qui passent par upsert_integration)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'integrations' AND policyname = 'integrations_update_self'
    ) THEN
        CREATE POLICY integrations_update_self ON integrations
            FOR UPDATE USING (user_id = auth.uid())
                       WITH CHECK (user_id = auth.uid());
    END IF;
END $$;

-- DELETE : l'utilisateur peut supprimer (déconnecter) ses propres intégrations
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'integrations' AND policyname = 'integrations_delete_self'
    ) THEN
        CREATE POLICY integrations_delete_self ON integrations
            FOR DELETE USING (user_id = auth.uid());
    END IF;
END $$;
