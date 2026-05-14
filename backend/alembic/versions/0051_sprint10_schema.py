"""Sprint 10 schema — contracts USPI + mandats + avenants + résiliations + Skribble + convention sortie.

Contexte (Sprint 10 — 2026-05-14, cf docs/2-ROADMAP.md §2.4.16 décisions
doctrinales Killian) :

  Migration DDL préparant le Sprint 10 (signature électronique Skribble SES
  bascule Phase 1.0, bail USPI/Sunimmo 6 pages, avenant, résiliation, mandat
  de gestion agence ↔ propriétaire, EDL entrée/sortie + convention de sortie).

  **Architecture : extension par-table** (vs polymorphic SignableDocument),
  décidée par AUDIT_SPRINT10.md §3.5 pour ne pas refactor le flow Sprint 8
  (Plan B SES renforcée) à J-17 de la gate Sunimmo 01/06/2026.

  Sections :
    A. Extension `contracts` — 17 colonnes (12 USPI/Sunimmo + 5 Skribble).
    B. Fix typage `contracts.notice_deadline_date` String → TIMESTAMPTZ
       (incohérence migration 0005 vs modèle Python, détectée par audit §1.3).
    C. Conversion `contracts.deposit_type` (String libre) → CHECK constraint
       stricte ('gocaution', 'caution_bancaire', 'compte_epargne', 'especes').
    D. Nouvelle table `mandats_gestion` (mandat agence ↔ propriétaire).
    E. Nouvelle table `avenants` (modification post-signature du bail).
    F. Nouvelle table `resiliations` (cycle de résiliation typé CO 266l).
    G. Extension `changements_locataire` — ajout `convention_sortie` JSONB.

  Doctrine §B.13 : Alembic Python uniquement, aucun .sql.
  Doctrine §B.10 : CHECK constraints stricts pour les enums (la DB refuse
                   l'invalide en amont de Pydantic).
  Doctrine §B.15 + §2.4.16 (cf docs/2-ROADMAP.md) : `mandats_gestion`
                   stocke `commission_pct_*` comme **donnée contractuelle pure**
                   (apparaît dans le PDF du mandat). AUCUN tracking
                   transactionnel Althy — pas de Stripe Connect, pas de
                   prélèvement, pas de webhook commission. Sunimmo facture
                   le propriétaire en direct sur sa compta interne.

  Pré-requis : migration 0030 a créé la fonction trigger `_set_updated_at()`
  réutilisée ici pour les 3 nouvelles tables (CREATE OR REPLACE → idempotent).

Revision ID: 0051
Revises: 0050
Create Date: 2026-05-14
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "0051"
down_revision = "0050"
branch_labels = None
depends_on = None


# ── Constantes (doivent matcher models/contract.py + models/avenant.py + ──────
#                models/resiliation.py + models/mandat_gestion.py — Lot 2)

_LOCATAIRE_ETAT_CIVIL = (
    "celibataire",
    "marie",
    "partenariat",
    "divorce",
    "veuf",
)

_TEMPLATE_TYPE = (
    "sunimmo_annee",
    "sunimmo_saison",
    "sunimmo_nuitees",
    "sunimmo_commercial",
    "sunimmo_parc",
    "sunimmo_vaud",
)

_DEPOSIT_TYPE = (
    "gocaution",
    "caution_bancaire",
    "compte_epargne",
    "especes",
)

_MANDAT_STATUS = (
    "draft",
    "pending_signatures",
    "active",
    "terminated",
    "expired",
)

_AVENANT_TYPE = (
    "animaux",
    "modification_loyer",
    "modification_date",
    "prolongation",
    "resiliation_anticipee",
    "changement_proprietaire",
    "changement_locataire",
    "charge_electrique",
    "accord_specifique",
)

_AVENANT_STATUS = (
    "draft",
    "pending_signatures",
    "signed",
    "terminated",
)

_RESILIATION_INITIATEUR = (
    "locataire",
    "bailleur",
    "agence_mandataire",
)

_RESILIATION_STATUS = (
    "draft",
    "pending_signatures",
    "signed",
    "envoyee",
    "appliquee",
    "annulee",
)


def _quoted(values: tuple[str, ...]) -> str:
    """Helper SQL — entoure chaque valeur de quotes pour CHECK IN (...)."""
    return ", ".join(f"'{v}'" for v in values)


# ─────────────────────────────────────────────────────────────────────────────
#  upgrade()
# ─────────────────────────────────────────────────────────────────────────────


def upgrade() -> None:
    # ╔═══════════════════════════════════════════════════════════════════════╗
    # ║ A. Extension `contracts` — 12 colonnes USPI/Sunimmo + 5 Skribble       ║
    # ╚═══════════════════════════════════════════════════════════════════════╝

    # A.1 USPI/Sunimmo (12 colonnes)
    op.add_column("contracts", sa.Column("renouvellement_mois", sa.Integer(), nullable=True, server_default="12"))
    op.add_column("contracts", sa.Column("reserve_hausse_motif", sa.Text(), nullable=True))
    op.add_column("contracts", sa.Column("reserve_hausse_montant", sa.Numeric(12, 2), nullable=True))
    op.add_column("contracts", sa.Column("deposit_iban", sa.String(length=34), nullable=True))
    op.add_column("contracts", sa.Column("deposit_bank_name", sa.String(length=100), nullable=True))
    op.add_column("contracts", sa.Column("conditions_particulieres", sa.Text(), nullable=True))
    op.add_column("contracts", sa.Column("locataire_etat_civil", sa.String(length=20), nullable=True))
    op.add_column(
        "contracts",
        sa.Column(
            "logement_familial_principal",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column("contracts", sa.Column("ancien_locataire", sa.String(length=200), nullable=True))
    op.add_column("contracts", sa.Column("cgul_signed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("contracts", sa.Column("template_type", sa.String(length=40), nullable=True))
    op.add_column("contracts", sa.Column("cgul_version", sa.String(length=20), nullable=True))

    # A.2 Skribble (5 colonnes — extension par-table, pas refacto Sprint 8)
    op.add_column("contracts", sa.Column("skribble_session_id", sa.String(length=100), nullable=True))
    op.add_column("contracts", sa.Column("skribble_status", sa.String(length=50), nullable=True))
    op.add_column("contracts", sa.Column("skribble_signed_pdf_url", sa.Text(), nullable=True))
    op.add_column("contracts", sa.Column("skribble_signer_role_required", JSONB(), nullable=True))
    op.add_column("contracts", sa.Column("cgul_signed_at_locataire", sa.DateTime(timezone=True), nullable=True))

    # A.3 Index partiel sur skribble_session_id (sparse — beaucoup de NULL en Plan B)
    op.create_index(
        "ix_contracts_skribble_session_id",
        "contracts",
        ["skribble_session_id"],
        unique=False,
        postgresql_where=sa.text("skribble_session_id IS NOT NULL"),
    )

    # A.4 CHECK constraints (§B.10 — DB refuse les valeurs invalides)
    op.create_check_constraint(
        "ck_contracts_locataire_etat_civil",
        "contracts",
        f"locataire_etat_civil IS NULL OR locataire_etat_civil IN ({_quoted(_LOCATAIRE_ETAT_CIVIL)})",
    )
    op.create_check_constraint(
        "ck_contracts_template_type",
        "contracts",
        f"template_type IS NULL OR template_type IN ({_quoted(_TEMPLATE_TYPE)})",
    )

    # ╔═══════════════════════════════════════════════════════════════════════╗
    # ║ B. Fix typage notice_deadline_date String → TIMESTAMPTZ                ║
    # ║                                                                        ║
    # ║ Migration 0005 avait déclaré String(50) ; le modèle Python (`contract  ║
    # ║ .py:73`) attend DateTime. L'incohérence type est détectée et corrigée  ║
    # ║ ici de façon idempotente — si la colonne est déjà TIMESTAMPTZ          ║
    # ║ (migration partielle ou réenroulement), le bloc DO $$ ne fait rien.    ║
    # ╚═══════════════════════════════════════════════════════════════════════╝
    op.execute("""
        DO $$
        DECLARE
            current_type text;
        BEGIN
            SELECT data_type INTO current_type
            FROM information_schema.columns
            WHERE table_name = 'contracts' AND column_name = 'notice_deadline_date';

            IF current_type IN ('character varying', 'character', 'text') THEN
                -- Null out any non-ISO-date values that wouldn't cast cleanly
                UPDATE contracts
                SET notice_deadline_date = NULL
                WHERE notice_deadline_date IS NOT NULL
                  AND notice_deadline_date !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}';

                ALTER TABLE contracts
                ALTER COLUMN notice_deadline_date
                TYPE TIMESTAMPTZ
                USING notice_deadline_date::TIMESTAMPTZ;
            END IF;
        END $$;
    """)

    # ╔═══════════════════════════════════════════════════════════════════════╗
    # ║ C. Conversion deposit_type String libre → CHECK constraint stricte    ║
    # ║                                                                        ║
    # ║ Backfill : tout deposit_type non listé devient 'gocaution' (= défaut   ║
    # ║ migration 0005). Idempotent — UPDATE WHERE NOT IN clause safe.        ║
    # ╚═══════════════════════════════════════════════════════════════════════╝
    op.execute(
        f"UPDATE contracts SET deposit_type = 'gocaution' "
        f"WHERE deposit_type IS NOT NULL "
        f"AND deposit_type NOT IN ({_quoted(_DEPOSIT_TYPE)});"
    )
    op.create_check_constraint(
        "ck_contracts_deposit_type",
        "contracts",
        f"deposit_type IS NULL OR deposit_type IN ({_quoted(_DEPOSIT_TYPE)})",
    )

    # ╔═══════════════════════════════════════════════════════════════════════╗
    # ║ D. Table `mandats_gestion` — mandat agence ↔ propriétaire             ║
    # ║                                                                        ║
    # ║ §2.4.16 : commission_pct_* = donnée contractuelle pure (PDF mandat),   ║
    # ║ AUCUN tracking transactionnel Althy.                                   ║
    # ╚═══════════════════════════════════════════════════════════════════════╝
    op.execute("""
        CREATE TABLE IF NOT EXISTS mandats_gestion (
            id                        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
            mandant_id                UUID         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
            agence_id                 UUID         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
            bien_id                   UUID         REFERENCES biens(id) ON DELETE SET NULL,
            reference                 VARCHAR(50)  UNIQUE NOT NULL,
            status                    VARCHAR(30)  NOT NULL DEFAULT 'draft',

            signed_at_mandant         TIMESTAMPTZ,
            signed_ip_mandant         VARCHAR(50),
            signed_at_agence          TIMESTAMPTZ,
            signed_ip_agence          VARCHAR(50),

            skribble_session_id       VARCHAR(100),
            skribble_status           VARCHAR(50),
            skribble_signed_pdf_url   TEXT,

            commission_pct_annee      NUMERIC(5,2) NOT NULL DEFAULT 10.00,
            commission_pct_saison     NUMERIC(5,2) NOT NULL DEFAULT 15.00,
            commission_pct_semaine    NUMERIC(5,2) NOT NULL DEFAULT 20.00,

            notes                     TEXT,
            for_juridique             VARCHAR(100) NOT NULL DEFAULT 'Sierre',

            start_date                DATE         NOT NULL,
            end_date                  DATE,
            notice_period_months      INTEGER      NOT NULL DEFAULT 3,
            notice_deadline_month_day VARCHAR(10),

            is_active                 BOOLEAN      NOT NULL DEFAULT TRUE,
            created_at                TIMESTAMPTZ  NOT NULL DEFAULT now(),
            updated_at                TIMESTAMPTZ  NOT NULL DEFAULT now(),
            terminated_at             TIMESTAMPTZ
        );
    """)

    op.create_check_constraint(
        "ck_mandats_gestion_status",
        "mandats_gestion",
        f"status IN ({_quoted(_MANDAT_STATUS)})",
    )
    op.create_check_constraint(
        "ck_mandats_gestion_distinct_parties",
        "mandats_gestion",
        "mandant_id <> agence_id",
    )
    op.create_check_constraint(
        "ck_mandats_gestion_commission_pct_range",
        "mandats_gestion",
        "commission_pct_annee >= 0 AND commission_pct_annee <= 100 "
        "AND commission_pct_saison >= 0 AND commission_pct_saison <= 100 "
        "AND commission_pct_semaine >= 0 AND commission_pct_semaine <= 100",
    )
    op.create_check_constraint(
        "ck_mandats_gestion_end_after_start",
        "mandats_gestion",
        "end_date IS NULL OR end_date >= start_date",
    )

    op.execute("CREATE INDEX idx_mandats_gestion_mandant_id ON mandats_gestion(mandant_id);")
    op.execute("CREATE INDEX idx_mandats_gestion_agence_id ON mandats_gestion(agence_id);")
    op.execute(
        "CREATE INDEX idx_mandats_gestion_bien_id "
        "ON mandats_gestion(bien_id) WHERE bien_id IS NOT NULL;"
    )
    op.execute("CREATE INDEX idx_mandats_gestion_status ON mandats_gestion(status);")
    op.execute(
        "CREATE INDEX idx_mandats_gestion_skribble_session "
        "ON mandats_gestion(skribble_session_id) "
        "WHERE skribble_session_id IS NOT NULL;"
    )

    # Trigger updated_at — fonction _set_updated_at() créée en migration 0030.
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_trigger
                WHERE tgname = 'set_updated_at_mandats_gestion'
            ) THEN
                CREATE TRIGGER set_updated_at_mandats_gestion
                    BEFORE UPDATE ON mandats_gestion
                    FOR EACH ROW EXECUTE FUNCTION _set_updated_at();
            END IF;
        END $$;
    """)

    # ╔═══════════════════════════════════════════════════════════════════════╗
    # ║ E. Table `avenants` — modification post-signature du bail              ║
    # ╚═══════════════════════════════════════════════════════════════════════╝
    op.execute("""
        CREATE TABLE IF NOT EXISTS avenants (
            id                        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
            contract_id               UUID         NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
            agency_id                 UUID         REFERENCES users(id) ON DELETE SET NULL,
            reference                 VARCHAR(50)  UNIQUE NOT NULL,
            avenant_type              VARCHAR(40)  NOT NULL,
            objet                     TEXT         NOT NULL,
            body_text                 TEXT,
            effective_date            DATE,
            data                      JSONB        NOT NULL DEFAULT '{}'::jsonb,
            status                    VARCHAR(30)  NOT NULL DEFAULT 'draft',

            signed_at_locataire       TIMESTAMPTZ,
            signed_at_agence          TIMESTAMPTZ,

            skribble_session_id       VARCHAR(100),
            skribble_status           VARCHAR(50),
            skribble_signed_pdf_url   TEXT,
            draft_pdf_url             TEXT,

            is_active                 BOOLEAN      NOT NULL DEFAULT TRUE,
            created_at                TIMESTAMPTZ  NOT NULL DEFAULT now(),
            updated_at                TIMESTAMPTZ  NOT NULL DEFAULT now()
        );
    """)

    op.create_check_constraint(
        "ck_avenants_avenant_type",
        "avenants",
        f"avenant_type IN ({_quoted(_AVENANT_TYPE)})",
    )
    op.create_check_constraint(
        "ck_avenants_status",
        "avenants",
        f"status IN ({_quoted(_AVENANT_STATUS)})",
    )

    op.execute("CREATE INDEX idx_avenants_contract_id ON avenants(contract_id);")
    op.execute("CREATE INDEX idx_avenants_status ON avenants(status);")
    op.execute("CREATE INDEX idx_avenants_avenant_type ON avenants(avenant_type);")
    op.execute(
        "CREATE INDEX idx_avenants_skribble_session "
        "ON avenants(skribble_session_id) WHERE skribble_session_id IS NOT NULL;"
    )

    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_avenants'
            ) THEN
                CREATE TRIGGER set_updated_at_avenants
                    BEFORE UPDATE ON avenants
                    FOR EACH ROW EXECUTE FUNCTION _set_updated_at();
            END IF;
        END $$;
    """)

    # ╔═══════════════════════════════════════════════════════════════════════╗
    # ║ F. Table `resiliations` — cycle de résiliation typé CO 266l            ║
    # ║                                                                        ║
    # ║ ON DELETE RESTRICT sur contract_id : on n'efface jamais le contrat     ║
    # ║ d'une résiliation (conservation légale CO 962, 10 ans).               ║
    # ╚═══════════════════════════════════════════════════════════════════════╝
    op.execute("""
        CREATE TABLE IF NOT EXISTS resiliations (
            id                        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
            contract_id               UUID         NOT NULL REFERENCES contracts(id) ON DELETE RESTRICT,
            agency_id                 UUID         REFERENCES users(id) ON DELETE SET NULL,
            reference                 VARCHAR(50)  UNIQUE NOT NULL,
            initiateur                VARCHAR(30)  NOT NULL,
            motif                     VARCHAR(200),

            date_resiliation          DATE         NOT NULL,
            date_envoi                DATE         NOT NULL,
            respect_preavis           BOOLEAN      NOT NULL DEFAULT FALSE,
            preavis_months            INTEGER      NOT NULL DEFAULT 3,

            status                    VARCHAR(30)  NOT NULL DEFAULT 'draft',
            signed_at                 TIMESTAMPTZ,

            skribble_session_id       VARCHAR(100),
            skribble_status           VARCHAR(50),
            skribble_signed_pdf_url   TEXT,
            draft_pdf_url             TEXT,
            notification_envoyee_at   TIMESTAMPTZ,

            is_active                 BOOLEAN      NOT NULL DEFAULT TRUE,
            created_at                TIMESTAMPTZ  NOT NULL DEFAULT now(),
            updated_at                TIMESTAMPTZ  NOT NULL DEFAULT now()
        );
    """)

    op.create_check_constraint(
        "ck_resiliations_initiateur",
        "resiliations",
        f"initiateur IN ({_quoted(_RESILIATION_INITIATEUR)})",
    )
    op.create_check_constraint(
        "ck_resiliations_status",
        "resiliations",
        f"status IN ({_quoted(_RESILIATION_STATUS)})",
    )

    op.execute("CREATE INDEX idx_resiliations_contract_id ON resiliations(contract_id);")
    op.execute("CREATE INDEX idx_resiliations_status ON resiliations(status);")
    op.execute(
        "CREATE INDEX idx_resiliations_skribble_session "
        "ON resiliations(skribble_session_id) WHERE skribble_session_id IS NOT NULL;"
    )

    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_resiliations'
            ) THEN
                CREATE TRIGGER set_updated_at_resiliations
                    BEFORE UPDATE ON resiliations
                    FOR EACH ROW EXECUTE FUNCTION _set_updated_at();
            END IF;
        END $$;
    """)

    # ╔═══════════════════════════════════════════════════════════════════════╗
    # ║ G. Extension `changements_locataire` — convention_sortie JSONB         ║
    # ║                                                                        ║
    # ║ Structure attendue (Lot 3 PDF + Lot 6 UI) :                            ║
    # ║   { description_defauts: [{ description, estimation_chf }],            ║
    # ║     inventaire_cles: { type_cle: count },                              ║
    # ║     total_estimation_chf: number,                                      ║
    # ║     mode_indemnisation: 'forfait' | 'travaux' | 'autorisation_gerance',║
    # ║     signed_at_locataire, signed_at_agence,                             ║
    # ║     skribble_session_id, skribble_signed_pdf_url }                     ║
    # ╚═══════════════════════════════════════════════════════════════════════╝
    op.add_column(
        "changements_locataire",
        sa.Column("convention_sortie", JSONB(), nullable=True),
    )


# ─────────────────────────────────────────────────────────────────────────────
#  downgrade()
# ─────────────────────────────────────────────────────────────────────────────


def downgrade() -> None:
    """Inverse strict de upgrade(), dans l'ordre inverse des sections.

    Notes :
      - La conversion notice_deadline_date String → TIMESTAMPTZ (section B)
        n'est PAS reversible (information de format String perdue). Un re-upgrade
        sera idempotent puisque le DO $$ ne re-convertit que si type String.
      - Le backfill UPDATE deposit_type (section C) n'est pas reversible (on
        ne sait pas quelles valeurs étaient là avant le reset à 'gocaution').
    """
    # G — convention_sortie
    op.drop_column("changements_locataire", "convention_sortie")

    # F — resiliations
    op.execute("DROP TRIGGER IF EXISTS set_updated_at_resiliations ON resiliations;")
    op.execute("DROP TABLE IF EXISTS resiliations CASCADE;")

    # E — avenants
    op.execute("DROP TRIGGER IF EXISTS set_updated_at_avenants ON avenants;")
    op.execute("DROP TABLE IF EXISTS avenants CASCADE;")

    # D — mandats_gestion
    op.execute("DROP TRIGGER IF EXISTS set_updated_at_mandats_gestion ON mandats_gestion;")
    op.execute("DROP TABLE IF EXISTS mandats_gestion CASCADE;")

    # C — deposit_type CHECK
    op.drop_constraint("ck_contracts_deposit_type", "contracts", type_="check")

    # B — notice_deadline_date : on ne re-cast PAS en String (info perdue).

    # A — drop colonnes contracts (ordre inverse de l'ajout)
    op.drop_constraint("ck_contracts_template_type", "contracts", type_="check")
    op.drop_constraint("ck_contracts_locataire_etat_civil", "contracts", type_="check")

    op.drop_index("ix_contracts_skribble_session_id", table_name="contracts")

    for col in (
        "cgul_signed_at_locataire",
        "skribble_signer_role_required",
        "skribble_signed_pdf_url",
        "skribble_status",
        "skribble_session_id",
        "cgul_version",
        "template_type",
        "cgul_signed_at",
        "ancien_locataire",
        "logement_familial_principal",
        "locataire_etat_civil",
        "conditions_particulieres",
        "deposit_bank_name",
        "deposit_iban",
        "reserve_hausse_montant",
        "reserve_hausse_motif",
        "renouvellement_mois",
    ):
        op.drop_column("contracts", col)
