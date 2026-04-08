import uuid

from app.models.base import BaseModel
from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column


class CRMContact(BaseModel):
    """Prospect ou contact externe lié à un propriétaire — pas encore locataire."""

    __tablename__ = "crm_contacts"

    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    # Si le contact a un compte Althy (ex: locataire potentiel inscrit)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    property_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("properties.id", ondelete="SET NULL")
    )

    first_name: Mapped[str | None] = mapped_column(String(100))
    last_name: Mapped[str | None] = mapped_column(String(100))
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(30))
    # prospect
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="prospect")
    # manual | inquiry | portal | referral
    source: Mapped[str] = mapped_column(String(30), nullable=False, default="manual")

    __table_args__ = (
        Index("ix_crm_contacts_owner_id", "owner_id"),
        Index("ix_crm_contacts_user_id", "user_id"),
        Index("ix_crm_contacts_property_id", "property_id"),
    )


class CRMNote(BaseModel):
    """Note libre rédigée par le propriétaire sur un contact (locataire ou prospect)."""

    __tablename__ = "crm_notes"

    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    # Exactement un des deux doit être renseigné
    target_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE")
    )
    target_contact_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crm_contacts.id", ondelete="CASCADE")
    )
    property_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("properties.id", ondelete="SET NULL")
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)

    __table_args__ = (
        Index("ix_crm_notes_owner_id", "owner_id"),
        Index("ix_crm_notes_target_user_id", "target_user_id"),
        Index("ix_crm_notes_target_contact_id", "target_contact_id"),
    )
