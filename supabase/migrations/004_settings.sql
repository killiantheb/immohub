-- ═══════════════════════════════════════════════════════════════════════════
-- 004_settings.sql — table user_settings + RLS
-- Préférences utilisateur : UI, notifications, comptabilité, facturation
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_settings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

    -- ── Identité & localisation ───────────────────────────────────────────
    language        VARCHAR(5)   NOT NULL DEFAULT 'fr',
    -- fr | de | en | it
    timezone        VARCHAR(50)  NOT NULL DEFAULT 'Europe/Zurich',
    currency        VARCHAR(3)   NOT NULL DEFAULT 'CHF',
    -- CHF | EUR

    -- ── Notifications — canaux ────────────────────────────────────────────
    notif_push      BOOLEAN      NOT NULL DEFAULT true,
    notif_email     BOOLEAN      NOT NULL DEFAULT true,
    notif_sms       BOOLEAN      NOT NULL DEFAULT false,
    notif_whatsapp  BOOLEAN      NOT NULL DEFAULT false,

    -- ── Notifications — événements (JSONB) ───────────────────────────────
    -- Structure : { "loyer_retard": { enabled: true, delay_days: 1 },
    --              "bail_echeance": { enabled: true, days_before: 90 },
    --              "mission_new": { enabled: true },
    --              "devis_recu": { enabled: true },
    --              "message_new": { enabled: true },
    --              "briefing_ia": { enabled: false, hour: 8 } }
    notif_events    JSONB        NOT NULL DEFAULT '{
        "loyer_retard":   {"enabled": true,  "delay_days": 1},
        "bail_echeance":  {"enabled": true,  "days_before": 90},
        "mission_new":    {"enabled": true},
        "devis_recu":     {"enabled": true},
        "message_new":    {"enabled": true},
        "briefing_ia":    {"enabled": false, "hour": 8}
    }',

    -- ── Comptabilité ──────────────────────────────────────────────────────
    fiscal_year_start   VARCHAR(5)  NOT NULL DEFAULT '01-01',
    -- Format MM-DD (ex: 01-01 = 1er janvier, 07-01 = 1er juillet)
    invoice_conditions  TEXT        DEFAULT 'Paiement à 30 jours. En cas de retard, des intérêts de 5% l''an seront facturés.',
    expense_categories  JSONB       NOT NULL DEFAULT '["maintenance","réparation","assurance","impôts","hypothèque","charges","autre"]',
    auto_export         BOOLEAN     NOT NULL DEFAULT false,
    auto_export_email   VARCHAR(200),
    auto_export_format  VARCHAR(10) NOT NULL DEFAULT 'pdf',
    -- pdf | excel | csv

    -- ── Paiements (marketplace : openers, artisans, experts) ─────────────
    iban                VARCHAR(34),
    bic                 VARCHAR(11),
    bank_name           VARCHAR(200),
    payout_frequency    VARCHAR(20) NOT NULL DEFAULT 'monthly',
    -- weekly | biweekly | monthly
    payout_min_chf      NUMERIC(8,2) NOT NULL DEFAULT 50,
    billing_mode        VARCHAR(20) NOT NULL DEFAULT 'auto',
    -- auto | manual

    -- ── Facturation (proprio/agence) ──────────────────────────────────────
    rental_iban         VARCHAR(34),
    rental_groupement   VARCHAR(200),
    -- Libellé virement locataire (ex: "Loyer [adresse]")
    rental_libelle      VARCHAR(300),

    -- ── Dashboard UI ──────────────────────────────────────────────────────
    dashboard_layout    VARCHAR(20) NOT NULL DEFAULT 'default',
    -- default | compact | expanded
    sidebar_collapsed   BOOLEAN     NOT NULL DEFAULT false,
    default_map_zoom    INTEGER     NOT NULL DEFAULT 12,

    -- ── Disponibilité (marketplace) ───────────────────────────────────────
    -- Structure : { "lun": ["matin","aprem"], "mar": ["matin"], ... }
    -- Jours : lun | mar | mer | jeu | ven | sam | dim
    -- Créneaux : matin | aprem | soir
    availability        JSONB       NOT NULL DEFAULT '{}',
    notice_period_days  INTEGER     NOT NULL DEFAULT 2,
    max_missions_week   INTEGER     NOT NULL DEFAULT 10,
    hourly_rate_chf     NUMERIC(8,2),
    vacation_mode       BOOLEAN     NOT NULL DEFAULT false,
    vacation_from       DATE,
    vacation_until      DATE,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index
CREATE INDEX IF NOT EXISTS ix_user_settings_user_id ON user_settings(user_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_settings_updated_at ON user_settings;
CREATE TRIGGER trg_user_settings_updated_at
    BEFORE UPDATE ON user_settings
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger : créer user_settings automatiquement à l'inscription
CREATE OR REPLACE FUNCTION public.handle_new_user_settings()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO public.user_settings (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_settings ON auth.users;
CREATE TRIGGER on_auth_user_created_settings
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_settings();

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings FORCE ROW LEVEL SECURITY;

-- SELECT : l'utilisateur voit uniquement ses propres paramètres
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'user_settings' AND policyname = 'user_settings_select_self'
    ) THEN
        CREATE POLICY user_settings_select_self ON user_settings
            FOR SELECT USING (user_id = auth.uid());
    END IF;
END $$;

-- INSERT : l'utilisateur insère uniquement pour lui-même
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'user_settings' AND policyname = 'user_settings_insert_self'
    ) THEN
        CREATE POLICY user_settings_insert_self ON user_settings
            FOR INSERT WITH CHECK (user_id = auth.uid());
    END IF;
END $$;

-- UPDATE : l'utilisateur modifie uniquement ses propres paramètres
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'user_settings' AND policyname = 'user_settings_update_self'
    ) THEN
        CREATE POLICY user_settings_update_self ON user_settings
            FOR UPDATE USING (user_id = auth.uid())
                      WITH CHECK (user_id = auth.uid());
    END IF;
END $$;

-- DELETE : interdit (soft delete via is_active si besoin dans d'autres tables)
-- Pas de policy DELETE → aucun utilisateur ne peut supprimer ses settings
