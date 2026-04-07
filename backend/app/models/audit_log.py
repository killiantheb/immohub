import uuid
from datetime import datetime

from app.models.base import Base  # AuditLog does NOT use BaseModel (no updated_at/is_active)
from sqlalchemy import DateTime, ForeignKey, Index, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column


class AuditLog(Base):
    """Append-only audit trail — intentionally excludes updated_at and is_active."""

    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(100), nullable=False)
    resource_id: Mapped[str | None] = mapped_column(String(36))
    old_values: Mapped[dict | None] = mapped_column(JSONB)
    new_values: Mapped[dict | None] = mapped_column(JSONB)
    ip_address: Mapped[str | None] = mapped_column(String(45))  # IPv6 max length
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("ix_audit_logs_user_id", "user_id"),
        Index("ix_audit_logs_action", "action"),
        Index("ix_audit_logs_resource_type", "resource_type"),
        Index("ix_audit_logs_resource_id", "resource_id"),
        Index("ix_audit_logs_created_at", "created_at"),
        Index("ix_audit_logs_old_values", "old_values", postgresql_using="gin"),
        Index("ix_audit_logs_new_values", "new_values", postgresql_using="gin"),
    )
