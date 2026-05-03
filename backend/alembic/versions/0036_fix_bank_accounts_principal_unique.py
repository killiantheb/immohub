"""Fix unique partial index bank_accounts : filtrer aussi sur is_active.

Sans `is_active` dans le WHERE clause, les comptes soft-deleted bloquent la
création d'un nouveau compte principal pour le même user (la ligne reste en
DB avec `est_principal=true, is_active=false` et occupe le slot unique).

Bug latent confirmé par l'audit A11.A.6.b — fix avant le sprint A11.A.6.c.

Revision ID: 0036
Revises: 0035
Create Date: 2026-05-03
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "0036"
down_revision = "0035"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop l'ancien index (créé en 0035)
    op.drop_index(
        "ix_bank_accounts_user_principal_unique",
        table_name="bank_accounts",
    )

    # Recréer avec WHERE étendu (is_active = true)
    op.create_index(
        "ix_bank_accounts_user_principal_unique",
        "bank_accounts",
        ["user_id"],
        unique=True,
        postgresql_where=sa.text("est_principal = true AND is_active = true"),
    )


def downgrade() -> None:
    # Inverse : retour à l'ancien index sans filtre is_active
    op.drop_index(
        "ix_bank_accounts_user_principal_unique",
        table_name="bank_accounts",
    )

    op.create_index(
        "ix_bank_accounts_user_principal_unique",
        "bank_accounts",
        ["user_id"],
        unique=True,
        postgresql_where=sa.text("est_principal = true"),
    )
