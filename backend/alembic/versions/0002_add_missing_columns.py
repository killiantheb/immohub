"""add missing columns (reference, owner_id, signed_ip, notes, lat/lng, mission fields)

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-05 00:00:00.000000

"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── contracts ─────────────────────────────────────────────────────────────
    op.add_column("contracts", sa.Column("reference", sa.String(50), nullable=True))
    op.add_column("contracts", sa.Column(
        "owner_id",
        postgresql.UUID(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,
    ))
    op.add_column("contracts", sa.Column("signed_ip", sa.String(45), nullable=True))

    # Backfill reference with a placeholder so we can set NOT NULL
    op.execute("UPDATE contracts SET reference = 'REF-' || substring(id::text, 1, 8) WHERE reference IS NULL")
    op.alter_column("contracts", "reference", nullable=False)
    op.create_unique_constraint("uq_contracts_reference", "contracts", ["reference"])
    op.create_index("ix_contracts_owner_id", "contracts", ["owner_id"])

    # ── transactions ──────────────────────────────────────────────────────────
    op.add_column("transactions", sa.Column("reference", sa.String(50), nullable=True))
    op.add_column("transactions", sa.Column("notes", sa.Text(), nullable=True))

    op.execute("UPDATE transactions SET reference = 'TXN-' || substring(id::text, 1, 8) WHERE reference IS NULL")
    op.alter_column("transactions", "reference", nullable=False)
    op.create_unique_constraint("uq_transactions_reference", "transactions", ["reference"])

    # ── openers ───────────────────────────────────────────────────────────────
    op.add_column("openers", sa.Column("latitude", sa.Float(), nullable=True))
    op.add_column("openers", sa.Column("longitude", sa.Float(), nullable=True))
    op.add_column("openers", sa.Column("skills", postgresql.ARRAY(sa.Text()), nullable=True))

    # ── missions ──────────────────────────────────────────────────────────────
    # Make opener_id nullable (was NOT NULL in initial schema)
    op.alter_column("missions", "opener_id", nullable=True)

    # Add requester_id
    op.add_column("missions", sa.Column(
        "requester_id",
        postgresql.UUID(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,  # temporarily nullable for backfill
    ))
    # Backfill: requester_id = first super_admin user, or NULL if none
    op.execute("""
        UPDATE missions
        SET requester_id = (SELECT id FROM users WHERE role = 'super_admin' LIMIT 1)
        WHERE requester_id IS NULL
    """)

    # Remaining new mission columns
    op.add_column("missions", sa.Column("accepted_at",      sa.DateTime(timezone=True), nullable=True))
    op.add_column("missions", sa.Column("completed_at",     sa.DateTime(timezone=True), nullable=True))
    op.add_column("missions", sa.Column("cancelled_at",     sa.DateTime(timezone=True), nullable=True))
    op.add_column("missions", sa.Column("cancelled_reason", sa.String(255),             nullable=True))
    op.add_column("missions", sa.Column("property_lat",     sa.Float(),                 nullable=True))
    op.add_column("missions", sa.Column("property_lng",     sa.Float(),                 nullable=True))
    op.add_column("missions", sa.Column("notes",            sa.Text(),                  nullable=True))
    op.add_column("missions", sa.Column("report_text",      sa.Text(),                  nullable=True))
    op.add_column("missions", sa.Column("rating_comment",   sa.Text(),                  nullable=True))
    op.add_column("missions", sa.Column("stripe_payment_intent_id", sa.String(255),     nullable=True))

    op.create_index("ix_missions_requester_id", "missions", ["requester_id"])


def downgrade() -> None:
    # missions
    op.drop_index("ix_missions_requester_id", table_name="missions")
    for col in [
        "stripe_payment_intent_id", "rating_comment", "report_text", "notes",
        "property_lng", "property_lat", "cancelled_reason", "cancelled_at",
        "completed_at", "accepted_at", "requester_id",
    ]:
        op.drop_column("missions", col)

    # openers
    op.drop_column("openers", "skills")
    op.drop_column("openers", "longitude")
    op.drop_column("openers", "latitude")

    # transactions
    op.drop_constraint("uq_transactions_reference", "transactions", type_="unique")
    op.drop_column("transactions", "notes")
    op.drop_column("transactions", "reference")

    # contracts
    op.drop_index("ix_contracts_owner_id", table_name="contracts")
    op.drop_constraint("uq_contracts_reference", "contracts", type_="unique")
    op.drop_column("contracts", "signed_ip")
    op.drop_column("contracts", "owner_id")
    op.drop_column("contracts", "reference")
