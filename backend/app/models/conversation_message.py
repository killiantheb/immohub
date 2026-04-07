from __future__ import annotations

import uuid as uuid_module

from app.models.base import BaseModel
from sqlalchemy import Index, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column


class ConversationMessage(BaseModel):
    """Stocke l'historique des conversations avec Althy AI par utilisateur/session."""

    __tablename__ = "conversation_messages"

    user_id: Mapped[uuid_module.UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False)
    session_id: Mapped[str] = mapped_column(String(36), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)   # "user" | "assistant"
    content: Mapped[str] = mapped_column(Text, nullable=False)

    __table_args__ = (
        Index("ix_conv_user_session", "user_id", "session_id"),
        Index("ix_conv_created_at", "created_at"),
    )
