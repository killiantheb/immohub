-- Migration 0031 : Pricing v3 — 7 tiers + Althy Autonomie + comptes invités
-- Date : 2026-04-20
--
-- Nouveaux plans :
--   A1 starter        CHF 14/mois  (1-3 biens)        — existant, scope élargi
--   A2 pro            CHF 29/mois  (4-10 biens)       — existant, scope élargi
--   A3 proprio_pro    CHF 79/mois  (11-50 biens)      — NOUVEAU
--   A4 autonomie      CHF 39/mois  (pivot anti-agence)— NOUVEAU
--   A5 agence         CHF 49/mois  (baissé de CHF 79) — REPRICING
--   A6 invite         CHF 9/mois   (compte invité)    — NOUVEAU
--   A7 enterprise     CHF 1500+/mois (white-label)    — NOUVEAU (remplace agence_premium)
--
-- Grandfathering : les abonnés actuels en plan "agence" (CHF 79) conservent leur
-- prix jusqu'à résiliation manuelle, marqués via subscriptions.is_grandfathered.

-- ═════════════════════════════════════════════════════════════════════════════
-- 1. Étendre profiles avec plan_category + grandfathered_price
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS plan_id text,
  ADD COLUMN IF NOT EXISTS plan_category text,
  ADD COLUMN IF NOT EXISTS grandfathered_price numeric(10, 2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_plan_category_check'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_plan_category_check
      CHECK (plan_category IS NULL OR plan_category IN (
        'proprio', 'agence', 'invited', 'enterprise', 'autonomie'
      ));
  END IF;
END $$;

COMMENT ON COLUMN profiles.plan_id IS
  'Plan canonique : gratuit, starter, pro, proprio_pro, autonomie, agence, enterprise, invite';
COMMENT ON COLUMN profiles.plan_category IS
  'Catégorie : proprio | agence | invited | enterprise | autonomie';
COMMENT ON COLUMN profiles.grandfathered_price IS
  'Prix verrouillé pour les abonnés legacy (NULL = prix courant). Ex: CHF 79 pour ex-agence_standard.';

-- ═════════════════════════════════════════════════════════════════════════════
-- 2. Subscriptions : autoriser les nouveaux plan IDs + grandfathered_price
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS grandfathered_price numeric(10, 2);

COMMENT ON COLUMN subscriptions.plan IS
  'Plan IDs valides v3 : gratuit, starter, pro, proprio_pro, autonomie, agence, enterprise, invite, portail. Legacy: agence_premium → enterprise, proprio → pro, solo → starter';

-- ═════════════════════════════════════════════════════════════════════════════
-- 3. Table agency_relationships — proprio rattaché à une agence Althy
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS agency_relationships (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  proprio_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status        text NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'left_for_autonomy', 'archived')),
  monthly_fee   numeric(10, 2) NOT NULL DEFAULT 9.00,
  created_at    timestamptz NOT NULL DEFAULT now(),
  left_at       timestamptz,
  notes         text,
  UNIQUE (agency_id, proprio_id)
);

CREATE INDEX IF NOT EXISTS idx_agency_relationships_agency
  ON agency_relationships(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_relationships_proprio
  ON agency_relationships(proprio_id);
CREATE INDEX IF NOT EXISTS idx_agency_relationships_status
  ON agency_relationships(status);

COMMENT ON TABLE agency_relationships IS
  'Relation agence ↔ proprio invité (A6). Quand le proprio passe en autonomie (A4), status = left_for_autonomy.';

-- RLS : agence et proprio peuvent voir leur propre relation
ALTER TABLE agency_relationships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agency_relationships_select_own ON agency_relationships;
CREATE POLICY agency_relationships_select_own ON agency_relationships
  FOR SELECT USING (
    auth.uid() = agency_id OR auth.uid() = proprio_id
  );

DROP POLICY IF EXISTS agency_relationships_insert_agency ON agency_relationships;
CREATE POLICY agency_relationships_insert_agency ON agency_relationships
  FOR INSERT WITH CHECK (auth.uid() = agency_id);

DROP POLICY IF EXISTS agency_relationships_update_either ON agency_relationships;
CREATE POLICY agency_relationships_update_either ON agency_relationships
  FOR UPDATE USING (auth.uid() = agency_id OR auth.uid() = proprio_id);

-- ═════════════════════════════════════════════════════════════════════════════
-- 4. Rétro-migration : verrouiller le prix CHF 79 pour les agences existantes
-- ═════════════════════════════════════════════════════════════════════════════

-- Map agence_premium → enterprise (renommage du plan)
UPDATE subscriptions
   SET plan = 'enterprise'
 WHERE plan = 'agence_premium';

-- Verrouiller le prix CHF 79 pour les agences actuelles (grandfathering)
-- Renouvellement futur : facture toujours à CHF 79 jusqu'à résiliation/changement
UPDATE subscriptions
   SET grandfathered_price = 79.00,
       is_grandfathered    = true
 WHERE plan = 'agence'
   AND status = 'active'
   AND is_active = true
   AND grandfathered_price IS NULL;

-- Sync profiles.plan_category depuis subscriptions actives
UPDATE profiles p
   SET plan_id       = s.plan,
       plan_category = CASE
         WHEN s.plan IN ('gratuit', 'starter', 'pro', 'proprio_pro') THEN 'proprio'
         WHEN s.plan = 'autonomie'                                   THEN 'autonomie'
         WHEN s.plan = 'agence'                                      THEN 'agence'
         WHEN s.plan = 'enterprise'                                  THEN 'enterprise'
         WHEN s.plan = 'invite'                                      THEN 'invited'
         ELSE 'proprio'
       END,
       grandfathered_price = s.grandfathered_price
  FROM subscriptions s
 WHERE s.user_id = p.user_id
   AND s.is_active = true
   AND s.status    = 'active';
