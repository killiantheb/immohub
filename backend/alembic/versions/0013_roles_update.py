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
    # 1. Add new enum values — each in its own statement.
    #    PostgreSQL requires ADD VALUE to be committed before the new value
    #    can be used (UnsafeNewEnumValueUsageError).
    #    We run the adds, then issue an explicit COMMIT so the enum labels
    #    are visible to the subsequent UPDATE statements.
    bind = op.get_bind()

    for val in NEW_VALUES:
        bind.execute(sa.text(f"""
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
        """))

    # 2. Commit so the new enum labels are safe to use.
    bind.execute(sa.text("COMMIT"))

    # 3. Migrate existing rows to new canonical names.
    bind.execute(sa.text("UPDATE users SET role = 'proprio_solo' WHERE role = 'owner'"))
    bind.execute(sa.text("UPDATE users SET role = 'agence'       WHERE role = 'agency'"))
    bind.execute(sa.text("UPDATE users SET role = 'locataire'    WHERE role = 'tenant'"))
    bind.execute(sa.text("UPDATE users SET role = 'artisan'      WHERE role = 'company'"))

    # 4. Update column default.
    bind.execute(sa.text("ALTER TABLE users ALTER COLUMN role SET DEFAULT 'proprio_solo'"))


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(sa.text("UPDATE users SET role = 'owner'   WHERE role = 'proprio_solo'"))
    bind.execute(sa.text("UPDATE users SET role = 'agency'  WHERE role = 'agence'"))
    bind.execute(sa.text("UPDATE users SET role = 'tenant'  WHERE role = 'locataire'"))
    bind.execute(sa.text("UPDATE users SET role = 'company' WHERE role = 'artisan'"))
    bind.execute(sa.text("ALTER TABLE users ALTER COLUMN role SET DEFAULT 'owner'"))
