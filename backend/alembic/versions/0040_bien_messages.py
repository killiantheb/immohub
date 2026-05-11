"""bien_messages table — messagerie interne 1:1 bailleur ↔ locataire (Phase 1.0).

Contexte (2026-05-12) :
  Sprint Module Communication PR-1. Spec `docs/4-PRODUIT.md §4.13` mentionnait
  une table `messages` « migration 004 déjà en place » — vérification 2026-05-11
  : table absente, aucune migration ne la crée. PR-1 rectifie.

  Choix de naming `bien_messages` (et non `messages` générique) pour cohérence
  avec les tables filles de `biens` du repo : `bien_annexes`, `bien_contacts`,
  `bien_compteurs`, `bien_keys`. Et pour disambiguïser face aux tables Phase 2
  dormantes `whatsapp_messages` / `portail_messages` / `email_cache` (cf
  CLAUDE.md §2.4.6).

Doctrine appliquée :
  - §B.13 : migration Alembic Python uniquement. RLS via `op.execute()`.
  - §B.10 : check constraints (body non vide, pas de message à soi-même) —
    le backend ne ment pas, la DB refuse les insertions invalides.
  - §B.15 : aucune dépendance OAuth/WhatsApp/SMS. La table sert uniquement
    la messagerie interne Phase 1.0 (Resend uniquement pour les notifs).

Revision ID: 0040
Revises: 0039
Create Date: 2026-05-12
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision = "0040"
down_revision = "0039"
branch_labels = None
depends_on = None


def _exec(sql: str) -> None:
    """Execute a single SQL statement — asyncpg forbids multi-statement strings."""
    op.execute(sa.text(sql.strip()))


def upgrade() -> None:
    op.create_table(
        "bien_messages",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "bien_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("biens.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "sender_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "recipient_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "lu",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column("lu_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        sa.CheckConstraint(
            "length(trim(body)) > 0",
            name="ck_bien_messages_body_not_empty",
        ),
        sa.CheckConstraint(
            "sender_user_id <> recipient_user_id",
            name="ck_bien_messages_no_self_message",
        ),
    )

    # ── Indexes ──────────────────────────────────────────────────────────────
    # 1. Listing du thread (ordre chronologique sur un bien donné).
    op.create_index(
        "ix_bien_messages_bien_created",
        "bien_messages",
        ["bien_id", sa.text("created_at DESC")],
    )
    # 2. Messages envoyés par un user (stats / debug — pas en hot path).
    op.create_index(
        "ix_bien_messages_sender_created",
        "bien_messages",
        ["sender_user_id", sa.text("created_at DESC")],
    )
    # 3. Badge unread : partial index sur les non-lus du recipient.
    op.create_index(
        "ix_bien_messages_recipient_unread",
        "bien_messages",
        ["recipient_user_id"],
        postgresql_where=sa.text("lu = FALSE"),
    )

    # ── RLS policies (helpers `althy_current_user_id/role` créés en 0019) ────
    _exec("ALTER TABLE bien_messages ENABLE ROW LEVEL SECURITY")

    _exec("DROP POLICY IF EXISTS select_own_bien_messages ON bien_messages")
    _exec(
        """
        CREATE POLICY select_own_bien_messages ON bien_messages
        FOR SELECT TO authenticated
        USING (
            sender_user_id    = althy_current_user_id()
            OR recipient_user_id = althy_current_user_id()
        )
        """
    )

    _exec("DROP POLICY IF EXISTS insert_own_bien_messages ON bien_messages")
    _exec(
        """
        CREATE POLICY insert_own_bien_messages ON bien_messages
        FOR INSERT TO authenticated
        WITH CHECK (sender_user_id = althy_current_user_id())
        """
    )

    # Seul le recipient peut UPDATE (marquer lu). Le backend restreindra les
    # colonnes éditables côté SQLAlchemy ; côté Postgres on autorise la ligne.
    _exec("DROP POLICY IF EXISTS update_recipient_marks_read ON bien_messages")
    _exec(
        """
        CREATE POLICY update_recipient_marks_read ON bien_messages
        FOR UPDATE TO authenticated
        USING (recipient_user_id = althy_current_user_id())
        WITH CHECK (recipient_user_id = althy_current_user_id())
        """
    )

    # Pas de policy DELETE Phase 1.0 → suppression interdite (immutable). Soft
    # delete éventuel via `is_active = FALSE` Phase 2 (pattern repo standard).

    _exec("DROP POLICY IF EXISTS admin_all_bien_messages ON bien_messages")
    _exec(
        """
        CREATE POLICY admin_all_bien_messages ON bien_messages
        FOR ALL TO authenticated
        USING (althy_current_role() IN ('admin', 'super_admin'))
        WITH CHECK (althy_current_role() IN ('admin', 'super_admin'))
        """
    )


def downgrade() -> None:
    _exec("DROP POLICY IF EXISTS admin_all_bien_messages ON bien_messages")
    _exec("DROP POLICY IF EXISTS update_recipient_marks_read ON bien_messages")
    _exec("DROP POLICY IF EXISTS insert_own_bien_messages ON bien_messages")
    _exec("DROP POLICY IF EXISTS select_own_bien_messages ON bien_messages")
    op.drop_index("ix_bien_messages_recipient_unread", table_name="bien_messages")
    op.drop_index("ix_bien_messages_sender_created", table_name="bien_messages")
    op.drop_index("ix_bien_messages_bien_created", table_name="bien_messages")
    op.drop_table("bien_messages")
