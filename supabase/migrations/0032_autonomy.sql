-- Migration 0032 : Althy Autonomie (A4) — table dédiée pour le pivot stratégique
-- Date : 2026-04-20
--
-- Le plan "autonomie" (CHF 39/mois) est le cheval de Troie anti-agence :
-- un propriétaire invité (A6 CHF 9) peut basculer en Autonomie et quitter
-- son agence tout en conservant les outils Althy + 4 vérifications locataires
-- + 4 missions ouvreur + assistance juridique + partenariat assurance
-- inclus pour l'année courante.
--
-- Cette table suit les abonnements Autonomie indépendamment de la table
-- `subscriptions` (qui gère Stripe) car elle stocke des compteurs métier.

-- ═════════════════════════════════════════════════════════════════════════════
-- 1. Table autonomy_subscriptions
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS autonomy_subscriptions (
  id                                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                                    uuid NOT NULL UNIQUE
                                             REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_subscription_id                     text,
  status                                     text NOT NULL DEFAULT 'active'
                                             CHECK (status IN ('active', 'paused', 'cancelled')),
  started_at                                 timestamptz NOT NULL DEFAULT now(),
  cancelled_at                               timestamptz,
  cancellation_reason                        text,
  previous_agency_id                         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  included_verifications_used_this_year      integer NOT NULL DEFAULT 0,
  included_opener_missions_used_this_year    integer NOT NULL DEFAULT 0,
  legal_assistance_included                  boolean NOT NULL DEFAULT true,
  insurance_partner_id                       text,
  is_active                                  boolean NOT NULL DEFAULT true,
  created_at                                 timestamptz NOT NULL DEFAULT now(),
  updated_at                                 timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_autonomy_subscriptions_user
  ON autonomy_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_autonomy_subscriptions_status
  ON autonomy_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_autonomy_subscriptions_stripe
  ON autonomy_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_autonomy_subscriptions_previous_agency
  ON autonomy_subscriptions(previous_agency_id);

COMMENT ON TABLE autonomy_subscriptions IS
  'Althy Autonomie (A4) — CHF 39/mois. Compteurs annuels + historique agence quittée.';
COMMENT ON COLUMN autonomy_subscriptions.previous_agency_id IS
  'Agence quittée lors de la bascule (pour pilotage churn agences).';
COMMENT ON COLUMN autonomy_subscriptions.included_verifications_used_this_year IS
  'Vérifications locataires consommées sur les 4 incluses dans l''année civile.';
COMMENT ON COLUMN autonomy_subscriptions.included_opener_missions_used_this_year IS
  'Missions ouvreur (visite / check-in / check-out / EDL) consommées sur les 4 incluses.';

-- ═════════════════════════════════════════════════════════════════════════════
-- 2. Trigger updated_at
-- ═════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION set_autonomy_subscriptions_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_autonomy_subscriptions_updated_at ON autonomy_subscriptions;
CREATE TRIGGER trg_autonomy_subscriptions_updated_at
  BEFORE UPDATE ON autonomy_subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_autonomy_subscriptions_updated_at();

-- ═════════════════════════════════════════════════════════════════════════════
-- 3. Row Level Security
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE autonomy_subscriptions ENABLE ROW LEVEL SECURITY;

-- Lecture : l'utilisateur voit son propre abonnement
DROP POLICY IF EXISTS "autonomy_own_read" ON autonomy_subscriptions;
CREATE POLICY "autonomy_own_read"
  ON autonomy_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Insertion : service_role uniquement (via webhook Stripe ou backend)
-- Pas de policy INSERT → bloqué par défaut pour authenticated.

-- Mise à jour : l'utilisateur peut mettre à jour la raison de résiliation
-- (les compteurs sont verrouillés côté backend via service_role).
DROP POLICY IF EXISTS "autonomy_own_update_reason" ON autonomy_subscriptions;
CREATE POLICY "autonomy_own_update_reason"
  ON autonomy_subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ═════════════════════════════════════════════════════════════════════════════
-- 4. Fin
-- ═════════════════════════════════════════════════════════════════════════════

-- Vérification : SELECT * FROM autonomy_subscriptions LIMIT 1;
