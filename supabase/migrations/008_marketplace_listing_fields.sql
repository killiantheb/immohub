-- 008_marketplace_listing_fields.sql
-- Champs marketplace publique sur la table listings

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS transaction_type VARCHAR(20) NOT NULL DEFAULT 'location'
    CHECK (transaction_type IN ('location', 'vente', 'colocation')),
  ADD COLUMN IF NOT EXISTS lat FLOAT,
  ADD COLUMN IF NOT EXISTS lng FLOAT,
  ADD COLUMN IF NOT EXISTS adresse_affichee TEXT,
  ADD COLUMN IF NOT EXISTS photos JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS tags_ia JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS is_premium BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS expire_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS swipes_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contacts_count INTEGER NOT NULL DEFAULT 0;

-- Index performance
CREATE INDEX IF NOT EXISTS ix_listings_transaction_type ON listings(transaction_type);
CREATE INDEX IF NOT EXISTS ix_listings_premium ON listings(is_premium) WHERE is_premium = TRUE;
CREATE INDEX IF NOT EXISTS ix_listings_geopoint ON listings(lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_listings_expire_at ON listings(expire_at) WHERE expire_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_listings_tags_ia ON listings USING gin(tags_ia);
CREATE INDEX IF NOT EXISTS ix_listings_photos ON listings USING gin(photos);

-- RLS : lecture publique des listings actifs
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "listings_public_read"
  ON listings FOR SELECT
  USING (status = 'active' AND is_active = TRUE);
