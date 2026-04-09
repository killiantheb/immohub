-- ═══════════════════════════════════════════════════════════════════════════
-- Althy — Schéma Supabase complet (18 tables)
-- Exécuter dans l'ordre dans l'éditeur SQL Supabase
-- RLS activé sur toutes les tables
-- ═══════════════════════════════════════════════════════════════════════════

-- Extensions nécessaires
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── 1. users ─────────────────────────────────────────────────────────────────
-- Géré par Supabase Auth (auth.users). On crée une vue publique.
-- La table auth.users existe déjà — on utilise un trigger pour créer le profil.

-- ── 2. profiles ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    role                VARCHAR(30)  NOT NULL DEFAULT 'proprio_solo',
    -- Rôles : proprio_solo | agence | portail_proprio | opener | artisan |
    --         expert | hunter | locataire | acheteur_premium
    first_name          VARCHAR(100),
    last_name           VARCHAR(100),
    phone               VARCHAR(30),
    avatar_url          TEXT,
    bio                 TEXT,
    address             VARCHAR(300),
    city                VARCHAR(100),
    zip_code            VARCHAR(10),
    country             VARCHAR(2)   NOT NULL DEFAULT 'CH',
    canton              VARCHAR(2),
    timezone            VARCHAR(50)  NOT NULL DEFAULT 'Europe/Zurich',
    language            VARCHAR(5)   NOT NULL DEFAULT 'fr',
    preferences         JSONB        NOT NULL DEFAULT '{}',
    stripe_customer_id  VARCHAR(100),
    stripe_account_id   VARCHAR(100), -- Stripe Connect account id (pour virements)
    onboarding_done     BOOLEAN      NOT NULL DEFAULT false,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS ix_profiles_role    ON profiles(role);

-- Trigger : créer un profil automatiquement à l'inscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, role)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'role', 'proprio_solo'))
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 3. properties ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS properties (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    agency_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name            VARCHAR(200) NOT NULL,
    address         VARCHAR(300) NOT NULL,
    city            VARCHAR(100) NOT NULL,
    zip_code        VARCHAR(10),
    canton          VARCHAR(2),
    country         VARCHAR(2)   NOT NULL DEFAULT 'CH',
    lat             FLOAT,
    lng             FLOAT,
    property_type   VARCHAR(30)  NOT NULL DEFAULT 'apartment',
    -- apartment | house | studio | commercial | parking | land | garage
    rooms           FLOAT,
    surface_m2      FLOAT,
    floor           INTEGER,
    total_floors    INTEGER,
    build_year      INTEGER,
    description     TEXT,
    notes           TEXT,
    monthly_rent    NUMERIC(10,2),
    purchase_price  NUMERIC(12,2),
    estimated_value NUMERIC(12,2),
    features        JSONB        NOT NULL DEFAULT '{}',
    -- { elevator, parking, cellar, balcony, garden, ... }
    photos          JSONB        NOT NULL DEFAULT '[]',
    status          VARCHAR(20)  NOT NULL DEFAULT 'active',
    -- active | rented | for_sale | sold | vacant
    is_active       BOOLEAN      NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_properties_owner_id ON properties(owner_id);
CREATE INDEX IF NOT EXISTS ix_properties_status   ON properties(status);
CREATE INDEX IF NOT EXISTS ix_properties_city     ON properties(city);

-- ── 4. tenants ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    property_id     UUID REFERENCES properties(id) ON DELETE SET NULL,
    user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    -- Rempli si le locataire a un compte Althy
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    email           VARCHAR(200),
    phone           VARCHAR(30),
    id_verified     BOOLEAN      NOT NULL DEFAULT false,
    income_chf      NUMERIC(10,2),
    credit_score    INTEGER,      -- 1-100
    scoring_data    JSONB        NOT NULL DEFAULT '{}',
    -- Données scoring : emploi, revenus, historique, etc.
    status          VARCHAR(20)  NOT NULL DEFAULT 'candidate',
    -- candidate | selected | active | former
    application_fee_paid BOOLEAN NOT NULL DEFAULT false,
    -- CHF 90 dossier — false jusqu'à la sélection
    stripe_setup_intent  VARCHAR(100),
    -- SetupIntent créé à l'inscription, déclenché à la sélection
    notes           TEXT,
    is_active       BOOLEAN      NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_tenants_owner_id    ON tenants(owner_id);
CREATE INDEX IF NOT EXISTS ix_tenants_property_id ON tenants(property_id);
CREATE INDEX IF NOT EXISTS ix_tenants_status      ON tenants(status);

-- ── 5. leases ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leases (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id         UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    tenant_id           UUID NOT NULL REFERENCES tenants(id)    ON DELETE RESTRICT,
    owner_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    monthly_rent        NUMERIC(10,2) NOT NULL,
    charges             NUMERIC(8,2)  NOT NULL DEFAULT 0,
    deposit_amount      NUMERIC(10,2),
    deposit_paid        BOOLEAN       NOT NULL DEFAULT false,
    start_date          DATE          NOT NULL,
    end_date            DATE,
    is_open_ended       BOOLEAN       NOT NULL DEFAULT true,
    notice_period_days  INTEGER       NOT NULL DEFAULT 90,
    lease_type          VARCHAR(20)   NOT NULL DEFAULT 'residential',
    -- residential | commercial | furnished | seasonal
    payment_day         INTEGER       NOT NULL DEFAULT 1,
    -- Jour du mois pour le prélèvement (1-28)
    iban                VARCHAR(34),
    stripe_mandate_id   VARCHAR(100),
    bail_provider       VARCHAR(30),
    -- firstcaution | swisscaution | cash
    bail_reference      VARCHAR(100),
    indexation          BOOLEAN       NOT NULL DEFAULT true,
    indexation_index    VARCHAR(20)   NOT NULL DEFAULT 'IPC',
    notes               TEXT,
    pdf_url             TEXT,
    status              VARCHAR(20)   NOT NULL DEFAULT 'active',
    -- draft | active | terminated | expired
    is_active           BOOLEAN       NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_leases_property_id ON leases(property_id);
CREATE INDEX IF NOT EXISTS ix_leases_tenant_id   ON leases(tenant_id);
CREATE INDEX IF NOT EXISTS ix_leases_owner_id    ON leases(owner_id);
CREATE INDEX IF NOT EXISTS ix_leases_status      ON leases(status);

-- ── 6. transactions (loyers & paiements) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lease_id            UUID REFERENCES leases(id) ON DELETE SET NULL,
    property_id         UUID REFERENCES properties(id) ON DELETE SET NULL,
    tenant_id           UUID REFERENCES tenants(id)   ON DELETE SET NULL,
    owner_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount              NUMERIC(10,2) NOT NULL,
    -- Montant total prélevé au locataire
    net_amount          NUMERIC(10,2),
    -- Montant reçu par le propriétaire (après 4% Althy)
    platform_fee        NUMERIC(8,2),
    -- 4% Althy (jamais appelé "commission" dans l'UI)
    currency            VARCHAR(3)   NOT NULL DEFAULT 'CHF',
    type                VARCHAR(20)  NOT NULL DEFAULT 'rent',
    -- rent | deposit | application_fee | refund | expense
    period_month        VARCHAR(7),
    -- Format YYYY-MM
    due_date            DATE,
    paid_date           DATE,
    status              VARCHAR(20)  NOT NULL DEFAULT 'pending',
    -- pending | paid | late | failed | refunded
    stripe_payment_intent_id VARCHAR(100),
    stripe_transfer_id       VARCHAR(100),
    stripe_charge_id         VARCHAR(100),
    failure_reason      TEXT,
    notes               TEXT,
    is_active           BOOLEAN      NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_transactions_owner_id     ON transactions(owner_id);
CREATE INDEX IF NOT EXISTS ix_transactions_lease_id     ON transactions(lease_id);
CREATE INDEX IF NOT EXISTS ix_transactions_status       ON transactions(status);
CREATE INDEX IF NOT EXISTS ix_transactions_period_month ON transactions(period_month);
CREATE INDEX IF NOT EXISTS ix_transactions_due_date     ON transactions(due_date);

-- ── 7. documents ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    property_id     UUID REFERENCES properties(id) ON DELETE SET NULL,
    lease_id        UUID REFERENCES leases(id)     ON DELETE SET NULL,
    tenant_id       UUID REFERENCES tenants(id)    ON DELETE SET NULL,
    title           VARCHAR(300) NOT NULL,
    doc_type        VARCHAR(50)  NOT NULL,
    -- lease | quittance | etat_lieux_entree | etat_lieux_sortie |
    -- relance_1 | relance_2 | relance_3 | dossier_vendeur | autre
    content         TEXT,
    -- Texte brut pour recherche/preview
    pdf_url         TEXT,
    -- URL Supabase Storage
    variables       JSONB        NOT NULL DEFAULT '{}',
    -- Variables de fusion utilisées pour la génération
    disclaimer      TEXT         NOT NULL DEFAULT
        'Document généré automatiquement à titre indicatif. À faire valider par un professionnel si nécessaire.',
    generated_by_ai BOOLEAN      NOT NULL DEFAULT true,
    is_signed       BOOLEAN      NOT NULL DEFAULT false,
    signed_at       TIMESTAMPTZ,
    is_active       BOOLEAN      NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_documents_owner_id    ON documents(owner_id);
CREATE INDEX IF NOT EXISTS ix_documents_property_id ON documents(property_id);
CREATE INDEX IF NOT EXISTS ix_documents_lease_id    ON documents(lease_id);
CREATE INDEX IF NOT EXISTS ix_documents_doc_type    ON documents(doc_type);

-- ── 8. expenses (charges & dépenses) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    property_id     UUID REFERENCES properties(id) ON DELETE SET NULL,
    title           VARCHAR(200) NOT NULL,
    amount          NUMERIC(10,2) NOT NULL,
    currency        VARCHAR(3)   NOT NULL DEFAULT 'CHF',
    category        VARCHAR(50),
    -- maintenance | repair | insurance | tax | mortgage | utilities | other
    oblf_code       VARCHAR(20),
    -- Code OBLF suisse pour déduction fiscale
    date            DATE         NOT NULL,
    supplier        VARCHAR(200),
    invoice_url     TEXT,
    -- URL scan facture Supabase Storage
    ocr_data        JSONB        NOT NULL DEFAULT '{}',
    -- Données extraites par OCR
    notes           TEXT,
    is_active       BOOLEAN      NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_expenses_owner_id    ON expenses(owner_id);
CREATE INDEX IF NOT EXISTS ix_expenses_property_id ON expenses(property_id);
CREATE INDEX IF NOT EXISTS ix_expenses_date        ON expenses(date DESC);
CREATE INDEX IF NOT EXISTS ix_expenses_category    ON expenses(category);

-- ── 9. interventions ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS interventions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    property_id     UUID REFERENCES properties(id) ON DELETE SET NULL,
    artisan_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    title           VARCHAR(200) NOT NULL,
    description     TEXT,
    category        VARCHAR(50),
    -- plomberie | electricite | peinture | menuiserie | chauffage | autre
    priority        VARCHAR(10)  NOT NULL DEFAULT 'normal',
    -- urgent | normal | low
    status          VARCHAR(20)  NOT NULL DEFAULT 'open',
    -- open | in_progress | done | cancelled
    scheduled_at    TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    amount_paid     NUMERIC(10,2),
    platform_fee    NUMERIC(8,2),
    -- 10% Althy sur artisans
    photos          JSONB        NOT NULL DEFAULT '[]',
    notes           TEXT,
    is_active       BOOLEAN      NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_interventions_owner_id    ON interventions(owner_id);
CREATE INDEX IF NOT EXISTS ix_interventions_property_id ON interventions(property_id);
CREATE INDEX IF NOT EXISTS ix_interventions_status      ON interventions(status);

-- ── 10. quotes (devis artisans) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quotes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    intervention_id UUID NOT NULL REFERENCES interventions(id) ON DELETE CASCADE,
    artisan_id      UUID NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,
    owner_id        UUID NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,
    amount          NUMERIC(10,2) NOT NULL,
    breakdown       JSONB        NOT NULL DEFAULT '{}',
    -- { materials: X, labor: Y, ... }
    ai_analysis     TEXT,
    -- Analyse IA du devis (comparaison, recommandation)
    ai_recommended  BOOLEAN      NOT NULL DEFAULT false,
    status          VARCHAR(20)  NOT NULL DEFAULT 'pending',
    -- pending | accepted | rejected | expired
    valid_until     DATE,
    notes           TEXT,
    pdf_url         TEXT,
    is_active       BOOLEAN      NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_quotes_intervention_id ON quotes(intervention_id);
CREATE INDEX IF NOT EXISTS ix_quotes_artisan_id      ON quotes(artisan_id);
CREATE INDEX IF NOT EXISTS ix_quotes_status          ON quotes(status);

-- ── 11. missions (openers) ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS missions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    opener_id       UUID REFERENCES auth.users(id)          ON DELETE SET NULL,
    property_id     UUID REFERENCES properties(id)          ON DELETE SET NULL,
    title           VARCHAR(200) NOT NULL,
    description     TEXT,
    mission_type    VARCHAR(30)  NOT NULL DEFAULT 'visit',
    -- visit | key_handover | inspection | photography | other
    status          VARCHAR(20)  NOT NULL DEFAULT 'open',
    -- open | assigned | done | cancelled
    scheduled_at    TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    lat             FLOAT,
    lng             FLOAT,
    radius_km       FLOAT        NOT NULL DEFAULT 10,
    fee_chf         NUMERIC(8,2),
    -- Rémunération opener (15% commission Althy déduite automatiquement)
    platform_fee    NUMERIC(6,2),
    stripe_transfer_id VARCHAR(100),
    notes           TEXT,
    is_active       BOOLEAN      NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_missions_owner_id    ON missions(owner_id);
CREATE INDEX IF NOT EXISTS ix_missions_opener_id   ON missions(opener_id);
CREATE INDEX IF NOT EXISTS ix_missions_status      ON missions(status);
CREATE INDEX IF NOT EXISTS ix_missions_lat_lng     ON missions(lat, lng);

-- ── 12. listings (annonces portails) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS listings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id     UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    title           VARCHAR(300) NOT NULL,
    description     TEXT,
    price           NUMERIC(12,2),
    portals         JSONB        NOT NULL DEFAULT '{}',
    -- { listing_type, monthly_rent, sale_price, on_homegate, on_immoscout,
    --   on_booking, on_airbnb, homegate_id, immoscout_id, ... }
    status          VARCHAR(20)  NOT NULL DEFAULT 'draft',
    -- draft | published | paused | expired | sold | rented
    views           INTEGER      NOT NULL DEFAULT 0,
    leads_count     INTEGER      NOT NULL DEFAULT 0,
    published_at    TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,
    description_ai  TEXT,
    photos          JSONB        NOT NULL DEFAULT '[]',
    is_active       BOOLEAN      NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_listings_property_id ON listings(property_id);
CREATE INDEX IF NOT EXISTS ix_listings_status      ON listings(status);

-- ── 13. offers (offres acheteurs/locataires) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS offers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id      UUID NOT NULL REFERENCES listings(id)    ON DELETE CASCADE,
    buyer_id        UUID NOT NULL REFERENCES auth.users(id)  ON DELETE CASCADE,
    amount          NUMERIC(12,2) NOT NULL,
    message         TEXT,
    status          VARCHAR(20)  NOT NULL DEFAULT 'pending',
    -- pending | accepted | rejected | countered
    counter_amount  NUMERIC(12,2),
    counter_message TEXT,
    expires_at      TIMESTAMPTZ,
    responded_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_offers_listing_id ON offers(listing_id);
CREATE INDEX IF NOT EXISTS ix_offers_buyer_id   ON offers(buyer_id);
CREATE INDEX IF NOT EXISTS ix_offers_status     ON offers(status);

-- ── 14. partners (partenaires) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS partners (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(200) NOT NULL,
    category        VARCHAR(50)  NOT NULL,
    -- insurance | bail | energy | internet | moving | notary | other
    description     TEXT,
    logo_url        TEXT,
    website         TEXT,
    contact_email   VARCHAR(200),
    contact_phone   VARCHAR(30),
    commission_pct  NUMERIC(5,2) NOT NULL DEFAULT 0,
    commission_flat NUMERIC(8,2) NOT NULL DEFAULT 0,
    tracking_url    TEXT,
    contract_signed BOOLEAN      NOT NULL DEFAULT false,
    -- CHF 90 : UNIQUEMENT si accord de distribution formel signé
    is_active       BOOLEAN      NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_partners_category  ON partners(category);
CREATE INDEX IF NOT EXISTS ix_partners_is_active ON partners(is_active);

-- ── 15. hunters (leads off-market) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hunters (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hunter_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    address         VARCHAR(300) NOT NULL,
    city            VARCHAR(100) NOT NULL,
    zip_code        VARCHAR(10),
    description     TEXT,
    estimated_price NUMERIC(12,2),
    contact_name    VARCHAR(200),
    contact_phone   VARCHAR(30),
    contact_email   VARCHAR(200),
    status          VARCHAR(20)  NOT NULL DEFAULT 'new',
    -- new | contacted | under_offer | closed | lost
    referral_amount NUMERIC(8,2),
    -- CHF 50-500 selon type
    referral_paid   BOOLEAN      NOT NULL DEFAULT false,
    stripe_transfer_id VARCHAR(100),
    notes           TEXT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_hunters_hunter_id ON hunters(hunter_id);
CREATE INDEX IF NOT EXISTS ix_hunters_status    ON hunters(status);

-- ── 16. subscriptions (abonnements Stripe Billing) ────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_subscription_id  VARCHAR(100) UNIQUE,
    stripe_customer_id      VARCHAR(100),
    plan                    VARCHAR(30)  NOT NULL DEFAULT 'starter',
    -- starter | pro | agency | enterprise
    status                  VARCHAR(20)  NOT NULL DEFAULT 'trialing',
    -- trialing | active | past_due | cancelled | incomplete
    price_chf_monthly       NUMERIC(8,2) NOT NULL DEFAULT 29,
    seats                   INTEGER      NOT NULL DEFAULT 1,
    trial_ends_at           TIMESTAMPTZ,
    current_period_start    TIMESTAMPTZ,
    current_period_end      TIMESTAMPTZ,
    cancelled_at            TIMESTAMPTZ,
    cancel_at               TIMESTAMPTZ,
    meta                    JSONB        NOT NULL DEFAULT '{}',
    created_at              TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS ix_subscriptions_status  ON subscriptions(status);

-- ── 17. ai_sessions (historique sphère IA) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title           VARCHAR(300),
    messages        JSONB        NOT NULL DEFAULT '[]',
    -- [{ role: user|assistant, content: "...", created_at: "..." }]
    context         JSONB        NOT NULL DEFAULT '{}',
    -- Snapshot biens/locataires au moment de la session
    tokens_input    INTEGER      NOT NULL DEFAULT 0,
    tokens_output   INTEGER      NOT NULL DEFAULT 0,
    model           VARCHAR(50)  NOT NULL DEFAULT 'claude-sonnet-4-6',
    interactions_today INTEGER   NOT NULL DEFAULT 0,
    -- Rate limiting : 30/jour standard, 100/jour Pro
    ended_at        TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_ai_sessions_user_id    ON ai_sessions(user_id);
CREATE INDEX IF NOT EXISTS ix_ai_sessions_created_at ON ai_sessions(created_at DESC);

-- ── 18. messages (canal proprio ↔ agence ↔ locataire) ───────────────────────
CREATE TABLE IF NOT EXISTS messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    recipient_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    property_id     UUID REFERENCES properties(id) ON DELETE SET NULL,
    subject         VARCHAR(300),
    body            TEXT         NOT NULL,
    read_at         TIMESTAMPTZ,
    channel         VARCHAR(20)  NOT NULL DEFAULT 'app',
    -- app | email | sms | whatsapp
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_messages_sender_id    ON messages(sender_id);
CREATE INDEX IF NOT EXISTS ix_messages_recipient_id ON messages(recipient_id);
CREATE INDEX IF NOT EXISTS ix_messages_property_id  ON messages(property_id);
CREATE INDEX IF NOT EXISTS ix_messages_created_at   ON messages(created_at DESC);

-- ── Commissions (suivi revenus Althy) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS commissions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    partner_id      UUID REFERENCES partners(id)   ON DELETE SET NULL,
    property_id     UUID REFERENCES properties(id) ON DELETE SET NULL,
    source          VARCHAR(50)  NOT NULL,
    -- stripe_connect | bail_fee | application_fee | opener | artisan | partner
    amount          NUMERIC(10,2) NOT NULL,
    currency        VARCHAR(3)   NOT NULL DEFAULT 'CHF',
    status          VARCHAR(20)  NOT NULL DEFAULT 'pending',
    -- pending | paid | cancelled
    stripe_payout_id VARCHAR(100),
    paid_at         TIMESTAMPTZ,
    description     TEXT,
    meta            JSONB        NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_commissions_owner_id ON commissions(owner_id);
CREATE INDEX IF NOT EXISTS ix_commissions_status   ON commissions(status);
CREATE INDEX IF NOT EXISTS ix_commissions_source   ON commissions(source);

-- ── Analytics (événements plateforme) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analytics (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    event           VARCHAR(100) NOT NULL,
    category        VARCHAR(50),
    -- acquisition | activation | retention | revenue | referral
    resource_type   VARCHAR(50),
    resource_id     VARCHAR(100),
    properties      JSONB        NOT NULL DEFAULT '{}',
    ip              VARCHAR(45),
    user_agent      TEXT,
    session_id      VARCHAR(100),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_analytics_user_id    ON analytics(user_id);
CREATE INDEX IF NOT EXISTS ix_analytics_event      ON analytics(event);
CREATE INDEX IF NOT EXISTS ix_analytics_created_at ON analytics(created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════════

-- Activer RLS sur toutes les tables
ALTER TABLE profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties    ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants       ENABLE ROW LEVEL SECURITY;
ALTER TABLE leases        ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents     ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses      ENABLE ROW LEVEL SECURITY;
ALTER TABLE interventions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE missions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE hunters       ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages      ENABLE ROW LEVEL SECURITY;

ALTER TABLE profiles      FORCE ROW LEVEL SECURITY;
ALTER TABLE properties    FORCE ROW LEVEL SECURITY;
ALTER TABLE tenants       FORCE ROW LEVEL SECURITY;
ALTER TABLE leases        FORCE ROW LEVEL SECURITY;
ALTER TABLE transactions  FORCE ROW LEVEL SECURITY;
ALTER TABLE documents     FORCE ROW LEVEL SECURITY;
ALTER TABLE expenses      FORCE ROW LEVEL SECURITY;
ALTER TABLE interventions FORCE ROW LEVEL SECURITY;
ALTER TABLE quotes        FORCE ROW LEVEL SECURITY;
ALTER TABLE missions      FORCE ROW LEVEL SECURITY;
ALTER TABLE listings      FORCE ROW LEVEL SECURITY;
ALTER TABLE offers        FORCE ROW LEVEL SECURITY;
ALTER TABLE hunters       FORCE ROW LEVEL SECURITY;
ALTER TABLE subscriptions FORCE ROW LEVEL SECURITY;
ALTER TABLE ai_sessions   FORCE ROW LEVEL SECURITY;
ALTER TABLE messages      FORCE ROW LEVEL SECURITY;

-- ── Policies ──────────────────────────────────────────────────────────────────

-- profiles : utilisateur voit uniquement son propre profil
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='profiles_self') THEN
        CREATE POLICY profiles_self ON profiles USING (user_id = auth.uid());
    END IF;
END $$;

-- properties : propriétaire voit ses propres biens
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='properties' AND policyname='properties_owner') THEN
        CREATE POLICY properties_owner ON properties USING (owner_id = auth.uid());
    END IF;
END $$;

-- tenants : propriétaire voit ses propres locataires
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tenants' AND policyname='tenants_owner') THEN
        CREATE POLICY tenants_owner ON tenants USING (owner_id = auth.uid());
    END IF;
END $$;

-- leases : propriétaire voit ses propres baux
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='leases' AND policyname='leases_owner') THEN
        CREATE POLICY leases_owner ON leases USING (owner_id = auth.uid());
    END IF;
END $$;

-- transactions : propriétaire voit ses propres transactions
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='transactions' AND policyname='transactions_owner') THEN
        CREATE POLICY transactions_owner ON transactions USING (owner_id = auth.uid());
    END IF;
END $$;

-- documents : propriétaire voit ses propres documents
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='documents' AND policyname='documents_owner') THEN
        CREATE POLICY documents_owner ON documents USING (owner_id = auth.uid());
    END IF;
END $$;

-- expenses : propriétaire voit ses propres dépenses
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='expenses' AND policyname='expenses_owner') THEN
        CREATE POLICY expenses_owner ON expenses USING (owner_id = auth.uid());
    END IF;
END $$;

-- interventions : propriétaire ou artisan assigné
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='interventions' AND policyname='interventions_participant') THEN
        CREATE POLICY interventions_participant ON interventions
            USING (owner_id = auth.uid() OR artisan_id = auth.uid());
    END IF;
END $$;

-- quotes : propriétaire ou artisan
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='quotes' AND policyname='quotes_participant') THEN
        CREATE POLICY quotes_participant ON quotes
            USING (owner_id = auth.uid() OR artisan_id = auth.uid());
    END IF;
END $$;

-- missions : propriétaire ou opener assigné
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='missions' AND policyname='missions_participant') THEN
        CREATE POLICY missions_participant ON missions
            USING (owner_id = auth.uid() OR opener_id = auth.uid());
    END IF;
END $$;

-- listings : propriétaire du bien (via properties)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='listings' AND policyname='listings_owner') THEN
        CREATE POLICY listings_owner ON listings
            USING (
                property_id IN (
                    SELECT id FROM properties WHERE owner_id = auth.uid()
                )
            );
    END IF;
END $$;

-- offers : acheteur ou propriétaire du listing
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='offers' AND policyname='offers_participant') THEN
        CREATE POLICY offers_participant ON offers
            USING (
                buyer_id = auth.uid()
                OR listing_id IN (
                    SELECT l.id FROM listings l
                    JOIN properties p ON p.id = l.property_id
                    WHERE p.owner_id = auth.uid()
                )
            );
    END IF;
END $$;

-- hunters : hunter voit ses propres leads
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='hunters' AND policyname='hunters_self') THEN
        CREATE POLICY hunters_self ON hunters USING (hunter_id = auth.uid());
    END IF;
END $$;

-- subscriptions : utilisateur voit son propre abonnement
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='subscriptions' AND policyname='subscriptions_self') THEN
        CREATE POLICY subscriptions_self ON subscriptions USING (user_id = auth.uid());
    END IF;
END $$;

-- ai_sessions : utilisateur voit ses propres sessions
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ai_sessions' AND policyname='ai_sessions_self') THEN
        CREATE POLICY ai_sessions_self ON ai_sessions USING (user_id = auth.uid());
    END IF;
END $$;

-- messages : expéditeur ou destinataire
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='messages' AND policyname='messages_participant') THEN
        CREATE POLICY messages_participant ON messages
            USING (sender_id = auth.uid() OR recipient_id = auth.uid());
    END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- STORAGE BUCKETS (à créer dans le dashboard Supabase Storage)
-- ═══════════════════════════════════════════════════════════════════════════
-- INSERT INTO storage.buckets (id, name, public) VALUES
--   ('documents',    'documents',    false),  -- Baux, quittances, relances
--   ('photos',       'photos',       true),   -- Photos des biens
--   ('invoices',     'invoices',     false),  -- Scans factures
--   ('avatars',      'avatars',      true);   -- Avatars utilisateurs

-- ═══════════════════════════════════════════════════════════════════════════
-- FIN DU SCHÉMA
-- ═══════════════════════════════════════════════════════════════════════════
