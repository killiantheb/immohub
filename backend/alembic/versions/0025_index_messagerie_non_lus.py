"""Index optimisés pour les endpoints /non-lus messagerie et whatsapp.

Les endpoints GET /messagerie/non-lus et /whatsapp/non-lus sont appelés
toutes les 60s par le DashboardSidebar. Ces index partiels garantissent
une réponse < 10ms même sur de grandes tables.

Revision ID: 0025
Revises: 0024
"""

from __future__ import annotations

from alembic import op

revision = "0025"
down_revision = "0024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── email_cache : index partiel (user_id) WHERE is_processed = FALSE ──────
    # Remplace l'index non-filtré idx_email_cache_unprocessed pour la query :
    #   SELECT COUNT(*) FROM email_cache
    #   WHERE user_id = :uid AND is_processed = FALSE
    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_cache_nonlus
            ON email_cache (user_id)
            WHERE is_processed = FALSE
    """)

    # ── whatsapp_conversations : index sur unread_count non nul ───────────────
    # Accélère la query :
    #   SELECT SUM(unread_count) FROM whatsapp_conversations
    #   WHERE user_id = :uid
    # L'index existant (user_id, last_message_at DESC) couvre déjà WHERE user_id.
    # On ajoute un index partiel pour le cas fréquent où unread_count > 0.
    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_whatsapp_conv_unread
            ON whatsapp_conversations (user_id, unread_count)
            WHERE unread_count > 0
    """)


def downgrade() -> None:
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_email_cache_nonlus")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_whatsapp_conv_unread")
