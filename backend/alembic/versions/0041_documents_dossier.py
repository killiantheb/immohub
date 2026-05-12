"""documents_dossier table + extension dossiers_locataires (Module Dossier Locataire Phase 1.0).

Contexte (2026-05-13) :
  Sprint Module Dossier Locataire PR-1 backend. Spec docs/4-PRODUIT.md §4.7
  (espace locataire — section « Mes documents »).

  Le locataire upload 8 types de documents (piece_identite, permis_sejour,
  contrat_travail, fiches_salaire, assurance_rc, caution, extrait_poursuites,
  bail_signe). Le bailleur valide ou rejette manuellement (Sprint 1). Sprint 2
  ajoutera le scoring IA Claude (slots `ai_*` pré-créés ici).

  La table `dossiers_locataires` existante stocke les métadonnées textuelles
  du dossier (employeur, salaire, etc.). On y ajoute 2 booléens d'étape :
    - `renseignements_complets` : étape 1 (formulaire saisi par le locataire) = 15%
    - `loyer_caution_verses`    : étape 10 (bailleur confirme versement)      = 5%

Doctrine appliquée :
  - §B.13 : migration Alembic Python only. RLS via `op.execute()`.
  - §B.10 : check constraints (statut/type/mime/size) — la DB refuse les
    insertions invalides. Aucune ouverture sur des statuts ambigus.
  - §B.15 : aucune dépendance candidatures (Phase 2 dormant). Table dédiée.

Revision ID: 0041
Revises: 0040
Create Date: 2026-05-13
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision = "0041"
down_revision = "0040"
branch_labels = None
depends_on = None


def _exec(sql: str) -> None:
    """Execute a single SQL statement — asyncpg forbids multi-statement strings."""
    op.execute(sa.text(sql.strip()))


# ── Constantes (doivent matcher models/document_dossier.py) ──────────────────

_TYPE_DOCUMENT_VALUES = (
    "piece_identite",
    "permis_sejour",
    "contrat_travail",
    "fiches_salaire",
    "assurance_rc",
    "caution",
    "extrait_poursuites",
    "bail_signe",
)
_STATUT_VALUES = ("uploaded", "valide", "rejete")
_MIME_VALUES = ("application/pdf", "image/jpeg", "image/png")
_MAX_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB


def upgrade() -> None:
    # ── 1. Extension dossiers_locataires (2 étapes booléennes) ───────────────
    op.add_column(
        "dossiers_locataires",
        sa.Column(
            "renseignements_complets",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        "dossiers_locataires",
        sa.Column("renseignements_completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "dossiers_locataires",
        sa.Column(
            "loyer_caution_verses",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        "dossiers_locataires",
        sa.Column("loyer_caution_verses_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "dossiers_locataires",
        sa.Column(
            "loyer_caution_verses_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )

    # ── 2. Nouvelle table documents_dossier ──────────────────────────────────
    op.create_table(
        "documents_dossier",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "locataire_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("locataires.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("type_document", sa.String(length=50), nullable=False),
        sa.Column("storage_key", sa.Text(), nullable=False),
        sa.Column("filename_original", sa.String(length=300), nullable=False),
        sa.Column("mime_type", sa.String(length=100), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column(
            "statut",
            sa.String(length=20),
            nullable=False,
            server_default=sa.text("'uploaded'"),
        ),
        sa.Column("poids_progression", sa.Integer(), nullable=False),
        sa.Column(
            "est_equivalent",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column("equivalent_libelle", sa.String(length=200), nullable=True),
        sa.Column("commentaire_rejet", sa.Text(), nullable=True),
        sa.Column(
            "uploaded_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "valide_par_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("valide_at", sa.DateTime(timezone=True), nullable=True),
        # Slots Sprint 2 IA — pré-créés, NULL Sprint 1
        sa.Column("ai_score_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ai_recommendation", sa.String(length=20), nullable=True),
        sa.Column("ai_details", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        # Check constraints (§B.10 — la DB refuse l'invalide, pas de faux statut)
        sa.CheckConstraint(
            "type_document IN ("
            + ", ".join(f"'{v}'" for v in _TYPE_DOCUMENT_VALUES)
            + ")",
            name="ck_documents_dossier_type_document",
        ),
        sa.CheckConstraint(
            "statut IN (" + ", ".join(f"'{v}'" for v in _STATUT_VALUES) + ")",
            name="ck_documents_dossier_statut",
        ),
        sa.CheckConstraint(
            "mime_type IN (" + ", ".join(f"'{v}'" for v in _MIME_VALUES) + ")",
            name="ck_documents_dossier_mime_type",
        ),
        sa.CheckConstraint(
            f"size_bytes > 0 AND size_bytes <= {_MAX_SIZE_BYTES}",
            name="ck_documents_dossier_size_bytes",
        ),
        sa.CheckConstraint(
            "(statut <> 'rejete') OR (commentaire_rejet IS NOT NULL "
            "AND length(trim(commentaire_rejet)) >= 5)",
            name="ck_documents_dossier_rejet_requires_commentaire",
        ),
    )

    # ── 3. Indexes ───────────────────────────────────────────────────────────
    # Listing par locataire ordre chronologique inverse (UI : plus récent en haut).
    op.create_index(
        "ix_documents_dossier_locataire_created",
        "documents_dossier",
        ["locataire_id", sa.text("created_at DESC")],
    )
    # Partial index : tous les docs en attente de validation bailleur.
    # Phase 1.0 = validation manuelle, donc hot path bailleur "tous mes docs à valider".
    op.create_index(
        "ix_documents_dossier_uploaded_only",
        "documents_dossier",
        ["locataire_id"],
        postgresql_where=sa.text("statut = 'uploaded'"),
    )

    # ── 4. RLS policies (helpers althy_current_user_id/role créés en 0019) ──
    _exec("ALTER TABLE documents_dossier ENABLE ROW LEVEL SECURITY")

    # SELECT — locataire voit SES documents
    _exec("DROP POLICY IF EXISTS select_own_dossier_locataire ON documents_dossier")
    _exec(
        """
        CREATE POLICY select_own_dossier_locataire ON documents_dossier
        FOR SELECT TO authenticated
        USING (
            locataire_id IN (
                SELECT id FROM locataires WHERE user_id = althy_current_user_id()
            )
        )
        """
    )

    # SELECT — bailleur voit les documents des locataires de SES biens
    _exec("DROP POLICY IF EXISTS select_own_dossier_bailleur ON documents_dossier")
    _exec(
        """
        CREATE POLICY select_own_dossier_bailleur ON documents_dossier
        FOR SELECT TO authenticated
        USING (
            locataire_id IN (
                SELECT l.id FROM locataires l
                JOIN biens b ON b.id = l.bien_id
                WHERE b.owner_id = althy_current_user_id()
            )
        )
        """
    )

    # INSERT — uploader doit être l'auteur (locataire OU bailleur pour bail_signe)
    _exec("DROP POLICY IF EXISTS insert_own_dossier ON documents_dossier")
    _exec(
        """
        CREATE POLICY insert_own_dossier ON documents_dossier
        FOR INSERT TO authenticated
        WITH CHECK (uploaded_by_user_id = althy_current_user_id())
        """
    )

    # UPDATE — seul le bailleur du bien correspondant peut valider/rejeter
    _exec("DROP POLICY IF EXISTS update_validate_bailleur ON documents_dossier")
    _exec(
        """
        CREATE POLICY update_validate_bailleur ON documents_dossier
        FOR UPDATE TO authenticated
        USING (
            locataire_id IN (
                SELECT l.id FROM locataires l
                JOIN biens b ON b.id = l.bien_id
                WHERE b.owner_id = althy_current_user_id()
            )
        )
        WITH CHECK (
            locataire_id IN (
                SELECT l.id FROM locataires l
                JOIN biens b ON b.id = l.bien_id
                WHERE b.owner_id = althy_current_user_id()
            )
        )
        """
    )

    # DELETE — locataire peut retirer son doc tant que statut = 'uploaded'
    _exec("DROP POLICY IF EXISTS delete_own_uploaded ON documents_dossier")
    _exec(
        """
        CREATE POLICY delete_own_uploaded ON documents_dossier
        FOR DELETE TO authenticated
        USING (
            statut = 'uploaded'
            AND locataire_id IN (
                SELECT id FROM locataires WHERE user_id = althy_current_user_id()
            )
        )
        """
    )

    # ALL — super_admin bypass complet
    _exec("DROP POLICY IF EXISTS admin_all_dossier ON documents_dossier")
    _exec(
        """
        CREATE POLICY admin_all_dossier ON documents_dossier
        FOR ALL TO authenticated
        USING (althy_current_role() IN ('admin', 'super_admin'))
        WITH CHECK (althy_current_role() IN ('admin', 'super_admin'))
        """
    )


def downgrade() -> None:
    # ── Drop policies ────────────────────────────────────────────────────────
    _exec("DROP POLICY IF EXISTS admin_all_dossier ON documents_dossier")
    _exec("DROP POLICY IF EXISTS delete_own_uploaded ON documents_dossier")
    _exec("DROP POLICY IF EXISTS update_validate_bailleur ON documents_dossier")
    _exec("DROP POLICY IF EXISTS insert_own_dossier ON documents_dossier")
    _exec("DROP POLICY IF EXISTS select_own_dossier_bailleur ON documents_dossier")
    _exec("DROP POLICY IF EXISTS select_own_dossier_locataire ON documents_dossier")

    # ── Drop indexes ─────────────────────────────────────────────────────────
    op.drop_index("ix_documents_dossier_uploaded_only", table_name="documents_dossier")
    op.drop_index("ix_documents_dossier_locataire_created", table_name="documents_dossier")

    # ── Drop table ───────────────────────────────────────────────────────────
    op.drop_table("documents_dossier")

    # ── Revert dossiers_locataires extensions ────────────────────────────────
    op.drop_column("dossiers_locataires", "loyer_caution_verses_by")
    op.drop_column("dossiers_locataires", "loyer_caution_verses_at")
    op.drop_column("dossiers_locataires", "loyer_caution_verses")
    op.drop_column("dossiers_locataires", "renseignements_completed_at")
    op.drop_column("dossiers_locataires", "renseignements_complets")
