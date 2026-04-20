-- ═════════════════════════════════════════════════════════════════════════════
-- Migration 0033 — Pivot facturation dossier locataire
--
-- Le locataire ne paie plus JAMAIS les frais de dossier.
-- Le propriétaire est facturé CHF 45 lorsqu'il accepte une candidature.
--
-- Ancien flux supprimé : tenant paie CHF 90 après acceptation (Stripe PI côté locataire).
-- Nouveau flux : owner paie CHF 45 automatiquement lors de PATCH statut='acceptee'.
--
-- Rétro-compatibilité : les colonnes legacy `frais_payes` et `stripe_pi_id` sont
-- conservées pour préserver l'historique. Aucune facturation rétroactive.
-- ═════════════════════════════════════════════════════════════════════════════

-- 1. Nouvelles colonnes facturation propriétaire ──────────────────────────────

ALTER TABLE candidatures
    ADD COLUMN IF NOT EXISTS owner_fee_amount           NUMERIC(10, 2) NOT NULL DEFAULT 45.00,
    ADD COLUMN IF NOT EXISTS owner_fee_paid_at          TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS owner_fee_stripe_intent_id TEXT,
    ADD COLUMN IF NOT EXISTS owner_fee_failed_at        TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS owner_fee_failure_reason   TEXT;

COMMENT ON COLUMN candidatures.owner_fee_amount           IS 'Montant facturé au propriétaire lors de l''acceptation (CHF, défaut 45).';
COMMENT ON COLUMN candidatures.owner_fee_paid_at          IS 'Date du prélèvement confirmé — NULL si pas encore prélevé.';
COMMENT ON COLUMN candidatures.owner_fee_stripe_intent_id IS 'ID du PaymentIntent Stripe (off_session) pour traçabilité.';
COMMENT ON COLUMN candidatures.owner_fee_failed_at        IS 'Horodatage du dernier échec de prélèvement (ne bloque pas l''acceptation).';
COMMENT ON COLUMN candidatures.owner_fee_failure_reason   IS 'Raison fournie par Stripe (card_declined, insufficient_funds, ...).';

-- 2. Index pour requêtes de facturation/reporting ─────────────────────────────

CREATE INDEX IF NOT EXISTS ix_candidatures_owner_fee_paid
    ON candidatures (owner_fee_paid_at)
    WHERE owner_fee_paid_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_candidatures_owner_fee_pending
    ON candidatures (statut)
    WHERE statut = 'acceptee' AND owner_fee_paid_at IS NULL;

-- 3. Marquer les colonnes legacy (tenant) comme obsolètes ─────────────────────
-- On NE SUPPRIME PAS `frais_payes` et `stripe_pi_id` — elles restent lisibles pour
-- l'audit des anciens dossiers (avant 2026-04-20) mais ne sont plus écrites.

COMMENT ON COLUMN candidatures.frais_payes  IS 'DEPRECATED (2026-04-20) — ancien flag tenant CHF 90. Non utilisé pour les nouvelles candidatures.';
COMMENT ON COLUMN candidatures.stripe_pi_id IS 'DEPRECATED (2026-04-20) — ancien PaymentIntent tenant. Voir owner_fee_stripe_intent_id.';

-- 4. RLS — assurer que seuls le propriétaire du bien et super_admin voient le prélèvement
-- (la RLS candidatures existante couvre déjà l'accès ; aucune colonne n'est exposée au locataire)
-- Aucun changement RLS nécessaire : les policies existantes sur `candidatures` s'appliquent
-- automatiquement aux nouvelles colonnes.
