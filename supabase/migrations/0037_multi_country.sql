-- ============================================================================
-- 0037_multi_country.sql
-- ----------------------------------------------------------------------------
-- Fondations multi-pays / multi-devise / multi-locale.
--
-- Contexte (2026-04-20) : Althy est aujourd'hui suisse uniquement (CHF, fr-CH).
-- Cette migration ajoute les colonnes nécessaires pour une expansion Europe
-- future (Y3-Y4 : FR, DE, IT) sans impact fonctionnel.
--
-- Toutes les colonnes ont une DEFAULT et sont NULLABLE → aucune donnée
-- existante n'est touchée. Retrocompatible 100%.
--
-- Colonnes ajoutées :
--   * currency      TEXT DEFAULT 'CHF'    → ISO-4217 (CHF, EUR, GBP, ...)
--   * country       TEXT DEFAULT 'CH'     → ISO-3166-1 alpha-2 (CH, FR, DE, IT)
--   * locale        TEXT DEFAULT 'fr-CH'  → BCP-47 (fr-CH, de-CH, fr-FR, ...)
--
-- Tables impactées :
--   properties, biens, contracts, subscriptions, transactions,
--   loyer_transactions (proxy invoices via QR-facture SPC 2.0),
--   profiles, companies
-- ============================================================================

-- ── Biens : devise du loyer + pays ───────────────────────────────────────────
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'CHF',
  ADD COLUMN IF NOT EXISTS country  TEXT DEFAULT 'CH';

ALTER TABLE biens
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'CHF',
  ADD COLUMN IF NOT EXISTS country  TEXT DEFAULT 'CH';

-- ── Contrats : devise du loyer et des charges ────────────────────────────────
ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'CHF';

-- ── Abonnements : devise de facturation Stripe ───────────────────────────────
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'CHF';

-- ── Transactions (flux financiers génériques) ────────────────────────────────
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'CHF';

-- ── loyer_transactions (proxy "invoices" pour QR-facture SPC 2.0) ────────────
-- Pas de table dédiée "invoices" dans Althy : les QR-factures transitent par
-- loyer_transactions (migration 0026). On ajoute currency pour permettre
-- l'émission de factures SEPA (EUR) en plus des QR-factures suisses (CHF),
-- et bank_country pour router le bon parser de relevé bancaire.
ALTER TABLE loyer_transactions
  ADD COLUMN IF NOT EXISTS currency     TEXT DEFAULT 'CHF',
  ADD COLUMN IF NOT EXISTS bank_country TEXT DEFAULT 'CH';

-- ── Profils utilisateurs : pays + locale de l'interface ──────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'CH',
  ADD COLUMN IF NOT EXISTS locale  TEXT DEFAULT 'fr-CH';

-- ── Companies (agences, artisans) : pays de l'entité ─────────────────────────
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'CH';

-- ── Contraintes de format (checks légers, pas de FK référentielle) ───────────
-- ISO-4217 : 3 lettres majuscules
ALTER TABLE properties         DROP CONSTRAINT IF EXISTS properties_currency_fmt;
ALTER TABLE properties         ADD  CONSTRAINT properties_currency_fmt
  CHECK (currency ~ '^[A-Z]{3}$');

ALTER TABLE biens              DROP CONSTRAINT IF EXISTS biens_currency_fmt;
ALTER TABLE biens              ADD  CONSTRAINT biens_currency_fmt
  CHECK (currency ~ '^[A-Z]{3}$');

ALTER TABLE contracts          DROP CONSTRAINT IF EXISTS contracts_currency_fmt;
ALTER TABLE contracts          ADD  CONSTRAINT contracts_currency_fmt
  CHECK (currency ~ '^[A-Z]{3}$');

ALTER TABLE subscriptions      DROP CONSTRAINT IF EXISTS subscriptions_currency_fmt;
ALTER TABLE subscriptions      ADD  CONSTRAINT subscriptions_currency_fmt
  CHECK (currency ~ '^[A-Z]{3}$');

ALTER TABLE transactions       DROP CONSTRAINT IF EXISTS transactions_currency_fmt;
ALTER TABLE transactions       ADD  CONSTRAINT transactions_currency_fmt
  CHECK (currency ~ '^[A-Z]{3}$');

ALTER TABLE loyer_transactions DROP CONSTRAINT IF EXISTS loyer_transactions_currency_fmt;
ALTER TABLE loyer_transactions ADD  CONSTRAINT loyer_transactions_currency_fmt
  CHECK (currency ~ '^[A-Z]{3}$');

-- ISO-3166-1 alpha-2 : 2 lettres majuscules
ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_country_fmt;
ALTER TABLE properties ADD  CONSTRAINT properties_country_fmt
  CHECK (country ~ '^[A-Z]{2}$');

ALTER TABLE biens      DROP CONSTRAINT IF EXISTS biens_country_fmt;
ALTER TABLE biens      ADD  CONSTRAINT biens_country_fmt
  CHECK (country ~ '^[A-Z]{2}$');

ALTER TABLE profiles   DROP CONSTRAINT IF EXISTS profiles_country_fmt;
ALTER TABLE profiles   ADD  CONSTRAINT profiles_country_fmt
  CHECK (country ~ '^[A-Z]{2}$');

ALTER TABLE companies  DROP CONSTRAINT IF EXISTS companies_country_fmt;
ALTER TABLE companies  ADD  CONSTRAINT companies_country_fmt
  CHECK (country ~ '^[A-Z]{2}$');

ALTER TABLE loyer_transactions DROP CONSTRAINT IF EXISTS loyer_transactions_bank_country_fmt;
ALTER TABLE loyer_transactions ADD  CONSTRAINT loyer_transactions_bank_country_fmt
  CHECK (bank_country ~ '^[A-Z]{2}$');

-- BCP-47 locale : xx ou xx-XX
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_locale_fmt;
ALTER TABLE profiles ADD  CONSTRAINT profiles_locale_fmt
  CHECK (locale ~ '^[a-z]{2}(-[A-Z]{2})?$');

-- ── Index utiles pour filtrer par pays (futurs tableaux admin) ───────────────
CREATE INDEX IF NOT EXISTS idx_properties_country ON properties(country);
CREATE INDEX IF NOT EXISTS idx_biens_country      ON biens(country);
CREATE INDEX IF NOT EXISTS idx_profiles_country   ON profiles(country);
CREATE INDEX IF NOT EXISTS idx_profiles_locale    ON profiles(locale);
CREATE INDEX IF NOT EXISTS idx_companies_country  ON companies(country);

-- ── Commentaires pour documentation schema ──────────────────────────────────
COMMENT ON COLUMN properties.currency         IS 'ISO-4217 (CHF par défaut). Devise du loyer affiché.';
COMMENT ON COLUMN properties.country          IS 'ISO-3166-1 alpha-2 (CH par défaut). Pays du bien.';
COMMENT ON COLUMN biens.currency              IS 'ISO-4217 (CHF par défaut). Devise du loyer affiché.';
COMMENT ON COLUMN biens.country               IS 'ISO-3166-1 alpha-2 (CH par défaut). Pays du bien.';
COMMENT ON COLUMN contracts.currency          IS 'ISO-4217. Devise du contrat (loyer, charges, caution).';
COMMENT ON COLUMN subscriptions.currency      IS 'ISO-4217. Devise de facturation Stripe.';
COMMENT ON COLUMN transactions.currency       IS 'ISO-4217. Devise du flux.';
COMMENT ON COLUMN loyer_transactions.currency     IS 'ISO-4217. Devise de la facture (QR CHF ou SEPA EUR).';
COMMENT ON COLUMN loyer_transactions.bank_country IS 'ISO-3166-1 alpha-2. Pays de la banque destinataire (route le parser CAMT).';
COMMENT ON COLUMN profiles.country            IS 'ISO-3166-1 alpha-2. Pays de résidence fiscale.';
COMMENT ON COLUMN profiles.locale             IS 'BCP-47 (fr-CH, de-CH, fr-FR, de-DE, it-CH, it-IT, en).';
COMMENT ON COLUMN companies.country           IS 'ISO-3166-1 alpha-2. Pays de l''entité légale.';
