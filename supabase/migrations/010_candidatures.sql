-- 010_candidatures.sql
-- Table des candidatures au dossier (locataires postulant pour un bien)

CREATE TABLE IF NOT EXISTS candidatures (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id          UUID        NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id             UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  statut              VARCHAR(20) NOT NULL DEFAULT 'en_attente'
                        CHECK (statut IN ('en_attente', 'acceptee', 'refusee', 'retiree')),
  documents           JSONB       NOT NULL DEFAULT '[]',  -- [{type, url, nom}]
  message             TEXT,
  score_ia            FLOAT,                              -- 0-100, null jusqu'au scoring
  score_details       JSONB,                              -- {recommendation, risk_flags, summary}
  frais_payes         BOOLEAN     NOT NULL DEFAULT FALSE, -- CHF 90 réglés par le locataire retenu
  stripe_pi_id        TEXT,                               -- PaymentIntent frais dossier
  visite_proposee_at  TIMESTAMPTZ,
  ouvreur_id          UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ,

  -- Un user ne peut postuler qu'une seule fois par listing
  CONSTRAINT uq_candidature_user_listing UNIQUE (user_id, listing_id)
);

-- Index performances
CREATE INDEX IF NOT EXISTS ix_candidatures_listing_id ON candidatures(listing_id);
CREATE INDEX IF NOT EXISTS ix_candidatures_user_id    ON candidatures(user_id);
CREATE INDEX IF NOT EXISTS ix_candidatures_statut     ON candidatures(statut);
CREATE INDEX IF NOT EXISTS ix_candidatures_score      ON candidatures(score_ia DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS ix_candidatures_created    ON candidatures(created_at DESC);

-- ── RLS ────────────────────────────────────────────────────────────────────────
ALTER TABLE candidatures ENABLE ROW LEVEL SECURITY;

-- Candidat voit sa propre candidature
CREATE POLICY IF NOT EXISTS "cand_own_read"
  ON candidatures FOR SELECT
  USING (user_id = auth.uid()::uuid);

-- Candidat peut créer sa propre candidature
CREATE POLICY IF NOT EXISTS "cand_own_insert"
  ON candidatures FOR INSERT
  WITH CHECK (user_id = auth.uid()::uuid);

-- Candidat peut retirer sa candidature (statut → retiree uniquement)
CREATE POLICY IF NOT EXISTS "cand_own_withdraw"
  ON candidatures FOR UPDATE
  USING (user_id = auth.uid()::uuid)
  WITH CHECK (statut = 'retiree');

-- Propriétaire/agence voit les candidatures de ses listings
CREATE POLICY IF NOT EXISTS "cand_proprio_read"
  ON candidatures FOR SELECT
  USING (
    listing_id IN (
      SELECT l.id FROM listings l
      JOIN properties p ON p.id = l.property_id
      WHERE p.owner_id = auth.uid()::uuid
         OR p.agency_id = auth.uid()::uuid
    )
  );

-- Propriétaire/agence peut accepter ou refuser
CREATE POLICY IF NOT EXISTS "cand_proprio_update"
  ON candidatures FOR UPDATE
  USING (
    listing_id IN (
      SELECT l.id FROM listings l
      JOIN properties p ON p.id = l.property_id
      WHERE p.owner_id = auth.uid()::uuid
         OR p.agency_id = auth.uid()::uuid
    )
  );

-- ── Trigger : notifier listing contacts_count ──────────────────────────────────
-- Le trigger tg_listing_swipes (migration 009) gère swipes_count.
-- contacts_count est incrémenté depuis le backend au moment de la candidature.
