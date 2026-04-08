"""Add brouillon/publiee statuts to mission_ouvreur and intervention enums.

Revision ID: 0008
Revises: 0007
Create Date: 2026-04-08
"""

from __future__ import annotations

from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # PostgreSQL ALTER TYPE ... ADD VALUE is transactional only in PG >= 12
    # Use DO block so this is idempotent
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_enum
                WHERE enumlabel = 'brouillon'
                  AND enumtypid = 'mission_ouvreur_statut_enum'::regtype
            ) THEN
                ALTER TYPE mission_ouvreur_statut_enum ADD VALUE 'brouillon' BEFORE 'proposee';
            END IF;
        END
        $$;
    """)
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_enum
                WHERE enumlabel = 'publiee'
                  AND enumtypid = 'mission_ouvreur_statut_enum'::regtype
            ) THEN
                ALTER TYPE mission_ouvreur_statut_enum ADD VALUE 'publiee' AFTER 'proposee';
            END IF;
        END
        $$;
    """)
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_enum
                WHERE enumlabel = 'brouillon'
                  AND enumtypid = 'intervention_statut_enum'::regtype
            ) THEN
                ALTER TYPE intervention_statut_enum ADD VALUE 'brouillon' BEFORE 'nouveau';
            END IF;
        END
        $$;
    """)
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_enum
                WHERE enumlabel = 'publie'
                  AND enumtypid = 'intervention_statut_enum'::regtype
            ) THEN
                ALTER TYPE intervention_statut_enum ADD VALUE 'publie' AFTER 'nouveau';
            END IF;
        END
        $$;
    """)


def downgrade() -> None:
    # Cannot remove enum values in PostgreSQL without recreating the type
    pass
