"""Modèle SQLAlchemy — bien_messages (messagerie 1:1 bailleur ↔ locataire).

Cf migration `0040_bien_messages.py` pour le schéma SQL exact + RLS.
Cf doctrine `docs/4-PRODUIT.md §4.13` (Phase 1.0 — Resend uniquement).
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from app.models.base import BaseModel
from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

if TYPE_CHECKING:
    from app.models.bien import Bien
    from app.models.user import User


class BienMessage(BaseModel):
    __tablename__ = "bien_messages"

    bien_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("biens.id", ondelete="CASCADE"),
        nullable=False,
    )
    sender_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    recipient_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    body: Mapped[str] = mapped_column(Text, nullable=False)
    lu: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    lu_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # ── Relations ────────────────────────────────────────────────────────────
    bien: Mapped["Bien"] = relationship(
        "Bien",
        back_populates="messages",
        foreign_keys=[bien_id],
    )
    sender: Mapped["User"] = relationship(
        "User",
        foreign_keys=[sender_user_id],
    )
    recipient: Mapped["User"] = relationship(
        "User",
        foreign_keys=[recipient_user_id],
    )

    __table_args__ = (
        Index(
            "ix_bien_messages_bien_created",
            "bien_id",
            "created_at",
        ),
        Index(
            "ix_bien_messages_sender_created",
            "sender_user_id",
            "created_at",
        ),
        Index(
            "ix_bien_messages_recipient_unread",
            "recipient_user_id",
            postgresql_where="lu = FALSE",
        ),
        CheckConstraint(
            "length(trim(body)) > 0",
            name="ck_bien_messages_body_not_empty",
        ),
        CheckConstraint(
            "sender_user_id <> recipient_user_id",
            name="ck_bien_messages_no_self_message",
        ),
    )
