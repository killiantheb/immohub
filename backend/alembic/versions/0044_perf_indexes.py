"""Perf indexes — hot path lookups (Sprint perf quick-wins).

Contexte (2026-05-12) :
  Audit HAR Sunimmo a révélé wait serveur médian 2-3s sur des endpoints
  triviaux (/auth/me, /sphere/pending-count, /dossier/documents). Une partie
  est due à des seq scans sur des tables où les hot-path lookups n'avaient
  pas d'index.

Audit existant :
  - ix_users_supabase_uid       → existe (0001 line 241) ✓
  - ix_users_email              → déclaré dans le model (line 89) mais pas
                                  créé en migration → drift Alembic, on
                                  rajoute idempotent
  - ix_biens_owner_id           → ABSENT du model ET des migrations → seq
                                  scan à chaque liste de biens d'un proprio
  - ix_locataires_user_id       → créé par index=True sur la colonne ✓
  - ix_locataires_bien_id_statut → ABSENT (composite manquant) → utilisé par
                                   _resolve_thread_parties, useLocataireActuel,
                                   resolve_dossier_parties

Tous les CREATE INDEX sont en IF NOT EXISTS pour rester idempotents
(certains pourraient déjà avoir été créés à la main côté Supabase Studio).

Pas de CREATE INDEX CONCURRENTLY (Alembic ne le supporte pas nativement et
les tables sont petites Phase 1.0 — pas de risque de lock long).

Doctrine §B.13 : migration Python only.

Revision ID: 0044
Revises: 0043
Create Date: 2026-05-12
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "0044"
down_revision = "0043"
branch_labels = None
depends_on = None


def _exec(sql: str) -> None:
    op.execute(sa.text(sql.strip()))


def upgrade() -> None:
    # Index missing déclaré dans le model User (drift Alembic — déjà déclaré
    # mais jamais créé en migration jusqu'à présent).
    _exec("CREATE INDEX IF NOT EXISTS ix_users_email ON users(email)")

    # Hot path : SELECT biens WHERE owner_id = X (listing dashboard proprio).
    # Pas d'index = seq scan sur toute la table biens à chaque GET /biens.
    _exec("CREATE INDEX IF NOT EXISTS ix_biens_owner_id ON biens(owner_id)")

    # Composite (bien_id, statut) — utilisé par :
    #   - _resolve_thread_parties (bien_messages router) WHERE bien_id=X AND statut='actif'
    #   - useLocataireActuel WHERE bien_id=X AND statut='actif'
    #   - resolve_dossier_parties (dossier router) implicitement via Locataire.bien_id
    _exec(
        "CREATE INDEX IF NOT EXISTS ix_locataires_bien_id_statut "
        "ON locataires(bien_id, statut)"
    )


def downgrade() -> None:
    _exec("DROP INDEX IF EXISTS ix_locataires_bien_id_statut")
    _exec("DROP INDEX IF EXISTS ix_biens_owner_id")
    _exec("DROP INDEX IF EXISTS ix_users_email")
