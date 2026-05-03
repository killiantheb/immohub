"""Compléments interventions pour PR-A11.A.5 (modale interventions fiche bien).

Ajoute :
  - Colonnes `interventions.note_cloture` (TEXT NULL) — note libre saisie
    à la clôture d'une intervention.
  - Colonnes `interventions.closed_at` (TIMESTAMPTZ NULL) — horodatage
    de transition vers le statut `resolu`. Renseigné côté service quand
    l'utilisateur passe le statut à `resolu`.
  - Table `intervention_photos` (id UUID PK, intervention_id FK, url, order,
    timestamps, is_active) — photos jointes individuelles avec un ID
    stable pour suppression unitaire (l'ancienne colonne ARRAY `photos`
    sur `interventions` est conservée pour compat mais inutilisée par la
    nouvelle UI ; un sprint dédié pourra la nettoyer).

Le bucket Supabase Storage utilisé est `settings.SUPABASE_BUCKET_BIEN_IMAGES`
(default legacy `property-images`), chemin
`{bien_id}/interventions/{intervention_id}/{photo_id}{ext}`. Pas de bucket
dédié — décision Phase 1 pour réduire la surface ops.

Revision ID: 0034
Revises: 0033
Create Date: 2026-05-03
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision = "0034"
down_revision = "0033"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Champs de clôture sur `interventions`
    op.add_column(
        "interventions",
        sa.Column("note_cloture", sa.Text(), nullable=True),
    )
    op.add_column(
        "interventions",
        sa.Column(
            "closed_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    # 2. Table `intervention_photos`
    op.create_table(
        "intervention_photos",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            "intervention_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("interventions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column(
            "order",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "is_active",
            sa.Boolean(),
            server_default="true",
            nullable=False,
        ),
    )
    op.create_index(
        "ix_intervention_photos_intervention_id",
        "intervention_photos",
        ["intervention_id"],
    )
    op.create_index(
        "ix_intervention_photos_order",
        "intervention_photos",
        ["intervention_id", "order"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_intervention_photos_order", table_name="intervention_photos"
    )
    op.drop_index(
        "ix_intervention_photos_intervention_id",
        table_name="intervention_photos",
    )
    op.drop_table("intervention_photos")
    op.drop_column("interventions", "closed_at")
    op.drop_column("interventions", "note_cloture")
