"""candidatures.message — colonne manquante (hotfix prod PR-A7).

Contexte : le modèle SQLAlchemy `Candidature` (backend/app/models/candidature.py
ligne 31) déclare le champ `message: Mapped[str | None] = mapped_column(Text)`,
mais la table `candidatures` créée par la migration 0026 ne contient pas
cette colonne. SQLAlchemy émet `SELECT *` sur la table → asyncpg lève
`UndefinedColumnError: column candidatures.message does not exist` →
500 sur tous les `GET /marketplace/candidatures`.

Bug latent depuis l'ajout du champ `message` au modèle. Révélé par PR-A6
qui a accru les appels via le banner contextuel et les CTAs vacants.

Scope hotfix : ajouter UNIQUEMENT `message`. D'autres colonnes peuvent
aussi manquer (owner_fee_*, frais_payes, stripe_pi_id, visite_proposee_at,
ouvreur_id, updated_at, score_details renommé depuis score_detail) — ces
colonnes sont à auditer dans une PR séparée pour limiter le risque de
régression de ce hotfix.

Revision ID: 0031
Revises: 0030
Create Date: 2026-04-29
"""

from __future__ import annotations

from alembic import op
from sqlalchemy import text


revision = "0031"
down_revision = "0030"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Ajoute la colonne `message` (TEXT NULL) à la table candidatures."""
    # IF NOT EXISTS pour rendre la migration idempotente : si la colonne a été
    # ajoutée manuellement en hotfix prod via SQL direct, la migration ne
    # plante pas.
    op.execute(
        text(
            "ALTER TABLE candidatures ADD COLUMN IF NOT EXISTS message TEXT"
        )
    )


def downgrade() -> None:
    """Retire la colonne `message` (rollback Phase 1 sécurisé)."""
    op.execute(
        text(
            "ALTER TABLE candidatures DROP COLUMN IF EXISTS message"
        )
    )
