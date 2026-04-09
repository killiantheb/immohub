"""Update user_role_enum — 9 Althy roles (CLAUDE.md §profiles).

Maps legacy values → new canonical names:
  owner   → proprio_solo
  agency  → agence
  tenant  → locataire
  company → artisan

Adds: portail_proprio, expert, hunter, acheteur_premium

Revision ID: 0013
Revises: 0012
Create Date: 2026-04-09
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None

# New role values to add (PostgreSQL can only add, not rename enum values)
NEW_VALUES = [
    "proprio_solo",
    "agence",
    "locataire",
    "artisan",
    "portail_proprio",
    "expert",
    "hunter",
    "acheteur_premium",
]


def upgrade() -> None:
    # 1. Add new enum values (idempotent via DO block)
    for val in NEW_VALUES:
        op.execute(f"""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_enum
                    WHERE enumlabel = '{val}'
                    AND enumtypid = 'user_role_enum'::regtype::oid
                ) THEN
                    ALTER TYPE user_role_enum ADD VALUE '{val}';
                END IF;
            END $$;
        """)

    # 2. Migrate existing rows to new canonical names
    op.execute("""
        UPDATE users SET role = 'proprio_solo'
        WHERE role = 'owner';
    """)
    op.execute("""
        UPDATE users SET role = 'agence'
        WHERE role = 'agency';
    """)
    op.execute("""
        UPDATE users SET role = 'locataire'
        WHERE role = 'tenant';
    """)
    op.execute("""
        UPDATE users SET role = 'artisan'
        WHERE role = 'company';
    """)

    # 3. Update the column default
    op.execute("""
        ALTER TABLE users ALTER COLUMN role SET DEFAULT 'proprio_solo';
    """)


def downgrade() -> None:
    # Revert data migration (can't remove enum values in PostgreSQL)
    op.execute("UPDATE users SET role = 'owner'    WHERE role = 'proprio_solo'")
    op.execute("UPDATE users SET role = 'agency'   WHERE role = 'agence'")
    op.execute("UPDATE users SET role = 'tenant'   WHERE role = 'locataire'")
    op.execute("UPDATE users SET role = 'company'  WHERE role = 'artisan'")
    op.execute("ALTER TABLE users ALTER COLUMN role SET DEFAULT 'owner'")
