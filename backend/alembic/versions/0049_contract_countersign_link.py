"""Contract countersign + Locataire ↔ Contract FK link.

Contexte (Sprint 8 Lot A — 2026-05-14) :
  Audit 4 (Workflow E2E) W6 Bail P0 BLOQUANT — Phase 1.0 doit pouvoir
  matérialiser une contre-signature locataire pour activer un bail (et
  basculer `status = active` + générer la 1re QR-facture loyer).

  Cette migration :
    1. Ajoute `contracts.tenant_signed_at` + `contracts.tenant_signed_ip`
       (preuve d'acceptation contractuelle horodatée — §B.10 honnête,
        pas une signature électronique qualifiée Skribble qui est
        Phase 1.1).
    2. Ajoute `locataires.current_contract_id` FK → `contracts.id`
       (ondelete SET NULL) pour lier de façon non destructive le bail
       actif au locataire (un locataire peut enchaîner plusieurs baux
       au fil du temps — on garde l'historique côté `contracts.tenant_id`).
    3. Crée un index sur la nouvelle FK.

  Pas de backfill nécessaire : tous les contrats existants ont
  `tenant_signed_at IS NULL` (statut natif) et tous les `locataires`
  conservent `current_contract_id NULL` jusqu'à la prochaine
  contre-signature.

Doctrine §B.13 : Python pur (aucun fichier `.sql` orphelin).
Doctrine §B.10 : champ « tenant_signed_at » et non « tenant_signed_es »
                 — on ne prétend pas faire de signature électronique
                 qualifiée en Phase 1.0.

Revision ID: 0049
Revises: 0048
Create Date: 2026-05-14
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0049"
down_revision = "0048"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Contracts : contre-signature locataire ──────────────────────────────
    op.add_column(
        "contracts",
        sa.Column("tenant_signed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "contracts",
        sa.Column("tenant_signed_ip", sa.String(length=45), nullable=True),
    )

    # ── Locataires : FK vers Contract actif ──────────────────────────────────
    # SET NULL au DELETE pour ne pas casser le dossier locataire si le bail
    # est supprimé. L'historique reste accessible via Contract.tenant_id.
    op.add_column(
        "locataires",
        sa.Column(
            "current_contract_id",
            UUID(as_uuid=True),
            sa.ForeignKey("contracts.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_locataires_current_contract_id",
        "locataires",
        ["current_contract_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_locataires_current_contract_id", table_name="locataires")
    op.drop_column("locataires", "current_contract_id")
    op.drop_column("contracts", "tenant_signed_ip")
    op.drop_column("contracts", "tenant_signed_at")
