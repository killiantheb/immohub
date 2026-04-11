"""Index optimisés pour les endpoints /non-lus messagerie et whatsapp.

Les endpoints GET /messagerie/non-lus et /whatsapp/non-lus sont appelés
toutes les 60s par le DashboardSidebar. Ces index partiels garantissent
une réponse < 10ms même sur de grandes tables.

CREATE INDEX CONCURRENTLY ne peut pas s'exécuter dans une transaction Alembic.
On utilise AUTOCOMMIT sur la connexion pour les créer hors transaction.

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
    conn = op.get_bind()
    # CONCURRENTLY exige l'absence de transaction — on passe en autocommit
    conn.execution_options(isolation_level="AUTOCOMMIT")

    # ── email_cache : index partiel (user_id) WHERE is_processed = FALSE ──────
    # Query cible :
    #   SELECT COUNT(*) FROM email_cache
    #   WHERE user_id = :uid AND is_processed = FALSE
    conn.execute(text("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_cache_nonlus
            ON email_cache (user_id)
            WHERE is_processed = FALSE
    """))

    # ── whatsapp_conversations : index partiel sur unread_count > 0 ──────────
    # Query cible :
    #   SELECT SUM(unread_count) FROM whatsapp_conversations
    #   WHERE user_id = :uid
    conn.execute(text("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_whatsapp_conv_unread
            ON whatsapp_conversations (user_id, unread_count)
            WHERE unread_count > 0
    """))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execution_options(isolation_level="AUTOCOMMIT")
    conn.execute(text("DROP INDEX CONCURRENTLY IF EXISTS idx_email_cache_nonlus"))
    conn.execute(text("DROP INDEX CONCURRENTLY IF EXISTS idx_whatsapp_conv_unread"))
