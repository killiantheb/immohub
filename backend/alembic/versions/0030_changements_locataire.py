"""changements_locataire — table cycle changement de locataire.

Crée la table changements_locataire qui supporte le cycle complet :
    Phase 1 (Départ annoncé)
    Phase 2 (Recherche locataire)
    Phase 3 (Check-out + EDL sortie)
    Phase 4 (Check-in + EDL entrée)
    Terminé

Migration convertie depuis supabase/migrations/0028_changements_locataire.sql
(jamais appliquée en prod) pour aligner sur Alembic comme source unique de
vérité. Le numéro Alembic 0028 est déjà utilisé par 0028_normalize_legacy_roles
(sujet sans rapport) — d'où la conversion en 0030.

Le schéma est enrichi par rapport à la source Supabase pour couvrir le droit
suisse du bail et les workflows réels rencontrés par le fondateur.

Métier — 5 types de résiliation supportés (colonne type_resiliation) :
    - dans_delais_locataire :
        locataire respecte le préavis du bail (cas standard).
    - dans_delais_bailleur :
        bailleur résilie au terme avec motif (CO art. 271 / 271a).
    - anticipee_locataire :
        locataire part avant fin de bail, doit présenter un remplaçant
        solvable (CO art. 264) — d'où remplacant_trouve_par +
        frais_resiliation_anticipee.
    - anticipee_bailleur_defaut_paiement :
        urgence, loyers impayés (CO art. 257d) — résiliation extraordinaire.
    - autre :
        décès, force majeure, accord amiable (convention de sortie).

Endpoint consommateur :
    GET/POST/PUT /api/v1/biens/{bien_id}/changement/*
    backend/app/routers/changements.py — utilise du SQL brut text() (pas d'ORM).

Idempotente : tous les CREATE utilisent IF NOT EXISTS, les policies sont
wrappées dans des DO blocks qui testent pg_policies. Re-exécutable sans risque.

Revision ID: 0030
Revises: 0029
Create Date: 2026-04-27
"""

from __future__ import annotations

from alembic import op


revision = "0030"
down_revision = "0029"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Crée changements_locataire + index + trigger updated_at + RLS."""
    op.execute("""
        CREATE TABLE IF NOT EXISTS changements_locataire (
            id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            bien_id              UUID        NOT NULL REFERENCES biens(id) ON DELETE CASCADE,

            -- Phase courante
            phase                VARCHAR(30) NOT NULL DEFAULT 'depart_annonce',
            -- depart_annonce | recherche | checkout | checkin | termine

            statut               VARCHAR(20) NOT NULL DEFAULT 'en_cours',
            -- en_cours | termine | annule

            -- Phase 1 : Départ annoncé
            date_depart_prevu    DATE,
            checklist_depart     JSONB       NOT NULL DEFAULT '[]',
            -- [{ id, label, done }]

            -- Phase 2 : Recherche locataire
            annonce_publiee      BOOLEAN     NOT NULL DEFAULT false,

            -- Phase 3 : Check-out (EDL sortie)
            date_checkout        DATE,
            edl_sortie           JSONB       NOT NULL DEFAULT '{}',
            -- { pieces: [{ nom, etat, commentaire, photos: [] }], inventaire: {} }
            caution_retenue      NUMERIC(10,2),
            caution_motif        TEXT,

            -- Phase 4 : Check-in (EDL entrée)
            date_checkin         DATE,
            edl_entree           JSONB       NOT NULL DEFAULT '{}',
            nouveau_locataire_id UUID,        -- référence libre (locataires.id, pas de FK)
            bail_signe           BOOLEAN     NOT NULL DEFAULT false,
            premier_loyer_envoye BOOLEAN     NOT NULL DEFAULT false,

            -- Type et workflow de résiliation (cf. docstring §Métier)
            type_resiliation             VARCHAR(40),
            date_resiliation_envoyee     DATE,
            date_resiliation_validee     DATE,

            -- Recherche remplaçant (cas anticipée — CO art. 264)
            remplacant_trouve_par        VARCHAR(30),
            frais_resiliation_anticipee  NUMERIC(10,2),

            -- Convention de sortie et litiges
            convention_sortie_signee     BOOLEAN     NOT NULL DEFAULT false,
            litige_en_cours              BOOLEAN     NOT NULL DEFAULT false,

            created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

            CONSTRAINT ck_changements_locataire_type_resiliation CHECK (
                type_resiliation IS NULL OR type_resiliation IN (
                    'dans_delais_locataire',
                    'dans_delais_bailleur',
                    'anticipee_locataire',
                    'anticipee_bailleur_defaut_paiement',
                    'autre'
                )
            ),
            CONSTRAINT ck_changements_locataire_remplacant_trouve_par CHECK (
                remplacant_trouve_par IS NULL OR remplacant_trouve_par IN (
                    'locataire_sortant',
                    'bailleur',
                    'aucun'
                )
            )
        );
    """)

    op.execute("CREATE INDEX IF NOT EXISTS idx_cl_bien_id ON changements_locataire(bien_id);")
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_cl_statut ON changements_locataire(statut) "
        "WHERE statut = 'en_cours';"
    )
    op.execute("CREATE INDEX IF NOT EXISTS idx_cl_phase ON changements_locataire(phase);")
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_cl_type_resiliation "
        "ON changements_locataire(type_resiliation) "
        "WHERE type_resiliation IS NOT NULL;"
    )

    # Fonction trigger updated_at — partagée potentiellement avec d'autres tables.
    # CREATE OR REPLACE est safe.
    op.execute("""
        CREATE OR REPLACE FUNCTION _set_updated_at()
        RETURNS TRIGGER LANGUAGE plpgsql AS $$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        $$;
    """)

    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_trigger
                WHERE tgname = 'set_updated_at_changements_locataire'
            ) THEN
                CREATE TRIGGER set_updated_at_changements_locataire
                    BEFORE UPDATE ON changements_locataire
                    FOR EACH ROW EXECUTE FUNCTION _set_updated_at();
            END IF;
        END $$;
    """)

    # RLS
    op.execute("ALTER TABLE changements_locataire ENABLE ROW LEVEL SECURITY;")

    # Policy "owner_all" — propriétaire du bien accède à ses changements
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_policies
                WHERE schemaname = 'public'
                  AND tablename  = 'changements_locataire'
                  AND policyname = 'owner_all'
            ) THEN
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
            END IF;
        END $$;
    """)

    # Policy "service_role_all" — accès backend (Celery, scripts admin)
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_policies
                WHERE schemaname = 'public'
                  AND tablename  = 'changements_locataire'
                  AND policyname = 'service_role_all'
            ) THEN
                CREATE POLICY "service_role_all" ON changements_locataire
                    FOR ALL TO service_role
                    USING (true) WITH CHECK (true);
            END IF;
        END $$;
    """)


def downgrade() -> None:
    """Supprime la table changements_locataire et toutes ses dépendances.

    La fonction _set_updated_at() est conservée car potentiellement partagée
    avec d'autres triggers du schéma.
    """
    op.execute(
        "DROP TRIGGER IF EXISTS set_updated_at_changements_locataire "
        "ON changements_locataire;"
    )
    op.execute('DROP POLICY IF EXISTS "owner_all" ON changements_locataire;')
    op.execute('DROP POLICY IF EXISTS "service_role_all" ON changements_locataire;')
    op.execute("DROP INDEX IF EXISTS idx_cl_type_resiliation;")
    op.execute("DROP INDEX IF EXISTS idx_cl_phase;")
    op.execute("DROP INDEX IF EXISTS idx_cl_statut;")
    op.execute("DROP INDEX IF EXISTS idx_cl_bien_id;")
    op.execute("DROP TABLE IF EXISTS changements_locataire CASCADE;")
