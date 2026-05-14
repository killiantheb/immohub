"""Sprint 10 Lot 5 — extension dossiers_locataires pour workflow approbation propriétaire.

Contexte (cf docs/2-ROADMAP.md §2.4.16 décision #3 — Interprétation A) :
  Le bailleur (proprio_solo) approuve un candidat locataire issu d'une
  invitation existante (magic_links type='invitation'). Magic link dédié
  type='approbation_dossier' pour bailleurs sans compte connecté.

  PAS de candidature spontanée marketplace (Phase 2). PAS de frais CHF 45.

Cette migration ajoute 6 colonnes à `dossiers_locataires` pour tracker le
cycle d'approbation propriétaire :
  - proprio_approbation_required (default True — workflow toujours actif Phase 1.0)
  - proprio_approbation_at (timestamp de l'approbation)
  - proprio_approbation_ip (preuve d'acceptation)
  - proprio_approbation_by_user_id (auteur — propriétaire ou super_admin)
  - proprio_refus_at, proprio_refus_reason (cas refus)

Magic link 'approbation_dossier' : la table magic_links existante a `type`
en String sans CHECK constraint — donc aucune migration sur magic_links
(le nouveau type est accepté de facto).

Doctrine §B.13 : Alembic Python, aucun .sql.

Revision ID: 0052
Revises: 0051
Create Date: 2026-05-14
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0052"
down_revision = "0051"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Extension dossiers_locataires — workflow approbation propriétaire ─────
    op.add_column(
        "dossiers_locataires",
        sa.Column(
            "proprio_approbation_required",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )
    op.add_column(
        "dossiers_locataires",
        sa.Column("proprio_approbation_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "dossiers_locataires",
        sa.Column("proprio_approbation_ip", sa.String(length=50), nullable=True),
    )
    op.add_column(
        "dossiers_locataires",
        sa.Column(
            "proprio_approbation_by_user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "dossiers_locataires",
        sa.Column("proprio_refus_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "dossiers_locataires",
        sa.Column("proprio_refus_reason", sa.Text(), nullable=True),
    )

    # Index pour requêtes "dossiers en attente d'approbation"
    op.execute(
        "CREATE INDEX idx_dossiers_locataires_approbation_pending "
        "ON dossiers_locataires(proprio_approbation_required) "
        "WHERE proprio_approbation_required = TRUE "
        "AND proprio_approbation_at IS NULL "
        "AND proprio_refus_at IS NULL;"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_dossiers_locataires_approbation_pending;")
    for col in (
        "proprio_refus_reason",
        "proprio_refus_at",
        "proprio_approbation_by_user_id",
        "proprio_approbation_ip",
        "proprio_approbation_at",
        "proprio_approbation_required",
    ):
        op.drop_column("dossiers_locataires", col)
