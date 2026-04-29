"""Aligne la table `candidatures` sur le modèle SQLAlchemy (hotfix prod PR-A8).

Contexte : la table `candidatures` créée par la migration 0026 ne contient pas
toutes les colonnes que le modèle SQLAlchemy `Candidature` (et son parent
`BaseModel`) déclarent. Le SELECT * implicite émis par SQLAlchemy plante sur
la première colonne manquante.

PR-A7 a corrigé `message`. Ce hotfix complète l'alignement pour clore les
bugs latents :

  Catégorie 1 — colonnes ABSENTES en DB :
    - owner_fee_amount        Numeric(10,2) NOT NULL DEFAULT 45.00
    - owner_fee_paid_at       TIMESTAMPTZ NULL
    - owner_fee_stripe_intent_id  TEXT NULL
    - owner_fee_failed_at     TIMESTAMPTZ NULL
    - owner_fee_failure_reason TEXT NULL
    - frais_payes             BOOLEAN NOT NULL DEFAULT false
    - stripe_pi_id            TEXT NULL
    - visite_proposee_at      TIMESTAMPTZ NULL
    - ouvreur_id              UUID NULL → FK users(id) ON DELETE SET NULL
    - updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()  (BaseModel)
    - is_active               BOOLEAN NOT NULL DEFAULT true       (BaseModel)

  Catégorie 2 — colonne MAL NOMMÉE :
    - DB `score_detail` → modèle `score_details`
    Décision : RENAME en DB (Option A) car frontend + backend service
    utilisent `score_details` (cf candidatures/page.tsx et
    marketplace_service.py:164).

  Catégorie 3 — colonnes en DB absentes du modèle (non bloquantes) :
    - interest_id (legacy 0026, pas dans le modèle) : conservée — un
      SELECT explicite ne la touche pas.
    - frais_dossier_stripe_id (legacy 0026) : conservée idem. Sémantique
      remplacée par `stripe_pi_id` (legacy locataire) + le pivot
      `owner_fee_*`.

IDEMPOTENCE : toutes les opérations utilisent `IF NOT EXISTS` ou un check
`information_schema` préalable, pour permettre un re-run sans erreur si
une colonne a déjà été ajoutée manuellement en hotfix SQL direct.

Revision ID: 0032
Revises: 0031
Create Date: 2026-04-29
"""

from __future__ import annotations

from alembic import op
from sqlalchemy import text


revision = "0032"
down_revision = "0031"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Alignement complet — idempotent."""
    conn = op.get_bind()

    # ── 1. RENAME score_detail → score_details (si nécessaire) ───────────────
    # Postgres ne supporte pas `RENAME COLUMN IF EXISTS`. On vérifie via
    # information_schema avant. Cas couverts :
    #   - Colonne `score_detail` existe seule  → rename
    #   - Colonne `score_details` existe déjà  → no-op
    #   - Les DEUX existent (improbable)       → on supprime score_detail
    has_old = conn.execute(
        text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name = 'candidatures' AND column_name = 'score_detail'"
        )
    ).fetchone()
    has_new = conn.execute(
        text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name = 'candidatures' AND column_name = 'score_details'"
        )
    ).fetchone()

    if has_old and not has_new:
        op.execute(
            text("ALTER TABLE candidatures RENAME COLUMN score_detail TO score_details")
        )
    elif has_old and has_new:
        # Sécurité : si quelqu'un a déjà ajouté `score_details` à la main et
        # laissé `score_detail` orpheline. On supprime la legacy.
        op.execute(text("ALTER TABLE candidatures DROP COLUMN score_detail"))

    # ── 2. ADD COLUMN — toutes les colonnes manquantes (idempotent) ──────────
    # Owner fee — pivot 2026-04-20 (CHF 45 payés par le PROPRIO à l'acceptation).
    op.execute(
        text(
            "ALTER TABLE candidatures "
            "ADD COLUMN IF NOT EXISTS owner_fee_amount NUMERIC(10,2) "
            "NOT NULL DEFAULT 45.00"
        )
    )
    op.execute(
        text(
            "ALTER TABLE candidatures "
            "ADD COLUMN IF NOT EXISTS owner_fee_paid_at TIMESTAMPTZ"
        )
    )
    op.execute(
        text(
            "ALTER TABLE candidatures "
            "ADD COLUMN IF NOT EXISTS owner_fee_stripe_intent_id TEXT"
        )
    )
    op.execute(
        text(
            "ALTER TABLE candidatures "
            "ADD COLUMN IF NOT EXISTS owner_fee_failed_at TIMESTAMPTZ"
        )
    )
    op.execute(
        text(
            "ALTER TABLE candidatures "
            "ADD COLUMN IF NOT EXISTS owner_fee_failure_reason TEXT"
        )
    )

    # Legacy locataire (CHF 90) — conservées pour audit, plus jamais écrites
    # depuis le pivot 2026-04-20.
    op.execute(
        text(
            "ALTER TABLE candidatures "
            "ADD COLUMN IF NOT EXISTS frais_payes BOOLEAN "
            "NOT NULL DEFAULT FALSE"
        )
    )
    op.execute(
        text(
            "ALTER TABLE candidatures "
            "ADD COLUMN IF NOT EXISTS stripe_pi_id TEXT"
        )
    )

    # Visite proposée via ouvreur.
    op.execute(
        text(
            "ALTER TABLE candidatures "
            "ADD COLUMN IF NOT EXISTS visite_proposee_at TIMESTAMPTZ"
        )
    )
    op.execute(
        text(
            "ALTER TABLE candidatures "
            "ADD COLUMN IF NOT EXISTS ouvreur_id UUID "
            "REFERENCES users(id) ON DELETE SET NULL"
        )
    )

    # ── 3. BaseModel — colonnes héritées par tous les modèles ────────────────
    op.execute(
        text(
            "ALTER TABLE candidatures "
            "ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ "
            "NOT NULL DEFAULT NOW()"
        )
    )
    op.execute(
        text(
            "ALTER TABLE candidatures "
            "ADD COLUMN IF NOT EXISTS is_active BOOLEAN "
            "NOT NULL DEFAULT TRUE"
        )
    )


def downgrade() -> None:
    """Rollback safe (Phase 1)."""
    # BaseModel cols
    op.execute(text("ALTER TABLE candidatures DROP COLUMN IF EXISTS is_active"))
    op.execute(text("ALTER TABLE candidatures DROP COLUMN IF EXISTS updated_at"))

    # Visite ouvreur
    op.execute(text("ALTER TABLE candidatures DROP COLUMN IF EXISTS ouvreur_id"))
    op.execute(text("ALTER TABLE candidatures DROP COLUMN IF EXISTS visite_proposee_at"))

    # Legacy locataire
    op.execute(text("ALTER TABLE candidatures DROP COLUMN IF EXISTS stripe_pi_id"))
    op.execute(text("ALTER TABLE candidatures DROP COLUMN IF EXISTS frais_payes"))

    # Owner fee
    op.execute(text("ALTER TABLE candidatures DROP COLUMN IF EXISTS owner_fee_failure_reason"))
    op.execute(text("ALTER TABLE candidatures DROP COLUMN IF EXISTS owner_fee_failed_at"))
    op.execute(text("ALTER TABLE candidatures DROP COLUMN IF EXISTS owner_fee_stripe_intent_id"))
    op.execute(text("ALTER TABLE candidatures DROP COLUMN IF EXISTS owner_fee_paid_at"))
    op.execute(text("ALTER TABLE candidatures DROP COLUMN IF EXISTS owner_fee_amount"))

    # Rename inverse
    conn = op.get_bind()
    has_new = conn.execute(
        text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name = 'candidatures' AND column_name = 'score_details'"
        )
    ).fetchone()
    has_old = conn.execute(
        text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name = 'candidatures' AND column_name = 'score_detail'"
        )
    ).fetchone()
    if has_new and not has_old:
        op.execute(
            text("ALTER TABLE candidatures RENAME COLUMN score_details TO score_detail")
        )
