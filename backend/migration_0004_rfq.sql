-- Migration 0004: RFQ marketplace tables + Company city/zip_code columns
-- Run this in Supabase SQL editor

-- ── Enums ─────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE rfq_category_enum AS ENUM (
    'plumbing', 'electricity', 'cleaning', 'painting', 'locksmith',
    'roofing', 'gardening', 'masonry', 'hvac', 'renovation', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE rfq_status_enum AS ENUM (
    'draft', 'published', 'quotes_received', 'accepted',
    'in_progress', 'completed', 'rated', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE rfq_urgency_enum AS ENUM ('low', 'medium', 'high', 'emergency');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE rfq_quote_status_enum AS ENUM ('pending', 'accepted', 'rejected', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Companies: add city + zip_code columns ────────────────────────────────────

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS city     VARCHAR(100),
  ADD COLUMN IF NOT EXISTS zip_code VARCHAR(10);

-- ── RFQs table ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rfqs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  property_id      UUID REFERENCES properties(id) ON DELETE SET NULL,

  title            VARCHAR(255) NOT NULL,
  description      TEXT         NOT NULL,
  category         rfq_category_enum NOT NULL,
  ai_detected      BOOLEAN NOT NULL DEFAULT false,

  status           rfq_status_enum NOT NULL DEFAULT 'draft',
  urgency          rfq_urgency_enum NOT NULL DEFAULT 'medium',

  city             VARCHAR(100),
  zip_code         VARCHAR(10),

  budget_min       NUMERIC(12, 2),
  budget_max       NUMERIC(12, 2),
  scheduled_date   TIMESTAMPTZ,

  selected_quote_id UUID,
  commission_amount NUMERIC(12, 2),

  published_at     TIMESTAMPTZ,
  accepted_at      TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,

  rating_given     NUMERIC(3, 2),
  rating_comment   TEXT,

  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_rfqs_owner_id  ON rfqs(owner_id);
CREATE INDEX IF NOT EXISTS ix_rfqs_status    ON rfqs(status);
CREATE INDEX IF NOT EXISTS ix_rfqs_category  ON rfqs(category);

-- ── RFQ Quotes table ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rfq_quotes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id           UUID NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  company_id       UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  amount           NUMERIC(12, 2) NOT NULL,
  description      TEXT NOT NULL,
  delay_days       INTEGER,
  warranty_months  INTEGER,
  notes            TEXT,

  status           rfq_quote_status_enum NOT NULL DEFAULT 'pending',

  submitted_at     TIMESTAMPTZ,
  accepted_at      TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,

  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_rfq_quotes_rfq_id     ON rfq_quotes(rfq_id);
CREATE INDEX IF NOT EXISTS ix_rfq_quotes_company_id ON rfq_quotes(company_id);
CREATE INDEX IF NOT EXISTS ix_rfq_quotes_status     ON rfq_quotes(status);
