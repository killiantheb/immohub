-- ── Migration 0028 — changements_locataire ────────────────────────────────────
-- Suivi du cycle complet de changement de locataire :
-- départ annoncé → recherche → check-out (EDL sortie) → check-in (EDL entrée)

CREATE TABLE IF NOT EXISTS changements_locataire (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    bien_id              UUID        NOT NULL REFERENCES biens(id) ON DELETE CASCADE,

    -- Phase courante
    phase                VARCHAR(30) NOT NULL DEFAULT 'depart_annonce',
    -- depart_annonce | recherche | checkout | checkin | termine

    statut               VARCHAR(20) NOT NULL DEFAULT 'en_cours',
    -- en_cours | termine | annule

    -- ── Phase 1 : Départ annoncé ──────────────────────────────────────────────
    date_depart_prevu    DATE,
    checklist_depart     JSONB       NOT NULL DEFAULT '[]',
    -- [{ id, label, done }]

    -- ── Phase 2 : Recherche locataire ─────────────────────────────────────────
    annonce_publiee      BOOLEAN     NOT NULL DEFAULT false,

    -- ── Phase 3 : Check-out (EDL sortie) ─────────────────────────────────────
    date_checkout        DATE,
    edl_sortie           JSONB       NOT NULL DEFAULT '{}',
    -- { pieces: [{ nom, etat, commentaire, photos: [] }], inventaire: {} }
    caution_retenue      NUMERIC(10,2),
    caution_motif        TEXT,

    -- ── Phase 4 : Check-in (EDL entrée) ──────────────────────────────────────
    date_checkin         DATE,
    edl_entree           JSONB       NOT NULL DEFAULT '{}',
    nouveau_locataire_id UUID,        -- référence libre (locataires.id)
    bail_signe           BOOLEAN     NOT NULL DEFAULT false,
    premier_loyer_envoye BOOLEAN     NOT NULL DEFAULT false,

    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index utiles
CREATE INDEX IF NOT EXISTS idx_cl_bien_id  ON changements_locataire(bien_id);
CREATE INDEX IF NOT EXISTS idx_cl_statut   ON changements_locataire(statut) WHERE statut = 'en_cours';
CREATE INDEX IF NOT EXISTS idx_cl_phase    ON changements_locataire(phase);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION _set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_changements_locataire'
  ) THEN
    CREATE TRIGGER set_updated_at_changements_locataire
      BEFORE UPDATE ON changements_locataire
      FOR EACH ROW EXECUTE FUNCTION _set_updated_at();
  END IF;
END $$;

-- RLS
ALTER TABLE changements_locataire ENABLE ROW LEVEL SECURITY;

-- Le propriétaire du bien accède à ses changements
CREATE POLICY "owner_all" ON changements_locataire
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM biens
            WHERE biens.id = changements_locataire.bien_id
              AND biens.owner_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM biens
            WHERE biens.id = changements_locataire.bien_id
              AND biens.owner_id = auth.uid()
        )
    );

-- Service role (Celery / backend direct)
CREATE POLICY "service_role_all" ON changements_locataire
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);
