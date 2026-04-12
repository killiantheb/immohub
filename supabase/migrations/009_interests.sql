-- 009_interests.sql
-- Table d'intérêts swipe (connecté = user_id, anonyme = session_id)

CREATE TABLE IF NOT EXISTS interests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id  TEXT,
  status      TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'contacted', 'rejected')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Au moins l'un des deux doit être renseigné
  CONSTRAINT interests_requires_identity CHECK (user_id IS NOT NULL OR session_id IS NOT NULL)
);

-- Unicité : un user/session ne peut swiper qu'une fois par listing
CREATE UNIQUE INDEX IF NOT EXISTS uq_interests_user_listing
  ON interests(user_id, listing_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_interests_session_listing
  ON interests(session_id, listing_id)
  WHERE session_id IS NOT NULL;

-- Index performances
CREATE INDEX IF NOT EXISTS ix_interests_listing_id  ON interests(listing_id);
CREATE INDEX IF NOT EXISTS ix_interests_user_id     ON interests(user_id)     WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_interests_session_id  ON interests(session_id)  WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_interests_created_at  ON interests(created_at DESC);

-- RLS
ALTER TABLE interests ENABLE ROW LEVEL SECURITY;

-- Un user connecté voit uniquement ses propres intérêts
CREATE POLICY IF NOT EXISTS "interests_own_read"
  ON interests FOR SELECT
  USING (user_id = auth.uid()::uuid);

-- Un user connecté peut créer ses propres intérêts
CREATE POLICY IF NOT EXISTS "interests_own_insert"
  ON interests FOR INSERT
  WITH CHECK (user_id = auth.uid()::uuid OR user_id IS NULL);

-- Le propriétaire du listing voit qui a swipé son bien (via FK property → owner)
CREATE POLICY IF NOT EXISTS "interests_bailleur_read"
  ON interests FOR SELECT
  USING (
    listing_id IN (
      SELECT l.id FROM listings l
      JOIN properties p ON p.id = l.property_id
      WHERE p.owner_id = auth.uid()::uuid
    )
  );

-- incrémente swipes_count sur listings après chaque intérêt
CREATE OR REPLACE FUNCTION increment_listing_swipes()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE listings SET swipes_count = COALESCE(swipes_count, 0) + 1
  WHERE id = NEW.listing_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_listing_swipes ON interests;
CREATE TRIGGER tg_listing_swipes
  AFTER INSERT ON interests
  FOR EACH ROW EXECUTE FUNCTION increment_listing_swipes();
