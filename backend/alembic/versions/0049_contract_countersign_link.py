"""Contract countersign + Locataire ↔ Contract FK link.

Contexte (Sprint 8 Lot A — 2026-05-14) :
  Audit 4 (Workflow E2E) W6 Bail P0 BLOQUANT — Phase 1.0 doit pouvoir
  matérialiser une contre-signature locataire pour activer un bail (et
  basculer `status = active` + générer la 1re QR-facture loyer).

  Cette migration :
    1. Ajoute `contracts.tenant_signed_at` + `contracts.tenant_signed_ip`
       (preuve d'acceptation contractuelle horodatée — §B.10 honnête,
        complète Sprint 10 Skribble SES, cf MAJ doctrinale ci-dessous).
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
                 — Phase 1.0 = acceptation horodatée renforcée, sémantique
                 conservée même après bascule Skribble Sprint 10.

MISE À JOUR DOCTRINALE 2026-05-14 (Sprint 10, cf docs/2-ROADMAP.md §2.4.16) :
  La bascule Skribble en Phase 1.0 (était Phase 1.1) n'invalide PAS cette
  migration. Les colonnes `signed_at` + `tenant_signed_at` + `signed_ip` +
  `tenant_signed_ip` continuent d'exister et servent désormais de
  **Plan B SES renforcée** (fallback admin si Skribble KYC traîne ou si
  Skribble est down). Plan A = Skribble SES via `contracts.skribble_*`
  ajoutés en migration 0051 Sprint 10. Le flag `settings.SKRIBBLE_ENABLED`
  bascule entre Plan A (`/send-to-skribble`) et Plan B (`/sign` + `/countersign`
  Sprint 8 — endpoints conservés intacts).

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
