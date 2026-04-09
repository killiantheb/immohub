# Althy — Plan d'architecture complet
> Généré le 2026-04-09 · Version 1.0

---

## 1. Arborescence complète du projet

```
immohub/
│
├── CLAUDE.md                          # Instructions Claude Code
├── docs/
│   ├── althy_business_plan_definitif.pdf
│   └── plan.md                        # Ce fichier
│
├── frontend/                          # Next.js 14 — Vercel
│   ├── public/
│   │   ├── fonts/
│   │   │   ├── Fraunces-Light.woff2
│   │   │   ├── Fraunces-Regular.woff2
│   │   │   ├── Fraunces-Italic.woff2
│   │   │   ├── DMSans-Regular.woff2
│   │   │   └── DMSans-Medium.woff2
│   │   ├── icons/
│   │   │   └── althy-sphere.svg
│   │   └── og-image.png
│   │
│   ├── src/
│   │   ├── app/
│   │   │   │
│   │   │   ├── layout.tsx             # Root layout + fonts + providers
│   │   │   ├── globals.css            # Design tokens CSS (--althy-*)
│   │   │   ├── not-found.tsx
│   │   │   │
│   │   │   ├── (landing)/             # Pages publiques non-auth
│   │   │   │   ├── layout.tsx         # Layout landing (navbar + footer)
│   │   │   │   ├── page.tsx           # Homepage — sphère + pitch
│   │   │   │   ├── estimation/
│   │   │   │   │   └── page.tsx       # Estimation IA gratuite (lead magnet)
│   │   │   │   ├── register/
│   │   │   │   │   └── page.tsx       # Inscription + choix profil
│   │   │   │   ├── login/
│   │   │   │   │   └── page.tsx       # Connexion
│   │   │   │   ├── demo/
│   │   │   │   │   └── page.tsx       # Démo interactive agences
│   │   │   │   ├── tarifs/
│   │   │   │   │   └── page.tsx       # Tarifs publics
│   │   │   │   └── legal/
│   │   │   │       ├── cgv/page.tsx
│   │   │   │       ├── confidentialite/page.tsx
│   │   │   │       └── disclaimer/page.tsx
│   │   │   │
│   │   │   ├── app/                   # Zone authentifiée
│   │   │   │   ├── layout.tsx         # Layout dashboard (sidebar + topbar)
│   │   │   │   │
│   │   │   │   ├── (sphere)/          # INTERFACE PRINCIPALE — la sphère
│   │   │   │   │   └── page.tsx       # / → redirige vers /app/sphere
│   │   │   │   │
│   │   │   │   ├── sphere/
│   │   │   │   │   └── page.tsx       # Sphère IA plein écran — point d'entrée
│   │   │   │   │
│   │   │   │   ├── (dashboard)/       # Dashboard optionnel
│   │   │   │   │   ├── page.tsx       # /app — tableau de bord ultra-simple
│   │   │   │   │   │
│   │   │   │   │   ├── biens/
│   │   │   │   │   │   ├── page.tsx   # Liste biens
│   │   │   │   │   │   └── [id]/
│   │   │   │   │   │       └── page.tsx # Fiche bien (7 blocs + Potentiel IA)
│   │   │   │   │   │
│   │   │   │   │   ├── locataires/
│   │   │   │   │   │   ├── page.tsx
│   │   │   │   │   │   └── [id]/
│   │   │   │   │   │       └── page.tsx # Dossier locataire + scoring IA
│   │   │   │   │   │
│   │   │   │   │   ├── finances/
│   │   │   │   │   │   └── page.tsx   # Revenus / dépenses / loyers
│   │   │   │   │   │
│   │   │   │   │   ├── comptabilite/
│   │   │   │   │   │   └── page.tsx   # État locatif + scan factures + exports
│   │   │   │   │   │
│   │   │   │   │   ├── interventions/
│   │   │   │   │   │   └── page.tsx   # Travaux + signalements
│   │   │   │   │   │
│   │   │   │   │   ├── listings/
│   │   │   │   │   │   └── page.tsx   # Annonces + syndication portails
│   │   │   │   │   │
│   │   │   │   │   ├── crm/
│   │   │   │   │   │   └── page.tsx   # Contacts propriétaires / locataires
│   │   │   │   │   │
│   │   │   │   │   ├── hunters/
│   │   │   │   │   │   └── page.tsx   # Leads off-market
│   │   │   │   │   │
│   │   │   │   │   ├── abonnement/
│   │   │   │   │   │   └── page.tsx   # Plans + upgrade + portail proprio
│   │   │   │   │   │
│   │   │   │   │   └── advisor/
│   │   │   │   │       └── page.tsx   # Althy IA chat (version panel)
│   │   │   │   │
│   │   │   │   ├── ouvreurs/          # Profil opener
│   │   │   │   │   ├── missions/page.tsx
│   │   │   │   │   ├── revenus/page.tsx
│   │   │   │   │   └── historique/page.tsx
│   │   │   │   │
│   │   │   │   ├── artisans/          # Profil artisan
│   │   │   │   │   ├── chantiers/page.tsx
│   │   │   │   │   ├── devis/page.tsx
│   │   │   │   │   ├── paiements/page.tsx
│   │   │   │   │   └── historique/page.tsx
│   │   │   │   │
│   │   │   │   ├── locataire/         # Portail locataire
│   │   │   │   │   ├── page.tsx       # Mon loyer / mes docs / signaler
│   │   │   │   │   └── dossier/page.tsx
│   │   │   │   │
│   │   │   │   ├── portail-proprio/   # Vue proprio connecté par agence
│   │   │   │   │   └── page.tsx       # Lecture seule + messaging agence
│   │   │   │   │
│   │   │   │   └── settings/
│   │   │   │       ├── page.tsx
│   │   │   │       ├── zone/page.tsx
│   │   │   │       ├── preferences/page.tsx
│   │   │   │       ├── paiement/page.tsx
│   │   │   │       └── notifs/page.tsx
│   │   │   │
│   │   │   └── api/                   # Next.js API routes (proxies légers)
│   │   │       └── revalidate/route.ts
│   │   │
│   │   ├── components/
│   │   │   │
│   │   │   ├── sphere/                # COMPOSANT CENTRAL
│   │   │   │   ├── AlthySphere.tsx    # Sphère animée 3D terre cuite
│   │   │   │   ├── SphereOrb.tsx      # Rendu visuel CSS/WebGL
│   │   │   │   ├── SphereInput.tsx    # Input texte/vocal sous la sphère
│   │   │   │   ├── SphereStream.tsx   # Réponse streaming SSE
│   │   │   │   ├── ActionCard.tsx     # Carte "Valider / Ignorer" 1 tap
│   │   │   │   └── SuggestionChips.tsx # Suggestions contextuelles
│   │   │   │
│   │   │   ├── dashboard/
│   │   │   │   ├── DashboardSidebar.tsx
│   │   │   │   ├── DashboardTopbar.tsx
│   │   │   │   ├── KpiCard.tsx
│   │   │   │   ├── RevenueChart.tsx
│   │   │   │   └── AlertBanner.tsx
│   │   │   │
│   │   │   ├── property/
│   │   │   │   ├── PropertyCard.tsx
│   │   │   │   ├── PropertyForm.tsx
│   │   │   │   ├── FicheBien/
│   │   │   │   │   ├── Bloc1Base.tsx
│   │   │   │   │   ├── Bloc2Locatif.tsx
│   │   │   │   │   ├── Bloc3Constructif.tsx
│   │   │   │   │   ├── Bloc4Promotion.tsx
│   │   │   │   │   ├── Bloc5Marche.tsx
│   │   │   │   │   ├── Bloc6Legal.tsx
│   │   │   │   │   └── Bloc7Actions.tsx
│   │   │   │   └── PortalBadges.tsx
│   │   │   │
│   │   │   ├── tenant/
│   │   │   │   ├── TenantCard.tsx
│   │   │   │   ├── TenantScoreRing.tsx
│   │   │   │   ├── DossierUpload.tsx
│   │   │   │   └── ValidationModal.tsx  # CHF 90 à la réussite
│   │   │   │
│   │   │   ├── finance/
│   │   │   │   ├── PaymentRow.tsx
│   │   │   │   ├── SavingsWidget.tsx    # "CHF 328 économisés vs régie"
│   │   │   │   ├── InvoiceScan.tsx      # OCR scan factures
│   │   │   │   └── ExportButtons.tsx
│   │   │   │
│   │   │   ├── intervention/
│   │   │   │   ├── InterventionCard.tsx
│   │   │   │   ├── QuoteComparison.tsx  # 3 devis comparés IA
│   │   │   │   └── ArtisanPicker.tsx
│   │   │   │
│   │   │   ├── messaging/
│   │   │   │   ├── MessageThread.tsx    # Canal proprio ↔ agence
│   │   │   │   └── MessageBubble.tsx
│   │   │   │
│   │   │   ├── ui/                     # Primitives design system
│   │   │   │   ├── Button.tsx           # Variants: primary, ghost, danger
│   │   │   │   ├── Card.tsx
│   │   │   │   ├── Badge.tsx
│   │   │   │   ├── Modal.tsx
│   │   │   │   ├── Input.tsx
│   │   │   │   ├── Select.tsx
│   │   │   │   ├── Textarea.tsx
│   │   │   │   ├── Spinner.tsx
│   │   │   │   ├── EmptyState.tsx
│   │   │   │   └── Disclaimer.tsx       # Bandeau disclaimer obligatoire
│   │   │   │
│   │   │   └── landing/
│   │   │       ├── Hero.tsx
│   │   │       ├── FeaturesGrid.tsx
│   │   │       ├── PricingTable.tsx
│   │   │       ├── Testimonials.tsx
│   │   │       └── Footer.tsx
│   │   │
│   │   ├── lib/
│   │   │   ├── api.ts                  # Axios instance + interceptors
│   │   │   ├── auth.ts                 # Supabase auth helpers
│   │   │   ├── supabase.ts             # Supabase client
│   │   │   ├── stripe.ts               # Stripe client
│   │   │   │
│   │   │   ├── hooks/
│   │   │   │   ├── useRole.ts          # Rôle + permissions
│   │   │   │   ├── useSphere.ts        # État sphère (idle/listening/streaming)
│   │   │   │   ├── useSSE.ts           # Streaming SSE hook
│   │   │   │   ├── useVoice.ts         # Web Speech API
│   │   │   │   ├── useProperties.ts
│   │   │   │   ├── useTenants.ts
│   │   │   │   ├── usePayments.ts
│   │   │   │   └── useInterventions.ts
│   │   │   │
│   │   │   ├── store/
│   │   │   │   ├── authStore.ts        # Zustand — user + session
│   │   │   │   ├── sphereStore.ts      # Zustand — état sphère + historique
│   │   │   │   └── notifStore.ts       # Zustand — notifications
│   │   │   │
│   │   │   └── types/
│   │   │       ├── index.ts            # Types partagés
│   │   │       ├── property.ts
│   │   │       ├── tenant.ts
│   │   │       ├── payment.ts
│   │   │       └── sphere.ts           # SphereState, ActionCard, etc.
│   │   │
│   │   └── middleware.ts               # Auth guard routes protégées
│   │
│   ├── tailwind.config.ts
│   ├── next.config.js
│   ├── tsconfig.json
│   └── .env.local
│
├── backend/                            # FastAPI — Railway
│   ├── app/
│   │   ├── main.py                     # App FastAPI + CORS + routers
│   │   │
│   │   ├── core/
│   │   │   ├── config.py               # Settings Pydantic
│   │   │   ├── database.py             # AsyncSession + engine
│   │   │   ├── security.py             # get_current_user JWT
│   │   │   ├── limiter.py              # Rate limiting IA (30/100 par jour)
│   │   │   └── rbac.py                 # 9 rôles + permissions
│   │   │
│   │   ├── models/                     # SQLAlchemy ORM
│   │   │   ├── base.py                 # BaseModel (id, timestamps, is_active)
│   │   │   ├── user.py
│   │   │   ├── profile.py
│   │   │   ├── property.py
│   │   │   ├── lease.py
│   │   │   ├── tenant.py
│   │   │   ├── payment.py
│   │   │   ├── document.py
│   │   │   ├── expense.py
│   │   │   ├── intervention.py
│   │   │   ├── quote.py
│   │   │   ├── mission.py
│   │   │   ├── listing.py
│   │   │   ├── offer.py
│   │   │   ├── partner.py
│   │   │   ├── hunter.py
│   │   │   ├── subscription.py
│   │   │   ├── ai_session.py
│   │   │   └── message.py
│   │   │
│   │   ├── routers/                    # Un fichier = un domaine
│   │   │   ├── auth.py
│   │   │   ├── properties.py
│   │   │   ├── leases.py
│   │   │   ├── tenants.py
│   │   │   ├── payments.py
│   │   │   ├── documents.py
│   │   │   ├── expenses.py
│   │   │   ├── interventions.py
│   │   │   ├── quotes.py
│   │   │   ├── missions.py
│   │   │   ├── listings.py
│   │   │   ├── offers.py
│   │   │   ├── partners.py
│   │   │   ├── hunters.py
│   │   │   ├── subscriptions.py
│   │   │   ├── ai.py                   # Sphère + streaming + /estimate
│   │   │   ├── messages.py
│   │   │   ├── webhooks.py             # Stripe webhooks
│   │   │   ├── dashboard.py
│   │   │   ├── admin.py
│   │   │   └── notifications.py
│   │   │
│   │   ├── services/
│   │   │   ├── ai_service.py           # Claude SSE + intent parsing
│   │   │   ├── sphere_service.py       # Orchestration actions sphère
│   │   │   ├── stripe_service.py       # Paiements + Connect + webhooks
│   │   │   ├── document_service.py     # Génération PDF (fpdf2)
│   │   │   ├── ocr_service.py          # Scan factures
│   │   │   ├── scoring_service.py      # Score locataire IA
│   │   │   ├── estimation_service.py   # Estimation bien IA
│   │   │   ├── notification_service.py # Resend + Twilio
│   │   │   └── storage_service.py      # Supabase Storage
│   │   │
│   │   └── workers/                    # Celery tasks
│   │       ├── celery_app.py
│   │       ├── payment_tasks.py        # Rappels loyers impayés
│   │       ├── document_tasks.py       # Génération async
│   │       ├── notification_tasks.py   # Emails + SMS
│   │       └── sync_tasks.py           # Sync portails (Homegate etc.)
│   │
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/
│   │       ├── 0001_initial_schema.py
│   │       ├── ...
│   │       └── 0013_expenses_messages_offers.py  # prochain sprint
│   │
│   ├── requirements.txt
│   └── Dockerfile
│
└── package.json                        # Scripts monorepo
```

---

## 2. Schéma des 18 tables Supabase

### Relations clés

```
users (1) ──────────── (1) profiles
users (1) ──────────── (N) properties        [owner_id]
users (1) ──────────── (N) subscriptions     [user_id]
users (1) ──────────── (N) ai_sessions       [user_id]
users (1) ──────────── (N) messages          [sender_id]

properties (1) ─────── (N) leases            [property_id]
properties (1) ─────── (N) listings          [property_id]
properties (1) ─────── (N) interventions     [property_id]
properties (1) ─────── (N) expenses          [property_id]
properties (1) ─────── (N) documents         [property_id]

leases (1) ──────────── (N) payments          [lease_id]
leases (1) ──────────── (N) tenants           [lease_id]  ← N:N via junction
leases (1) ──────────── (N) documents         [lease_id]

tenants (1) ─────────── (N) documents         [tenant_id]

interventions (1) ───── (N) quotes            [intervention_id]
quotes (1) ──────────── (N) missions          [quote_id]  (mission opener)

listings (1) ────────── (N) offers            [listing_id]
hunters (N) ─────────── (1) users             [hunter_id = submitter]
messages (N) ────────── (1) properties        [property_id, nullable]
```

### DDL complet (cible — complète les migrations existantes)

```sql
-- ══════════════════════════════════════════════════
-- TABLE 1 : users  (gérée par Supabase Auth)
-- ══════════════════════════════════════════════════
-- id UUID (auth.users.id)
-- email, created_at, etc. — natif Supabase

-- ══════════════════════════════════════════════════
-- TABLE 2 : profiles
-- ══════════════════════════════════════════════════
CREATE TABLE profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role            VARCHAR(30) NOT NULL DEFAULT 'proprio_solo',
    -- proprio_solo | agence | portail_proprio | opener | artisan
    -- expert | hunter | locataire | acheteur_premium
  full_name       VARCHAR(200),
  phone           VARCHAR(30),
  avatar_url      TEXT,
  zone_cantons    TEXT[]  DEFAULT '{}',   -- ['GE','VD','VS']
  zone_npa        TEXT[]  DEFAULT '{}',
  company_name    VARCHAR(200),
  siret           VARCHAR(50),
  stripe_account_id VARCHAR(100),        -- Stripe Connect account
  stripe_customer_id VARCHAR(100),
  iban            VARCHAR(34),
  preferences     JSONB   DEFAULT '{}',
  onboarded_at    TIMESTAMPTZ,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ══════════════════════════════════════════════════
-- TABLE 3 : properties
-- ══════════════════════════════════════════════════
CREATE TABLE properties (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agency_id       UUID REFERENCES auth.users(id),    -- si géré par agence
  address         VARCHAR(300) NOT NULL,
  city            VARCHAR(100) NOT NULL,
  npa             VARCHAR(10),
  canton          VARCHAR(2),
  country         VARCHAR(3) DEFAULT 'CHE',
  type            VARCHAR(30),    -- apartment | house | villa | studio | commercial | parking
  surface         NUMERIC(8,2),
  rooms           NUMERIC(4,1),
  floor           SMALLINT,
  year_built      SMALLINT,
  condition       VARCHAR(20),    -- new | good | average | poor
  dpe_class       VARCHAR(2),     -- A-G
  monthly_rent    NUMERIC(10,2),
  charges         NUMERIC(10,2),
  deposit_months  SMALLINT DEFAULT 3,
  photos          TEXT[]  DEFAULT '{}',
  description     TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'active',
    -- active | vacant | maintenance | for_sale | sold
  portail_proprio_enabled BOOLEAN DEFAULT false,
  lat             NUMERIC(10,7),
  lng             NUMERIC(10,7),
  metadata        JSONB DEFAULT '{}',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ══════════════════════════════════════════════════
-- TABLE 4 : leases
-- ══════════════════════════════════════════════════
CREATE TABLE leases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  type            VARCHAR(20) NOT NULL DEFAULT 'annual',
    -- annual | seasonal | weekly | nightly
  start_date      DATE NOT NULL,
  end_date        DATE,
  monthly_rent    NUMERIC(10,2) NOT NULL,
  charges         NUMERIC(10,2) DEFAULT 0,
  deposit_amount  NUMERIC(10,2),
  deposit_paid    BOOLEAN DEFAULT false,
  deposit_stripe_id VARCHAR(100),       -- Stripe payment intent
  indexation_type VARCHAR(20),          -- IPC | fixe | aucune
  indexation_rate NUMERIC(5,4),
  notice_months   SMALLINT DEFAULT 3,
  status          VARCHAR(20) NOT NULL DEFAULT 'active',
    -- draft | active | terminated | expired
  signed_at       TIMESTAMPTZ,
  terminated_at   TIMESTAMPTZ,
  termination_reason TEXT,
  stripe_subscription_id VARCHAR(100),  -- loyer récurrent Stripe
  althy_fee_pct   NUMERIC(5,4) DEFAULT 0.04,  -- 4 % par défaut
  notes           TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ══════════════════════════════════════════════════
-- TABLE 5 : tenants
-- ══════════════════════════════════════════════════
CREATE TABLE tenants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id),    -- si compte Althy
  lease_id        UUID REFERENCES leases(id),
  property_id     UUID NOT NULL REFERENCES properties(id),
  full_name       VARCHAR(200) NOT NULL,
  email           VARCHAR(200),
  phone           VARCHAR(30),
  date_of_birth   DATE,
  nationality     VARCHAR(3),
  income_monthly  NUMERIC(10,2),
  employer        VARCHAR(200),
  status          VARCHAR(20) NOT NULL DEFAULT 'candidate',
    -- candidate | selected | active | departed | rejected
  ai_score        SMALLINT,             -- 0-100
  ai_score_detail JSONB DEFAULT '{}',   -- détail scoring
  stripe_customer_id VARCHAR(100),      -- pour CHF 90 à la réussite
  dossier_fee_paid BOOLEAN DEFAULT false,
  dossier_fee_stripe_id VARCHAR(100),
  documents_ok    BOOLEAN DEFAULT false,
  move_in_date    DATE,
  move_out_date   DATE,
  notes           TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ══════════════════════════════════════════════════
-- TABLE 6 : payments
-- ══════════════════════════════════════════════════
CREATE TABLE payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id        UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  property_id     UUID NOT NULL REFERENCES properties(id),
  tenant_id       UUID REFERENCES tenants(id),
  period_month    DATE NOT NULL,          -- 2026-04-01 = avril 2026
  amount_due      NUMERIC(10,2) NOT NULL,
  amount_received NUMERIC(10,2) DEFAULT 0,
  althy_fee       NUMERIC(10,2),          -- 4 % prélevé
  net_to_owner    NUMERIC(10,2),          -- montant net = loyer - althy_fee
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- pending | received | late | partial | disputed | waived
  due_date        DATE NOT NULL,
  received_at     TIMESTAMPTZ,
  stripe_payment_intent VARCHAR(100),
  stripe_transfer_id    VARCHAR(100),     -- virement vers proprio
  reminder_count  SMALLINT DEFAULT 0,
  reminder_last_at TIMESTAMPTZ,
  notes           TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ══════════════════════════════════════════════════
-- TABLE 7 : documents
-- ══════════════════════════════════════════════════
CREATE TABLE documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type            VARCHAR(50) NOT NULL,
    -- bail | quittance | edl_entree | edl_sortie | relance | attestation
    -- courrier | facture | devis | rapport | autre
  property_id     UUID REFERENCES properties(id),
  lease_id        UUID REFERENCES leases(id),
  tenant_id       UUID REFERENCES tenants(id),
  owner_id        UUID NOT NULL REFERENCES auth.users(id),
  title           VARCHAR(300),
  url_storage     TEXT NOT NULL,          -- Supabase Storage URL
  mime_type       VARCHAR(100) DEFAULT 'application/pdf',
  size_bytes      INTEGER,
  generated_by_ai BOOLEAN DEFAULT false,
  ai_model        VARCHAR(50),
  disclaimer_included BOOLEAN DEFAULT false,  -- OBLIGATOIRE si IA
  signed_at       TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  sent_to         TEXT[],                 -- emails destinataires
  metadata        JSONB DEFAULT '{}',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ══════════════════════════════════════════════════
-- TABLE 8 : expenses  (scan factures + dépenses)
-- ══════════════════════════════════════════════════
CREATE TABLE expenses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  owner_id        UUID NOT NULL REFERENCES auth.users(id),
  supplier        VARCHAR(200),
  description     TEXT,
  amount          NUMERIC(10,2) NOT NULL,
  currency        VARCHAR(3) DEFAULT 'CHF',
  category        VARCHAR(50),
    -- gros_entretien | menu_entretien | charges | assurance
    -- travaux | honoraires | taxes | autre
  charged_to      VARCHAR(20) DEFAULT 'proprio',  -- proprio | locataire
  invoice_date    DATE,
  invoice_number  VARCHAR(100),
  url_invoice     TEXT,                    -- Supabase Storage
  ocr_raw         TEXT,                    -- résultat OCR brut
  ocr_confidence  NUMERIC(5,4),
  ai_category_suggestion VARCHAR(50),
  ai_category_confirmed  BOOLEAN DEFAULT false,
  fiscal_year     SMALLINT,
  is_deductible   BOOLEAN DEFAULT true,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ══════════════════════════════════════════════════
-- TABLE 9 : interventions
-- ══════════════════════════════════════════════════
CREATE TABLE interventions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  reported_by     UUID REFERENCES auth.users(id),  -- proprio | locataire
  assigned_to     UUID REFERENCES auth.users(id),  -- artisan
  title           VARCHAR(300) NOT NULL,
  description     TEXT,
  category        VARCHAR(50),   -- plomberie | electricite | serrurerie | etc.
  priority        VARCHAR(20) DEFAULT 'normal',   -- urgent | high | normal | low
  status          VARCHAR(20) NOT NULL DEFAULT 'open',
    -- open | quotes_pending | quote_selected | in_progress | done | cancelled
  photos          TEXT[]  DEFAULT '{}',
  scheduled_at    TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  cost_estimated  NUMERIC(10,2),
  cost_final      NUMERIC(10,2),
  charged_to      VARCHAR(20),   -- proprio | locataire (selon OBLF)
  notes           TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ══════════════════════════════════════════════════
-- TABLE 10 : quotes  (devis artisans)
-- ══════════════════════════════════════════════════
CREATE TABLE quotes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intervention_id UUID NOT NULL REFERENCES interventions(id) ON DELETE CASCADE,
  artisan_id      UUID NOT NULL REFERENCES auth.users(id),
  property_id     UUID NOT NULL REFERENCES properties(id),
  title           VARCHAR(300),
  description     TEXT,
  amount          NUMERIC(10,2) NOT NULL,
  vat_pct         NUMERIC(5,4) DEFAULT 0.077,  -- TVA CH 7.7 %
  amount_ttc      NUMERIC(10,2),
  validity_days   SMALLINT DEFAULT 30,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- pending | selected | rejected | expired | invoiced | paid
  ai_analysis     JSONB DEFAULT '{}',     -- comparaison IA
  ai_recommended  BOOLEAN DEFAULT false,
  url_pdf         TEXT,
  althy_commission_pct  NUMERIC(5,4) DEFAULT 0.10,  -- 10 %
  althy_commission_paid BOOLEAN DEFAULT false,
  stripe_payment_intent VARCHAR(100),
  selected_at     TIMESTAMPTZ,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ══════════════════════════════════════════════════
-- TABLE 11 : missions  (openers)
-- ══════════════════════════════════════════════════
CREATE TABLE missions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     UUID NOT NULL REFERENCES properties(id),
  opener_id       UUID NOT NULL REFERENCES auth.users(id),
  requester_id    UUID NOT NULL REFERENCES auth.users(id),
  type            VARCHAR(30) NOT NULL,
    -- visite | edl_entree | edl_sortie | checkin | checkout | remise_cles
  status          VARCHAR(20) NOT NULL DEFAULT 'proposed',
    -- proposed | confirmed | in_progress | done | cancelled | disputed
  scheduled_at    TIMESTAMPTZ NOT NULL,
  duration_min    SMALLINT DEFAULT 60,
  address         VARCHAR(300),
  instructions    TEXT,
  report          TEXT,
  photos          TEXT[]  DEFAULT '{}',
  completed_at    TIMESTAMPTZ,
  amount          NUMERIC(8,2) NOT NULL,   -- montant brut à l'opener
  althy_fee_pct   NUMERIC(5,4) DEFAULT 0.15,  -- 15 % (10 % Pro opener)
  althy_fee       NUMERIC(8,2),
  net_to_opener   NUMERIC(8,2),
  stripe_payment_intent VARCHAR(100),
  stripe_transfer_id    VARCHAR(100),
  rating_opener   SMALLINT,   -- 1-5 étoiles par requester
  rating_note     TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ══════════════════════════════════════════════════
-- TABLE 12 : listings  (existante depuis 0001)
-- ══════════════════════════════════════════════════
-- property_id, title, description_ai, price, status,
-- portals JSONB, ai_score, views, leads_count, published_at
-- + is_active, created_at, updated_at

-- ══════════════════════════════════════════════════
-- TABLE 13 : offers  (offres acheteurs/locataires)
-- ══════════════════════════════════════════════════
CREATE TABLE offers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id      UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  buyer_id        UUID NOT NULL REFERENCES auth.users(id),
  type            VARCHAR(20) DEFAULT 'purchase',  -- purchase | rental
  amount          NUMERIC(12,2) NOT NULL,
  message         TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- pending | accepted | rejected | countered | withdrawn
  counter_amount  NUMERIC(12,2),
  counter_message TEXT,
  expires_at      TIMESTAMPTZ,
  responded_at    TIMESTAMPTZ,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ══════════════════════════════════════════════════
-- TABLE 14 : partners  (assureurs, cautions, etc.)
-- ══════════════════════════════════════════════════
CREATE TABLE partners (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(200) NOT NULL,
  type            VARCHAR(30) NOT NULL,
    -- caution | assurance_rc | demenagement | energie | internet
    -- notaire | banque | avocat | expert
  website         TEXT,
  api_key_enc     TEXT,                -- clé API chiffrée AES-256
  commission_pct  NUMERIC(5,4),        -- % commission Althy
  commission_flat NUMERIC(8,2),        -- ou montant fixe CHF
  active_since    DATE,
  contract_url    TEXT,                -- URL accord signé OBLIGATOIRE
  notes           TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ══════════════════════════════════════════════════
-- TABLE 15 : hunters  (existante depuis 0012)
-- ══════════════════════════════════════════════════
-- hunter_id, address, city, description, estimated_price,
-- contact_name/phone/email, status, referral_amount,
-- referral_paid, created_at, updated_at

-- ══════════════════════════════════════════════════
-- TABLE 16 : subscriptions
-- ══════════════════════════════════════════════════
CREATE TABLE subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan            VARCHAR(30) NOT NULL DEFAULT 'starter',
    -- starter | proprio | agence | opener_pro | artisan_pro | expert_pro
    -- portail_proprio | acheteur_premium
  status          VARCHAR(20) NOT NULL DEFAULT 'trialing',
    -- trialing | active | past_due | cancelled | paused
  stripe_subscription_id VARCHAR(100) UNIQUE,
  stripe_price_id        VARCHAR(100),
  amount_monthly  NUMERIC(8,2),
  trial_ends_at   TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end   TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  ai_interactions_today SMALLINT DEFAULT 0,
  ai_interactions_reset_at TIMESTAMPTZ,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ══════════════════════════════════════════════════
-- TABLE 17 : ai_sessions
-- ══════════════════════════════════════════════════
CREATE TABLE ai_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id     UUID REFERENCES properties(id),
  session_type    VARCHAR(30) DEFAULT 'sphere',  -- sphere | advisor | estimation
  messages        JSONB NOT NULL DEFAULT '[]',
    -- [{role, content, timestamp, tokens_in, tokens_out, action_proposed, action_validated}]
  context_snapshot JSONB DEFAULT '{}',   -- snapshot du contexte (biens, loyers, etc.)
  tokens_in_total  INTEGER DEFAULT 0,
  tokens_out_total INTEGER DEFAULT 0,
  actions_proposed SMALLINT DEFAULT 0,
  actions_validated SMALLINT DEFAULT 0,
  last_intent     VARCHAR(100),           -- dernier intent détecté
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ══════════════════════════════════════════════════
-- TABLE 18 : messages  (canal proprio ↔ agence)
-- ══════════════════════════════════════════════════
CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id       UUID NOT NULL REFERENCES auth.users(id),
  receiver_id     UUID NOT NULL REFERENCES auth.users(id),
  property_id     UUID REFERENCES properties(id),
  body            TEXT NOT NULL,
  type            VARCHAR(20) DEFAULT 'text',   -- text | ai | system | action
  read_at         TIMESTAMPTZ,
  ai_generated    BOOLEAN DEFAULT false,
  attachments     TEXT[]  DEFAULT '{}',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### RLS Policies (résumé)

```
profiles    → USING (user_id = auth.uid())
properties  → USING (owner_id = auth.uid() OR agency_id = auth.uid())
leases      → via properties.owner_id JOIN
tenants     → via properties.owner_id JOIN
payments    → via leases → properties.owner_id JOIN
documents   → USING (owner_id = auth.uid())
expenses    → USING (owner_id = auth.uid())
interventions → via properties.owner_id JOIN
quotes      → via interventions → properties JOIN
missions    → USING (opener_id = auth.uid() OR requester_id = auth.uid())
listings    → via properties.owner_id JOIN
offers      → USING (buyer_id = auth.uid()) OR via listings JOIN
partners    → admin only
hunters     → USING (hunter_id = auth.uid())
subscriptions → USING (user_id = auth.uid())
ai_sessions → USING (user_id = auth.uid())
messages    → USING (sender_id = auth.uid() OR receiver_id = auth.uid())
```

---

## 3. Routes API FastAPI complètes

### Auth — `/api/v1/auth`
```
POST   /auth/register          # Inscription + création profil
POST   /auth/login             # Connexion (délégué Supabase)
POST   /auth/logout
GET    /auth/me                # Profil courant + rôle + subscription
PUT    /auth/me                # Mise à jour profil
POST   /auth/refresh
POST   /auth/forgot-password
POST   /auth/reset-password
```

### Properties — `/api/v1/properties`
```
GET    /properties             # Liste biens de l'utilisateur
POST   /properties             # Créer un bien
GET    /properties/{id}        # Fiche bien complète
PUT    /properties/{id}        # Modifier
DELETE /properties/{id}        # Soft delete
GET    /properties/{id}/summary       # Résumé IA (briefing)
GET    /properties/{id}/potential     # Potentiel IA (7 blocs)
POST   /properties/{id}/photos        # Upload photos
```

### Leases — `/api/v1/leases`
```
GET    /leases                 # Tous les baux
POST   /leases                 # Créer un bail
GET    /leases/{id}
PUT    /leases/{id}
DELETE /leases/{id}
POST   /leases/{id}/terminate  # Résiliation avec préavis
POST   /leases/{id}/generate-contract  # Génère PDF bail via IA
GET    /leases/{id}/payments   # Loyers du bail
```

### Tenants — `/api/v1/tenants`
```
GET    /tenants                # Tous les locataires/candidats
POST   /tenants                # Ajouter dossier locataire
GET    /tenants/{id}
PUT    /tenants/{id}
DELETE /tenants/{id}
POST   /tenants/{id}/score     # Score IA du dossier
POST   /tenants/{id}/select    # Sélectionner → prélève CHF 90
POST   /tenants/{id}/reject    # Rejeter → CHF 0
POST   /tenants/{id}/documents # Upload documents dossier
```

### Payments — `/api/v1/payments`
```
GET    /payments               # Tous les paiements (filtre: year, status)
POST   /payments               # Enregistrer un paiement manuel
GET    /payments/{id}
PUT    /payments/{id}
POST   /payments/trigger-stripe  # Déclencher prélèvement Stripe
POST   /payments/{id}/remind   # Envoyer relance (email + SMS)
GET    /payments/stats         # KPIs: reçu, attendu, impayés
GET    /payments/monthly       # Données chart mensuel
```

### Documents — `/api/v1/documents`
```
GET    /documents              # Tous les documents
POST   /documents/generate     # Génération IA (bail, quittance, EDL, relance)
GET    /documents/{id}
DELETE /documents/{id}
POST   /documents/{id}/send    # Envoyer par email
GET    /documents/{id}/download  # URL téléchargement signé
```

### Expenses — `/api/v1/expenses`
```
GET    /expenses               # Toutes les dépenses (filtre: year, property)
POST   /expenses               # Ajouter dépense manuelle
POST   /expenses/scan          # OCR scan facture → extraction IA
GET    /expenses/{id}
PUT    /expenses/{id}          # Confirmer catégorie IA
DELETE /expenses/{id}
GET    /expenses/stats         # Total déductible, par catégorie, par bien
GET    /expenses/export        # Export CSV/Excel fiduciaire
```

### Interventions — `/api/v1/interventions`
```
GET    /interventions          # Toutes les interventions
POST   /interventions          # Créer signalement
GET    /interventions/{id}
PUT    /interventions/{id}
DELETE /interventions/{id}
POST   /interventions/{id}/request-quotes  # Demande 3 devis IA
GET    /interventions/{id}/quotes          # Devis reçus
POST   /interventions/{id}/select-quote    # Sélectionner devis
```

### Quotes — `/api/v1/quotes`
```
GET    /quotes                 # Devis de l'artisan connecté
POST   /quotes                 # Soumettre un devis
GET    /quotes/{id}
PUT    /quotes/{id}
DELETE /quotes/{id}
POST   /quotes/{id}/invoice    # Marquer comme facturé
```

### Missions — `/api/v1/missions`
```
GET    /missions               # Missions de l'opener connecté
POST   /missions               # Créer mission (par proprio)
GET    /missions/{id}
PUT    /missions/{id}
POST   /missions/{id}/confirm   # Accepter la mission (opener)
POST   /missions/{id}/complete  # Marquer terminé + rapport
POST   /missions/{id}/report    # Upload rapport + photos
GET    /missions/available      # Missions disponibles dans la zone
```

### Listings — `/api/v1/listings`
```
GET    /listings               # Annonces du proprio
POST   /listings               # Créer annonce
GET    /listings/{id}
PATCH  /listings/{id}          # Mettre à jour statut/portails
DELETE /listings/{id}
POST   /listings/{id}/publish  # Publier sur portails
POST   /listings/{id}/generate-description  # Description IA
```

### Offers — `/api/v1/offers`
```
GET    /offers                 # Offres reçues (proprio) ou faites (acheteur)
POST   /offers                 # Soumettre une offre
GET    /offers/{id}
POST   /offers/{id}/accept     # Accepter
POST   /offers/{id}/reject     # Refuser
POST   /offers/{id}/counter    # Contre-offre
```

### Hunters — `/api/v1/hunters`
```
GET    /hunters                # Leads soumis par le hunter connecté
POST   /hunters                # Soumettre lead off-market
GET    /hunters/{id}
DELETE /hunters/{id}
```

### Subscriptions — `/api/v1/subscriptions`
```
GET    /subscriptions/current  # Abonnement actuel
POST   /subscriptions/checkout # Créer session Stripe Checkout
POST   /subscriptions/portal   # Portail billing Stripe
POST   /subscriptions/cancel   # Annuler
GET    /subscriptions/usage    # Usage IA du jour
```

### Messages — `/api/v1/messages`
```
GET    /messages               # Conversations (filtre: property_id)
POST   /messages               # Envoyer message
GET    /messages/{id}
DELETE /messages/{id}
PUT    /messages/{conversation_id}/read  # Marquer lu
```

### AI — `/api/v1/ai`
```
GET    /ai/chat                # SSE streaming — sphère principale
POST   /ai/chat/history        # Historique session
POST   /ai/estimate            # Estimation bien (public, sans auth)
POST   /ai/score-tenant        # Scoring dossier locataire
POST   /ai/generate-description  # Description annonce
POST   /ai/draft-document      # Génération document
POST   /ai/briefing            # Briefing quotidien
POST   /ai/suggest-action      # Intent → action proposée
GET    /ai/usage               # Compteur interactions du jour
```

### Webhooks — `/api/v1/webhooks`
```
POST   /webhooks/stripe        # Stripe events (paiements, Connect)
POST   /webhooks/supabase      # Realtime triggers
```

### Dashboard — `/api/v1/dashboard`
```
GET    /dashboard/summary      # KPIs globaux utilisateur
GET    /dashboard/alerts       # Alertes actives (impayés, etc.)
```

### Admin — `/api/v1/admin`
```
GET    /admin/users
PUT    /admin/users/{id}/role
GET    /admin/stats
POST   /admin/partners         # Gérer les partenaires
PUT    /admin/partners/{id}
```

### Notifications — `/api/v1/notifications`
```
GET    /notifications          # Notifications de l'utilisateur
PUT    /notifications/{id}/read
PUT    /notifications/read-all
DELETE /notifications/{id}
GET    /notifications/settings
PUT    /notifications/settings
```

---

## 4. Diagramme des flux entre composants

```
╔══════════════════════════════════════════════════════════════════╗
║                    ALTHY — FLUX PRINCIPAL                        ║
╚══════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────┐
│                    UTILISATEUR                                   │
│  (parle ou écrit en langage naturel)                            │
└─────────────────────┬───────────────────────────────────────────┘
                      │ texte / voix (Web Speech API)
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│              AlthySphere.tsx (composant central)                 │
│   SphereOrb ← état: idle / listening / streaming                │
│   SphereInput → capture texte ou transcription vocale           │
│   SuggestionChips → suggestions contextuelles par rôle/page     │
└─────────────────────┬───────────────────────────────────────────┘
                      │ POST /api/v1/ai/chat (SSE)
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│              BACKEND FastAPI — ai_service.py                     │
│                                                                  │
│  1. rate_limit check (30/jour standard, 100/jour Pro)           │
│  2. context_builder → récupère biens, loyers, interventions      │
│  3. intent_parser → détermine l'intent (ex: "payer loyer")      │
│  4. Claude Sonnet API (stream SSE)                               │
│  5. action_builder → construit ActionCard si action détectée     │
│  6. save_to ai_sessions                                          │
└─────────────────────┬───────────────────────────────────────────┘
                      │ SSE stream (texte + action JSON)
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│              SphereStream.tsx                                    │
│   Affiche réponse en streaming                                   │
│   ↓ si action détectée                                          │
│              ActionCard.tsx                                      │
│   "Envoyer relance à Dupont ?" [Valider] [Ignorer]              │
└─────────────────────┬───────────────────────────────────────────┘
                      │ utilisateur tape [Valider]
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│              sphere_service.py — exécution action               │
│                                                                  │
│  intent: "relance"     → POST /payments/{id}/remind             │
│  intent: "quittance"   → POST /documents/generate               │
│  intent: "artisan"     → POST /interventions/{id}/request-quotes│
│  intent: "louer"       → POST /listings                         │
│  intent: "mission"     → GET  /missions/available               │
│  etc.                                                            │
└─────────────────────┬───────────────────────────────────────────┘
                      │ résultat (succès / erreur)
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│   Confirmation affichée dans la sphère                          │
│   + notification Supabase Realtime → frontend                   │
│   + email/SMS si nécessaire (Resend / Twilio)                   │
└─────────────────────────────────────────────────────────────────┘


╔══════════════════════════════════════════════════════════════════╗
║                 FLUX PAIEMENT LOYER (4 %)                        ║
╚══════════════════════════════════════════════════════════════════╝

  Locataire ──Stripe Connect──▶ Compte Althy (escrow)
       │                              │
       │                     split Stripe Connect
       │                    ┌─────────┴──────────┐
       │                    ▼                    ▼
       │            96 % → Proprio          4 % → Althy
       │                    │
       └──────── "loyer net reçu" affiché dans le dashboard
                 (jamais "commission")


╔══════════════════════════════════════════════════════════════════╗
║                 FLUX DOSSIER LOCATAIRE (CHF 90)                  ║
╚══════════════════════════════════════════════════════════════════╝

  Candidat s'inscrit
       │
       ├── enregistre carte CB (Stripe SetupIntent)
       ├── soumet dossier gratuitement
       ├── IA score 0-100
       │
  Proprio examine dossiers
       │
       ├── [Sélectionner] → Stripe PaymentIntent CHF 90 → déclenché
       │         └── confirmation → locataire notifié
       │
       └── [Rejeter]  → CHF 0, dossier reste actif sur Althy


╔══════════════════════════════════════════════════════════════════╗
║                 FLUX ARTISAN (10 % commission)                   ║
╚══════════════════════════════════════════════════════════════════╝

  Proprio signale intervention
       │
       └── IA contacte 3 artisans notés dans la zone
                │
                ├── Artisan 1 soumet devis (via app Althy)
                ├── Artisan 2 soumet devis
                └── Artisan 3 soumet devis
                         │
                    IA compare + recommande
                         │
                    Proprio [Valider]
                         │
                    Stripe Connect artisan
                    90 % net artisan + 10 % Althy
```

---

## 5. Plan d'implémentation — 10 sprints

> Chaque sprint = 1 semaine. Objectif : M1 opérationnel en sprint 6.

---

### SPRINT 1 — Fondations design + sphère (semaine 1)
**Objectif : La sphère tourne. On peut lui parler. Elle répond.**

- [ ] Appliquer design system complet dans `globals.css` :
  tokens CSS `--althy-*`, Fraunces + DM Sans via `next/font`
- [ ] Refactoring `AlthySphere.tsx` :
  sphère 3D CSS (`radial-gradient` + `backdrop-filter`), états idle/listening/streaming
- [ ] `SphereInput.tsx` : textarea + bouton micro (Web Speech API, fallback texte)
- [ ] `SphereStream.tsx` : rendu SSE token par token
- [ ] `ActionCard.tsx` : carte "Valider / Ignorer" avec animation slide-up
- [ ] `useSphere.ts` + `sphereStore.ts` : état global sphère
- [ ] Page `/app/sphere` : plein écran, sphère centrée, fond stone `#FAFAF8`
- [ ] Redirection `/app` → `/app/sphere` par défaut (dashboard accessible via nav)

**Livrable** : Ouvre l'app, tu vois la sphère, tu écris, elle répond en streaming.

---

### SPRINT 2 — IA contextuelle + intent parsing (semaine 2)
**Objectif : La sphère comprend le contexte immobilier et propose des actions.**

- [ ] `sphere_service.py` : orchestrateur d'intents
- [ ] Intent library (20 intents de base) :
  `relance_loyer`, `generer_quittance`, `creer_bail`, `signaler_intervention`,
  `trouver_artisan`, `lancer_annonce`, `scorer_locataire`, `estimer_bien`,
  `trouver_opener`, `rapport_financier`, `edl`, `resiliation`, etc.
- [ ] Context builder : récupère biens + loyers + locataires actifs → injecté dans prompt
- [ ] Rate limiting redis : 30/jour standard, 100/jour Pro
- [ ] `SuggestionChips.tsx` : 3-4 suggestions selon rôle + heure + contexte
- [ ] `ai_sessions` : sauvegarde chaque interaction en DB

**Livrable** : "Dupont n'a pas payé" → Althy identifie le locataire, propose la relance.

---

### SPRINT 3 — Biens + tableau de bord ultra-simple (semaine 3)
**Objectif : Dashboard 5 écrans fonctionnel. Pensé grand-père.**

- [ ] Refactoring design : appliquer Fraunces (titres) + DM Sans (corps) partout
- [ ] `KpiCard.tsx` : gros chiffre, label, couleur — ultra-lisible (font-size 28px+)
- [ ] Dashboard `/app` : 4 KPIs (loyers ce mois, impayés, biens actifs, actions à faire)
  + 1 liste courte "À faire aujourd'hui"
- [ ] `/app/biens` : liste cards avec photo, adresse, statut loyer (vert/rouge)
- [ ] Fiche bien 7 blocs : vérifier que tous les blocs sont complets
- [ ] `AlertBanner.tsx` : bannière rouge si impayé, jaune si action pending
- [ ] Sidebar simplifiée : 6 items max visibles (masquer les avancés)

**Livrable** : Un propriétaire de 60 ans comprend son dashboard en 10 secondes.

---

### SPRINT 4 — Loyers + Stripe Connect (semaine 4)
**Objectif : Le loyer arrive sur Althy, Althy reverse 96 % au proprio.**

- [ ] `stripe_service.py` : Stripe Connect + split payments
- [ ] `payments.py` router : CRUD + `/trigger-stripe` + `/remind`
- [ ] Celery worker : rappels automatiques J-3, J0, J+5, J+10 (relance progressive)
- [ ] Dashboard finances : loyers reçus (vert), attendus (gris), impayés (rouge)
- [ ] `SavingsWidget.tsx` : "CHF 328 économisés vs régie ce mois"
  (calcul : loyers × 10 % régie − CHF 29 abonnement)
- [ ] Stripe webhook : `payment_intent.succeeded` → mise à jour payment + notification
- [ ] Quittance auto générée après réception loyer
- [ ] Test bout en bout : locataire paye → 4 % prélevé → 96 % versé → quittance envoyée

**Livrable** : Premier loyer traité end-to-end via Althy.

---

### SPRINT 5 — Dossier locataire + CHF 90 à la réussite (semaine 5)
**Objectif : Tunnel complet candidat → sélection → prélèvement.**

- [ ] Page locataire `/app/locataires` + dossier `[id]`
- [ ] `TenantScoreRing.tsx` : cercle animé 0-100, couleur par score
- [ ] `DossierUpload.tsx` : upload pièces identité, fiches de salaire, etc.
- [ ] `ValidationModal.tsx` : "Sélectionner ce locataire → CHF 90 seront prélevés"
  disclaimer légal obligatoire + bouton "Confirmer"
- [ ] Stripe SetupIntent à l'inscription locataire (carte CB enregistrée sans prélèvement)
- [ ] `tenants.py` router : `/score` (IA) + `/select` (prélèvement) + `/reject` (gratuit)
- [ ] Email locataire retenu → félicitations + prochaines étapes
- [ ] Email locataire non retenu → dossier reste actif sur Althy

**Livrable** : "Candidatez gratuitement. Payez CHF 90 seulement si retenu."

---

### SPRINT 6 — Interventions + artisans (semaine 6)
**Objectif : "Ma chaudière est cassée" → 3 devis → 1 artisan confirmé en 1 tap.**

- [ ] `interventions.py` + `quotes.py` routers
- [ ] `InterventionCard.tsx` + `QuoteComparison.tsx` (IA compare et recommande)
- [ ] `ArtisanPicker.tsx` : map des artisans notés dans la zone
- [ ] Intent sphère : "Ma chaudière est cassée" → crée intervention → trouve artisans → demande devis
- [ ] Stripe Connect artisan : 90 % net + 10 % Althy
- [ ] Notifications artisan (email + SMS) : nouvelle mission disponible
- [ ] `missions.py` router : openers + flux confirmation/completion/paiement

**Livrable** : Intervention créée via sphère, devis comparés, sélection en 1 tap, artisan payé.

---

### SPRINT 7 — Documents IA + scan factures (semaine 7)
**Objectif : Documents illimités gratuits. Scan factures OCR.**

- [ ] `document_service.py` : bail, quittance, EDL, relance, résiliation — tous via Claude
- [ ] Disclaimer obligatoire sur chaque document généré par IA
- [ ] `documents.py` router complet
- [ ] `expenses.py` router + `ocr_service.py` : extraction montant/date/fournisseur
- [ ] `InvoiceScan.tsx` : drag & drop ou photo mobile
- [ ] Affectation IA : "Cette facture concerne Chemin des Fleurs 4 — Proprio ou locataire ?"
- [ ] OBLF suisse : règles codées (gros entretien = proprio, menu entretien = locataire)
- [ ] Export fiduciaire : PDF état locatif + Excel/CSV

**Livrable** : Quittance générée en 3 secondes. Facture scannée, catégorisée, exportable.

---

### SPRINT 8 — Abonnements + portail proprio + hunters (semaine 8)
**Objectif : Monétisation complète. CHF 29 prélevé. Portail proprio CHF 9. Hunters actifs.**

- [ ] `subscriptions.py` router : Stripe Checkout + Customer Portal
- [ ] Page `/app/abonnement` : plans avec toggle annuel/mensuel (−20 %)
- [ ] Trial 14 jours sans carte → CHF 29 au M15
- [ ] Portail proprio (CHF 9/mois) : vue lecture + messaging agence
- [ ] `messages.py` router : fil de conversation proprio ↔ agence
- [ ] `MessageThread.tsx` + `MessageBubble.tsx`
- [ ] Hunters : mise à jour statut par admin + paiement referral fee
- [ ] Usage IA limité selon plan (rate limit par subscription.plan)

**Livrable** : Premier abonnement payant. Portail proprio opérationnel.

---

### SPRINT 9 — Annonces + syndication portails (semaine 9)
**Objectif : "Je veux louer mon studio à partir de juin" → annonce publiée sur Homegate.**

- [ ] Intent sphère : génère titre + description IA → propose publication
- [ ] `listings.py` router complet (refactorisé, aligne DB et frontend)
- [ ] Page `/app/listings` : badges portails actifs/inactifs
- [ ] `PortalBadges.tsx` : Homegate, ImmoScout, Booking, Airbnb
- [ ] Syndication mock (M1) → vraie API (M6–M9)
- [ ] `offers.py` router : gestion offres acheteurs
- [ ] Intent "estimation" dans la sphère → appel `/ai/estimate` → résultat dans sphère

**Livrable** : Annonce créée via sphère, publiée, offres reçues.

---

### SPRINT 10 — Polish + mobile-first + SEO + go-live (semaine 10)
**Objectif : Prêt pour les 180 biens de l'agence. Zéro bug bloquant.**

- [ ] Audit complet mobile-first (iPhone SE, Android 360px)
- [ ] Lighthouse score > 90 sur toutes les pages publiques
- [ ] SEO : meta tags, OG images, sitemap.xml, robots.txt
- [ ] Landing page `/` : sphère en hero, pitch "louer c'est simple", CTA estimation
- [ ] Page `/demo` pour agences : démo interactive sans inscription
- [ ] Onboarding flow : inscription → choix rôle → premier bien ajouté → sphère active
- [ ] Error boundaries + Sentry configuré + BetterStack uptime
- [ ] Migration des données agence existante (180 biens)
- [ ] Tests e2e (Playwright) : parcours críticos (inscription, loyer, quittance, relance)
- [ ] Variables d'environnement production vérifiées

**Livrable** : go-live M1. Les 180 biens tournent sur Althy.

---

## Récapitulatif sprints

| Sprint | Focus | Livrable clé |
|--------|-------|--------------|
| 1 | Sphère IA + design | Sphère qui parle |
| 2 | Intent parsing + contexte | Actions proposées intelligemment |
| 3 | Dashboard + biens | Dashboard grand-père |
| 4 | Loyers + Stripe Connect | Premier loyer traité |
| 5 | Locataires + CHF 90 | Tunnel candidat complet |
| 6 | Interventions + artisans | Devis en 1 tap |
| 7 | Documents + scan factures | Quittances illimitées gratuites |
| 8 | Abonnements + portail | Premier CHF 29 prélevé |
| 9 | Annonces + portails | Annonce sur Homegate |
| 10 | Polish + go-live | 180 biens sur Althy |

---

*Planification complète — Prêt à implémenter sur instruction.*
