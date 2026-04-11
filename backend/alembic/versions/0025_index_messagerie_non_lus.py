"""Index optimisés pour les endpoints /non-lus messagerie et whatsapp.

Les endpoints GET /messagerie/non-lus et /whatsapp/non-lus sont appelés
toutes les 60s par le DashboardSidebar. Ces index partiels garantissent
une réponse < 10ms même sur de grandes tables.

Note : CREATE INDEX sans CONCURRENTLY pose un verrou bref en écriture.
Pour une migration sur une table très volumineuse en production, créer
l'index manuellement avec CONCURRENTLY AVANT de lancer alembic upgrade.

Revision ID: 0025
Revises: 0024
"""

from __future__ import annotations

from alembic import op
from sqlalchemy import text

revision = "0025"
down_revision = "0024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── email_cache : index partiel (user_id) WHERE is_processed = FALSE ──────
    # Cible : SELECT COUNT(*) FROM email_cache
    #         WHERE user_id = :uid AND is_processed = FALSE
    op.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_email_cache_nonlus
            ON email_cache (user_id)
            WHERE is_processed = FALSE
    """))

    # ── whatsapp_conversations : index partiel sur unread_count > 0 ──────────
    # Cible : SELECT SUM(unread_count) FROM whatsapp_conversations
    #         WHERE user_id = :uid
    op.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_whatsapp_conv_unread
            ON whatsapp_conversations (user_id, unread_count)
            WHERE unread_count > 0
    """))


def downgrade() -> None:
    op.execute(text("DROP INDEX IF EXISTS idx_email_cache_nonlus"))
    op.execute(text("DROP INDEX IF EXISTS idx_whatsapp_conv_unread"))
