-- ═══════════════════════════════════════════════════════════════════════════
-- 006_consents.sql — table consents + RLS (insert only)
-- Registre immuable des consentements — conformité LPD suisse + RGPD
-- ⚠️  Pas d'UPDATE ni de DELETE autorisés : l'historique est sacré.
--     Pour révoquer un consentement, insérer une nouvelle ligne
--     avec accepted = false.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS consents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- ── Type de consentement ──────────────────────────────────────────────
    consent_type    VARCHAR(30) NOT NULL,
    -- cgu              : Conditions Générales d'Utilisation
    -- marketing        : Communications commerciales
    -- dossier_fee      : Frais de dossier CHF 90 (locataires)
    -- analytics        : Cookies analytiques (PostHog, Sentry)
    -- cookies_all      : Acceptation globale cookies
    -- data_processing  : Traitement données (art. 6.1.a RGPD)

    -- ── Décision ──────────────────────────────────────────────────────────
    accepted        BOOLEAN     NOT NULL,
    -- true = consentement accordé, false = consentement retiré

    -- ── Version du document consenti (pour CGU) ───────────────────────────
    version         VARCHAR(20),
    -- Ex: "2026-04" pour la version d'avril 2026

    -- ── Contexte technique (preuve) ───────────────────────────────────────
    consented_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip_address      INET,
    -- Adresse IP au moment du consentement (anonymisée si besoin)
    user_agent      TEXT,
    -- User-Agent navigateur (preuve du contexte technique)

    -- ── Contexte fonctionnel ──────────────────────────────────────────────
    source          VARCHAR(50),
    -- register_form | cookie_banner | settings_page | dossier_modal | api
    metadata        JSONB       NOT NULL DEFAULT '{}',
    -- Données contextuelles libres (ex: { "property_id": "...", "amount": 90 })

    -- Pas de updated_at : la ligne est immuable après insertion
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Index ─────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS ix_consents_user_id
    ON consents(user_id);
CREATE INDEX IF NOT EXISTS ix_consents_type_user
    ON consents(user_id, consent_type, consented_at DESC);
-- Requête fréquente : "dernier consentement CGU de l'utilisateur X"
CREATE INDEX IF NOT EXISTS ix_consents_consented_at
    ON consents(consented_at DESC);

-- ── Vue helper : dernier état de chaque consentement par utilisateur ──────────
-- Utilisée par le backend pour vérifier si un user a accepté les CGU en vigueur.
CREATE OR REPLACE VIEW consents_latest AS
SELECT DISTINCT ON (user_id, consent_type)
    id,
    user_id,
    consent_type,
    accepted,
    version,
    consented_at,
    source
FROM consents
ORDER BY user_id, consent_type, consented_at DESC;

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE consents FORCE ROW LEVEL SECURITY;

-- SELECT : l'utilisateur voit uniquement ses propres consentements
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'consents' AND policyname = 'consents_select_self'
    ) THEN
        CREATE POLICY consents_select_self ON consents
            FOR SELECT USING (user_id = auth.uid());
    END IF;
END $$;

-- INSERT : l'utilisateur insère uniquement pour lui-même
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'consents' AND policyname = 'consents_insert_self'
    ) THEN
        CREATE POLICY consents_insert_self ON consents
            FOR INSERT WITH CHECK (user_id = auth.uid());
    END IF;
END $$;

-- UPDATE : interdit pour tous (registre immuable)
-- Pas de policy UPDATE → aucun utilisateur (y compris le propriétaire) ne peut
-- modifier un enregistrement de consentement existant.

-- DELETE : interdit pour tous (registre immuable)
-- Pas de policy DELETE → suppression impossible, même par le propriétaire.
-- La suppression du compte (CASCADE sur auth.users) efface les consentements
-- uniquement lors de l'exercice du droit à l'effacement RGPD art. 17.

-- ── Fonction helper : enregistrer un consentement ────────────────────────────
-- Appelée par le backend (service role) pour garantir l'enregistrement même
-- si le client n'est plus connecté au moment de la validation.
CREATE OR REPLACE FUNCTION public.record_consent(
    p_user_id       UUID,
    p_type          VARCHAR,
    p_accepted      BOOLEAN,
    p_version       VARCHAR    DEFAULT NULL,
    p_source        VARCHAR    DEFAULT 'api',
    p_ip            INET       DEFAULT NULL,
    p_user_agent    TEXT       DEFAULT NULL,
    p_metadata      JSONB      DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO public.consents (
        user_id, consent_type, accepted, version,
        source, ip_address, user_agent, metadata
    ) VALUES (
        p_user_id, p_type, p_accepted, p_version,
        p_source, p_ip, p_user_agent, p_metadata
    )
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;
