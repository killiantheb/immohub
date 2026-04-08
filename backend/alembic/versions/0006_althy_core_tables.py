"""Althy core tables — 13 tables du modèle métier.

Revision ID: 0006
Revises: 0005
Create Date: 2026-04-08
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None

# Helper: create enum idempotently via DO block (works with asyncpg)
def _create_enum(name: str, *values: str) -> None:
    labels = ", ".join(f"'{v}'" for v in values)
    op.execute(f"""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '{name}') THEN
                CREATE TYPE {name} AS ENUM ({labels});
            END IF;
        END $$;
    """)

# Enum column that never auto-creates the type (we handle it above)
def _enum(name: str) -> sa.Enum:
    return sa.Enum(name=name, create_type=False)


def upgrade() -> None:
    # ── 1. users — colonne adresse ─────────────────────────────────────────────
    # Add only if missing (idempotent)
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'users' AND column_name = 'adresse'
            ) THEN
                ALTER TABLE users ADD COLUMN adresse VARCHAR(300);
            END IF;
        END $$;
    """)

    # ── 2. Enums (idempotent) ──────────────────────────────────────────────────
    _create_enum("bien_type_enum",
        "appartement", "villa", "studio", "maison", "commerce",
        "bureau", "parking", "garage", "cave", "autre")
    _create_enum("bien_statut_enum", "loue", "vacant", "en_travaux")
    _create_enum("locataire_statut_enum", "actif", "sorti")
    _create_enum("type_caution_enum", "cash", "compte_bloque", "organisme")
    _create_enum("type_contrat_enum", "cdi", "cdd", "independant", "retraite", "autre")
    _create_enum("document_althy_type_enum",
        "bail", "edl_entree", "edl_sortie", "quittance",
        "attestation_assurance", "contrat_travail", "fiche_salaire",
        "extrait_poursuites", "attestation_caution", "autre")
    _create_enum("paiement_statut_enum", "recu", "en_attente", "retard")
    _create_enum("intervention_categorie_enum",
        "plomberie", "electricite", "menuiserie", "peinture",
        "serrurerie", "chauffage", "autre")
    _create_enum("intervention_urgence_enum",
        "faible", "moderee", "urgente", "tres_urgente")
    _create_enum("intervention_statut_enum",
        "nouveau", "en_cours", "planifie", "resolu")
    _create_enum("devis_statut_enum", "en_attente", "accepte", "refuse")
    _create_enum("mission_ouvreur_type_enum",
        "visite", "edl_entree", "edl_sortie", "remise_cles", "expertise")
    _create_enum("mission_ouvreur_statut_enum",
        "proposee", "acceptee", "effectuee", "annulee")

    # ── 3. Tables (IF NOT EXISTS) ──────────────────────────────────────────────

    # biens
    op.execute("""
        CREATE TABLE IF NOT EXISTS biens (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            owner_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
            adresse VARCHAR(300) NOT NULL,
            ville VARCHAR(100) NOT NULL,
            cp VARCHAR(10) NOT NULL,
            type bien_type_enum NOT NULL DEFAULT 'appartement',
            surface FLOAT,
            etage INTEGER,
            loyer NUMERIC(10,2),
            charges NUMERIC(10,2),
            statut bien_statut_enum NOT NULL DEFAULT 'vacant',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_biens_owner_id ON biens(owner_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_biens_statut ON biens(statut)")

    # locataires
    op.execute("""
        CREATE TABLE IF NOT EXISTS locataires (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            bien_id UUID NOT NULL REFERENCES biens(id) ON DELETE RESTRICT,
            user_id UUID REFERENCES users(id) ON DELETE SET NULL,
            date_entree DATE,
            date_sortie DATE,
            loyer NUMERIC(10,2),
            charges NUMERIC(10,2),
            depot_garantie NUMERIC(10,2),
            type_caution type_caution_enum,
            banque_caution VARCHAR(200),
            iban_caution VARCHAR(34),
            statut locataire_statut_enum NOT NULL DEFAULT 'actif',
            motif_depart VARCHAR(300),
            note_interne TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_locataires_bien_id ON locataires(bien_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_locataires_user_id ON locataires(user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_locataires_statut ON locataires(statut)")

    # dossiers_locataires
    op.execute("""
        CREATE TABLE IF NOT EXISTS dossiers_locataires (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            locataire_id UUID NOT NULL UNIQUE REFERENCES locataires(id) ON DELETE CASCADE,
            employeur VARCHAR(200),
            poste VARCHAR(200),
            type_contrat type_contrat_enum,
            salaire_net NUMERIC(10,2),
            anciennete INTEGER,
            assureur_rc VARCHAR(200),
            numero_police VARCHAR(100),
            validite_assurance DATE,
            resultat_poursuites VARCHAR(100),
            date_poursuites DATE,
            office_poursuites VARCHAR(200),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_dossiers_locataire_id ON dossiers_locataires(locataire_id)")

    # documents
    op.execute("""
        CREATE TABLE IF NOT EXISTS documents (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            bien_id UUID REFERENCES biens(id) ON DELETE CASCADE,
            locataire_id UUID REFERENCES locataires(id) ON DELETE SET NULL,
            type document_althy_type_enum NOT NULL,
            url_storage TEXT NOT NULL,
            date_document DATE,
            genere_par_ia BOOLEAN NOT NULL DEFAULT false,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_documents_bien_id ON documents(bien_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_documents_locataire_id ON documents(locataire_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_documents_type ON documents(type)")

    # paiements
    op.execute("""
        CREATE TABLE IF NOT EXISTS paiements (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            locataire_id UUID NOT NULL REFERENCES locataires(id) ON DELETE CASCADE,
            bien_id UUID NOT NULL REFERENCES biens(id) ON DELETE CASCADE,
            mois VARCHAR(7) NOT NULL,
            montant NUMERIC(10,2) NOT NULL,
            date_echeance DATE NOT NULL,
            date_paiement DATE,
            statut paiement_statut_enum NOT NULL DEFAULT 'en_attente',
            jours_retard INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_paiements_locataire_id ON paiements(locataire_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_paiements_bien_id ON paiements(bien_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_paiements_statut ON paiements(statut)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_paiements_mois ON paiements(mois)")

    # interventions
    op.execute("""
        CREATE TABLE IF NOT EXISTS interventions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            bien_id UUID NOT NULL REFERENCES biens(id) ON DELETE CASCADE,
            signale_par_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
            artisan_id UUID REFERENCES users(id) ON DELETE SET NULL,
            titre VARCHAR(300) NOT NULL,
            description TEXT,
            categorie intervention_categorie_enum NOT NULL DEFAULT 'autre',
            urgence intervention_urgence_enum NOT NULL DEFAULT 'moderee',
            statut intervention_statut_enum NOT NULL DEFAULT 'nouveau',
            avancement INTEGER NOT NULL DEFAULT 0,
            date_signalement DATE,
            date_intervention DATE,
            cout NUMERIC(10,2),
            photos TEXT[],
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_interventions_bien_id ON interventions(bien_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_interventions_statut ON interventions(statut)")

    # devis
    op.execute("""
        CREATE TABLE IF NOT EXISTS devis (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            intervention_id UUID NOT NULL REFERENCES interventions(id) ON DELETE CASCADE,
            artisan_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
            montant NUMERIC(10,2) NOT NULL,
            description TEXT,
            statut devis_statut_enum NOT NULL DEFAULT 'en_attente',
            date_envoi DATE,
            date_reponse DATE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_devis_intervention_id ON devis(intervention_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_devis_artisan_id ON devis(artisan_id)")

    # missions_ouvreurs
    op.execute("""
        CREATE TABLE IF NOT EXISTS missions_ouvreurs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            bien_id UUID NOT NULL REFERENCES biens(id) ON DELETE CASCADE,
            agence_id UUID REFERENCES users(id) ON DELETE SET NULL,
            ouvreur_id UUID REFERENCES users(id) ON DELETE SET NULL,
            type mission_ouvreur_type_enum NOT NULL,
            date_mission VARCHAR(20),
            creneau_debut TIME,
            creneau_fin TIME,
            nb_candidats INTEGER NOT NULL DEFAULT 0,
            instructions TEXT,
            remuneration NUMERIC(8,2),
            statut mission_ouvreur_statut_enum NOT NULL DEFAULT 'proposee',
            rayon_km INTEGER NOT NULL DEFAULT 20,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_missions_ouvreurs_bien_id ON missions_ouvreurs(bien_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_missions_ouvreurs_ouvreur_id ON missions_ouvreurs(ouvreur_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_missions_ouvreurs_statut ON missions_ouvreurs(statut)")

    # profiles_ouvreurs
    op.execute("""
        CREATE TABLE IF NOT EXISTS profiles_ouvreurs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
            rayon_km INTEGER NOT NULL DEFAULT 20,
            jours_dispo INTEGER[],
            heure_debut TIME,
            heure_fin TIME,
            types_missions TEXT[],
            note_moyenne FLOAT NOT NULL DEFAULT 0,
            nb_missions INTEGER NOT NULL DEFAULT 0,
            vehicule BOOLEAN NOT NULL DEFAULT false,
            lat FLOAT,
            lng FLOAT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_profiles_ouvreurs_user_id ON profiles_ouvreurs(user_id)")

    # profiles_artisans
    op.execute("""
        CREATE TABLE IF NOT EXISTS profiles_artisans (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
            raison_sociale VARCHAR(300),
            uid_ide VARCHAR(20),
            numero_tva VARCHAR(30),
            specialites TEXT[],
            rayon_km INTEGER NOT NULL DEFAULT 30,
            note_moyenne FLOAT NOT NULL DEFAULT 0,
            nb_chantiers INTEGER NOT NULL DEFAULT 0,
            assurance_rc BOOLEAN NOT NULL DEFAULT false,
            lat FLOAT,
            lng FLOAT,
            iban VARCHAR(34),
            delai_paiement_jours INTEGER NOT NULL DEFAULT 30,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_profiles_artisans_user_id ON profiles_artisans(user_id)")

    # scoring_locataires
    op.execute("""
        CREATE TABLE IF NOT EXISTS scoring_locataires (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            locataire_id UUID NOT NULL UNIQUE REFERENCES locataires(id) ON DELETE CASCADE,
            ponctualite FLOAT NOT NULL DEFAULT 5,
            solvabilite FLOAT NOT NULL DEFAULT 5,
            communication FLOAT NOT NULL DEFAULT 5,
            etat_logement FLOAT NOT NULL DEFAULT 5,
            score_global FLOAT NOT NULL DEFAULT 5,
            nb_retards INTEGER NOT NULL DEFAULT 0,
            updated_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_scoring_locataires_locataire_id ON scoring_locataires(locataire_id)")

    # notifications
    op.execute("""
        CREATE TABLE IF NOT EXISTS notifications (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            type VARCHAR(100) NOT NULL,
            titre VARCHAR(300) NOT NULL,
            message TEXT NOT NULL,
            lu BOOLEAN NOT NULL DEFAULT false,
            lien VARCHAR(500),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_notifications_user_id ON notifications(user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_notifications_lu ON notifications(lu)")

    # ── Row Level Security ────────────────────────────────────────────────────
    for table in [
        "biens", "locataires", "dossiers_locataires", "documents",
        "paiements", "interventions", "devis", "missions_ouvreurs",
        "profiles_ouvreurs", "profiles_artisans", "scoring_locataires",
        "notifications",
    ]:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")


def downgrade() -> None:
    tables = [
        "notifications", "scoring_locataires", "profiles_artisans",
        "profiles_ouvreurs", "missions_ouvreurs", "devis", "interventions",
        "paiements", "documents", "dossiers_locataires", "locataires", "biens",
    ]
    for table in tables:
        op.execute(f"DROP TABLE IF EXISTS {table} CASCADE")

    op.execute("""
        DO $$ BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'users' AND column_name = 'adresse'
            ) THEN
                ALTER TABLE users DROP COLUMN adresse;
            END IF;
        END $$;
    """)

    for enum_name in [
        "bien_type_enum", "bien_statut_enum", "locataire_statut_enum",
        "type_caution_enum", "type_contrat_enum", "document_althy_type_enum",
        "paiement_statut_enum", "intervention_categorie_enum",
        "intervention_urgence_enum", "intervention_statut_enum",
        "devis_statut_enum", "mission_ouvreur_type_enum",
        "mission_ouvreur_statut_enum",
    ]:
        op.execute(f"DROP TYPE IF EXISTS {enum_name}")
