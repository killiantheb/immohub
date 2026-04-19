-- Migration 0029: Pricing v2 — ajout plans starter/agence_premium
-- Les anciens abonnés CHF 29/mois (plan = "pro" ou "proprio") sont "grandfathered"
-- et conservent leur plan actuel jusqu'à résiliation.

-- 1. Autoriser les nouveaux noms de plans dans la colonne subscriptions.plan
-- (pas de contrainte CHECK existante — on documente simplement les valeurs valides)
COMMENT ON COLUMN subscriptions.plan IS
  'Plan IDs valides: gratuit, starter, pro, agence, agence_premium, portail. Legacy: proprio → pro, solo → starter';

-- 2. Identifier les abonnés actuels sur l'ancien plan CHF 29/mois
-- Exécuter cette requête AVANT de changer les prix Stripe pour documenter les grandfathered users
-- SELECT
--   s.user_id,
--   u.email,
--   s.plan,
--   s.status,
--   s.stripe_subscription_id,
--   s.current_period_end,
--   s.created_at
-- FROM subscriptions s
-- JOIN auth.users u ON u.id = s.user_id
-- WHERE s.plan IN ('pro', 'proprio')
--   AND s.status = 'active'
--   AND s.is_active = true
-- ORDER BY s.created_at;

-- 3. Tag les abonnés grandfathered (ajout colonne)
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS is_grandfathered boolean DEFAULT false;

-- Marquer les abonnés actifs sur l'ancien plan CHF 29/mois
UPDATE subscriptions
SET is_grandfathered = true
WHERE plan IN ('pro', 'proprio')
  AND status = 'active'
  AND is_active = true;

-- 4. Mapper les legacy plan names
UPDATE subscriptions SET plan = 'pro' WHERE plan = 'proprio';
UPDATE subscriptions SET plan = 'starter' WHERE plan = 'solo';
UPDATE subscriptions SET plan = 'gratuit' WHERE plan IN ('decouverte', 'vitrine');
