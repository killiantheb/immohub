"""Perf indexes pass 2 — Sprint B quick-wins backend.

Contexte (2026-05-12) :
  Audit perf Sprint A a identifié 3 indexes manquants supplémentaires
  après le pass 1 (migration 0044) :

  1. ai_briefing_cache(user_id, expires_at DESC, generated_at DESC)
     → utilisé par /sphere/pending-count (1.5 s observé en HAR pour
     24 bytes — seq scan + tri en mémoire évident).

  2. documents_dossier(uploaded_by_user_id)
     → FK non indexée. Hot path pour les requêtes de validation côté
     bailleur (« qui a uploadé ce doc ? ») et pour les futures stats
     audit Sprint 2 IA.

  3. biens(statut)
     → filtre `statut='loue'` côté dashboard proprio_solo + filtres
     d'estimation marché.

Tous CREATE INDEX IF NOT EXISTS pour rester idempotents (sécurité
en cas de pose manuelle via Supabase Studio).

Pas de CONCURRENTLY (Alembic ne supporte pas natif, tables Phase 1.0
< 100 rows — lock < 100 ms acceptable).

Doctrine §B.13 : Python only.

Revision ID: 0045
Revises: 0044
Create Date: 2026-05-12
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "0045"
down_revision = "0044"
branch_labels = None
depends_on = None


def _exec(sql: str) -> None:
    op.execute(sa.text(sql.strip()))


def upgrade() -> None:
    # 1. /sphere/pending-count hot path — composite avec tri DESC sur les
    #    2 colonnes du ORDER BY (cf sphere_agent.py:828-852).
    _exec(
        "CREATE INDEX IF NOT EXISTS ix_ai_briefing_cache_user_expires "
        "ON ai_briefing_cache(user_id, expires_at DESC, generated_at DESC)"
    )

    # 2. FK documents_dossier.uploaded_by_user_id — non indexée jusqu'ici.
    _exec(
        "CREATE INDEX IF NOT EXISTS ix_documents_dossier_uploaded_by "
        "ON documents_dossier(uploaded_by_user_id)"
    )

    # 3. biens.statut — filtre hot path dashboard.
    _exec("CREATE INDEX IF NOT EXISTS ix_biens_statut ON biens(statut)")


def downgrade() -> None:
    _exec("DROP INDEX IF EXISTS ix_biens_statut")
    _exec("DROP INDEX IF EXISTS ix_documents_dossier_uploaded_by")
    _exec("DROP INDEX IF EXISTS ix_ai_briefing_cache_user_expires")
