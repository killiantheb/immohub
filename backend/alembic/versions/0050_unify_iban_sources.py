"""Unify IBAN sources of truth — bank_accounts canonical.

Contexte (Sprint 9 Lot A — 2026-05-14) :
  Audit IBAN bailleur a révélé une dispersion historique :
    * `users.iban` (colonne legacy depuis 0001, seedée vers `bank_accounts`
       à la migration 0035).
    * `bank_accounts` (table canonique multi-comptes par usage, créée 0035).

  Note : aucun `settings.payment_iban` n'existe dans le schéma — cette source
  hypothétique mentionnée dans le brief Lot A est en réalité absente du code
  (cf IBAN_USAGE_AUDIT.md à la racine). Cette migration ne crée donc PAS de
  colonne fictive : elle se concentre sur (a) acter la dépréciation côté
  Postgres via `COMMENT ON COLUMN`, (b) renommer `users.iban` → `users.iban_legacy`
  pour rendre la dépréciation visible au moindre `\\d users`, et (c) ajouter
  `biens.iban_compte_id` FK pour permettre l'override par bien dans
  `iban_resolver.get_effective_iban`.

  Périmètre :
    1. RENAME `users.iban` → `users.iban_legacy` (idem `users.bic` →
       `users.bic_legacy` et `users.bank_account_holder` →
       `users.bank_account_holder_legacy` pour cohérence — toutes pointent
       vers la même source dépréciée).
    2. COMMENT ON COLUMN `users.iban_legacy` (et bic/holder) : marqueur
       dépréciation lisible via `psql \\d+ users`.
    3. ADD COLUMN `biens.iban_compte_id` UUID NULL → FK
       `bank_accounts(id) ON DELETE SET NULL`. Permet de surcharger le
       compte bancaire utilisé pour la QR-facture d'un bien spécifique
       (cas multi-régies par bailleur).
    4. Backfill idempotent : pour chaque user avec `iban_legacy` non vide
       qui n'a aucune ligne `bank_accounts`, créer une ligne `general`
       `est_principal=true`. La migration 0035 a déjà fait ce seed ; on
       protège contre le cas (rare) d'un user ajouté manuellement après
       0035 avec un IBAN mais sans `bank_accounts` correspondant.

Doctrine §B.13 : Python pur, aucun fichier `.sql` orphelin.
Doctrine §B.12 : aucune transaction longue ici — Alembic gère la transaction.

Revision ID: 0050
Revises: 0049
Create Date: 2026-05-14
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0050"
down_revision = "0049"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. Renommer users.iban / bic / bank_account_holder → *_legacy ────────
    # Visibilité immédiate côté DBA : `psql \d+ users` montre les colonnes
    # legacy en clair. Le code applicatif est migré dans le même PR.
    op.alter_column("users", "iban", new_column_name="iban_legacy")
    op.alter_column("users", "bic", new_column_name="bic_legacy")
    op.alter_column(
        "users", "bank_account_holder", new_column_name="bank_account_holder_legacy"
    )

    # ── 2. Commenter les colonnes legacy ──────────────────────────────────────
    op.execute(
        "COMMENT ON COLUMN users.iban_legacy IS "
        "'DEPRECATED Sprint 9 Lot A (2026-05-14) — use bank_accounts table. "
        "Read fallback only via iban_resolver.get_effective_iban.'"
    )
    op.execute(
        "COMMENT ON COLUMN users.bic_legacy IS "
        "'DEPRECATED Sprint 9 Lot A — use bank_accounts.bic.'"
    )
    op.execute(
        "COMMENT ON COLUMN users.bank_account_holder_legacy IS "
        "'DEPRECATED Sprint 9 Lot A — use bank_accounts.titulaire.'"
    )

    # ── 3. biens.iban_compte_id FK bank_accounts(id) ──────────────────────────
    # ON DELETE SET NULL : si le compte bancaire référencé est supprimé,
    # le bien retombe sur le compte principal (est_principal=true) du
    # propriétaire via la cascade `iban_resolver.get_effective_iban`.
    op.add_column(
        "biens",
        sa.Column(
            "iban_compte_id",
            UUID(as_uuid=True),
            sa.ForeignKey("bank_accounts.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_biens_iban_compte_id",
        "biens",
        ["iban_compte_id"],
    )

    # ── 4. Backfill idempotent users.iban_legacy → bank_accounts ─────────────
    # Couvre les users créés post-migration 0035 avec un IBAN saisi via
    # l'ancien chemin (PUT /users/me iban) sans création parallèle de
    # bank_accounts. Sans ce filet, get_effective_iban renverrait None alors
    # que la legacy contient une donnée.
    op.execute(
        """
        INSERT INTO bank_accounts (
            id, user_id, usage, iban, bic, titulaire,
            est_principal, banque_pays, created_at, updated_at, is_active
        )
        SELECT
            gen_random_uuid(),
            u.id,
            'general',
            u.iban_legacy,
            u.bic_legacy,
            COALESCE(
                NULLIF(u.bank_account_holder_legacy, ''),
                NULLIF(TRIM(COALESCE(u.first_name, '') || ' ' ||
                            COALESCE(u.last_name, '')), ''),
                u.email
            ),
            true,
            'CH',
            now(),
            now(),
            true
        FROM users u
        WHERE u.iban_legacy IS NOT NULL
          AND u.iban_legacy <> ''
          AND NOT EXISTS (
              SELECT 1 FROM bank_accounts ba WHERE ba.user_id = u.id
          )
        """
    )


def downgrade() -> None:
    # 1. Drop FK + index biens.iban_compte_id
    op.drop_index("ix_biens_iban_compte_id", table_name="biens")
    op.drop_column("biens", "iban_compte_id")

    # 2. Rétablir les noms historiques users.iban / bic / bank_account_holder
    #    Les COMMENT ON COLUMN sont automatiquement perdus au rename.
    op.alter_column(
        "users", "bank_account_holder_legacy", new_column_name="bank_account_holder"
    )
    op.alter_column("users", "bic_legacy", new_column_name="bic")
    op.alter_column("users", "iban_legacy", new_column_name="iban")
