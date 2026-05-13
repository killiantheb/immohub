"""loyer_transactions — fix table fantôme §B.13 doctrine.

Contexte (Sprint 7 Lot A — 2026-05-13) :
  Audit DB structurel 2026-05-13 (§8) a identifié que la table
  `loyer_transactions` est requêtée en raw SQL par 4 fichiers backend
  (loyers.py, tasks/rent_tasks.py, services/reconciliation.py,
  tasks/email_sequences.py) mais n'apparaît dans AUCUNE migration
  Alembic du repo.

  Origine probable : créée à la main en SQL Supabase (legacy 2025) ou
  via une migration `.sql` jamais convertie. Identique à l'incident
  `ai_usage_logs` du 2026-05-08 — récidive 1 mois plus tard.

  Conséquences mesurées :
    - Staging Supabase : table absente → `alembic upgrade head` crée
      bien la migration Alembic mais l'app plante au premier appel à
      /loyers/* (table inexistante).
    - Prod : table présente (legacy SQL), mais toute modification de
      colonne via Alembic est impossible sans cette migration baseline.

  Solution doctrine §B.13 : créer la table en Python pur via
  `op.execute(CREATE TABLE IF NOT EXISTS ...)` idempotent. Si la table
  existe déjà en prod, la migration est un no-op (la définition prod
  est conservée telle quelle, on s'aligne via les futurs ALTER).

⚠️ Architecture transit Althy (Phase 1.0 doctrine v6) : ce schéma est
   conservé tel quel pour rétrocompatibilité du code existant.
   `commission_pct` / `commission_montant` / `montant_reverse` /
   `date_reversement` / `reference_virement_sortant` sont des reliquats
   du flux Phase 2 « Althy = compte de transit avec commission 4 % ».
   Phase 1.0 = paiement direct bailleur (§B.15) → ces colonnes restent
   à 0 / NULL. Cleanup Phase 2 quand activation Stripe Connect (cf
   audit DB Top dette #8).

`tenant_id` : référence libre vers `locataires.id` (pas de FK déclarée).
Choix historique conservé pour ne pas verrouiller le cycle changement
de locataire (cf migration 0030 — même pattern sur
`changements_locataire.nouveau_locataire_id`).

`date_reception` ajoutée car utilisée par
`services/reconciliation.py:111` lors d'un match CAMT.054 — sans cette
colonne le UPDATE plante en staging.

Revision ID: 0047
Revises: 0046
Create Date: 2026-05-14
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0047"
down_revision = "0046"
branch_labels = None
depends_on = None


def _exec(sql: str) -> None:
    """Execute a single SQL statement — asyncpg forbids multi-statement strings."""
    op.execute(sa.text(sql.strip()))


def upgrade() -> None:
    # ── Table loyer_transactions (idempotente — peut déjà exister en prod) ──
    _exec("""
        CREATE TABLE IF NOT EXISTS loyer_transactions (
            id                          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
            bien_id                     UUID         NOT NULL REFERENCES biens(id) ON DELETE CASCADE,
            tenant_id                   UUID,        -- référence libre vers locataires.id (pas de FK historique)
            owner_id                    UUID         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

            montant_total               NUMERIC(10,2) NOT NULL,
            commission_pct              NUMERIC(5,2)  NOT NULL DEFAULT 0,
            commission_montant          NUMERIC(10,2) NOT NULL DEFAULT 0,
            montant_reverse             NUMERIC(10,2),

            qr_reference                TEXT,
            statut                      VARCHAR(20)  NOT NULL DEFAULT 'en_attente',

            mois_concerne               DATE         NOT NULL,
            date_reception              TIMESTAMPTZ,
            date_reversement            TIMESTAMPTZ,
            reference_virement_sortant  TEXT,

            created_at                  TIMESTAMPTZ  NOT NULL DEFAULT now(),
            updated_at                  TIMESTAMPTZ  NOT NULL DEFAULT now(),

            CONSTRAINT ck_loyer_transactions_statut CHECK (
                statut IN ('en_attente', 'recu', 'reverse', 'en_retard', 'conteste')
            )
        )
    """)

    # ── Indexes (idempotents) ────────────────────────────────────────────────
    _exec("""
        CREATE INDEX IF NOT EXISTS ix_loyer_transactions_bien_id
            ON loyer_transactions (bien_id)
    """)
    _exec("""
        CREATE INDEX IF NOT EXISTS ix_loyer_transactions_owner_id
            ON loyer_transactions (owner_id)
    """)
    _exec("""
        CREATE INDEX IF NOT EXISTS ix_loyer_transactions_tenant_id
            ON loyer_transactions (tenant_id)
    """)
    _exec("""
        CREATE INDEX IF NOT EXISTS ix_loyer_transactions_statut
            ON loyer_transactions (statut)
    """)
    _exec("""
        CREATE INDEX IF NOT EXISTS ix_loyer_transactions_mois
            ON loyer_transactions (mois_concerne DESC)
    """)
    # Index partial pour le job reversement (rent_tasks._process_reversements
    # qui filtre statut='recu' AND date_reversement IS NULL).
    _exec("""
        CREATE INDEX IF NOT EXISTS ix_loyer_transactions_a_reverser
            ON loyer_transactions (mois_concerne)
            WHERE statut = 'recu' AND date_reversement IS NULL
    """)
    # Index unique pour éviter les doublons (bien, mois) — déjà enforcé
    # côté application (loyers.py:122-127 check préalable) mais defense
    # in depth.
    _exec("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_loyer_transactions_bien_mois
            ON loyer_transactions (bien_id, mois_concerne)
    """)


def downgrade() -> None:
    # CASCADE pour propager si une table dependante a été créée plus tard.
    _exec("DROP TABLE IF EXISTS loyer_transactions CASCADE")
