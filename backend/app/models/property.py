import uuid

from app.models.base import BaseModel
from sqlalchemy import Boolean, Enum, Float, ForeignKey, Index, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

PropertyType = Enum(
    "apartment",
    "villa",
    "parking",
    "garage",
    "box",
    "cave",
    "depot",
    "office",
    "commercial",
    "hotel",
    name="property_type_enum",
)

PropertyStatus = Enum(
    "available",
    "rented",
    "for_sale",
    "sold",
    "maintenance",
    name="property_status_enum",
)

PropertyDocumentType = Enum(
    "lease",
    "inventory",
    "insurance",
    "notice",
    "deed",
    "diagnosis",
    "other",
    name="property_document_type_enum",
)


class Property(BaseModel):
    __tablename__ = "properties"

    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    agency_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    created_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )

    type: Mapped[str] = mapped_column(PropertyType, nullable=False)
    status: Mapped[str] = mapped_column(PropertyStatus, nullable=False, default="available")

    address: Mapped[str] = mapped_column(String(500), nullable=False)
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    zip_code: Mapped[str] = mapped_column(String(10), nullable=False)
    country: Mapped[str] = mapped_column(
        String(2), nullable=False, default="FR", server_default="FR"
    )

    surface: Mapped[float | None] = mapped_column(Float)
    rooms: Mapped[int | None] = mapped_column(Integer)
    floor: Mapped[int | None] = mapped_column(Integer)
    description: Mapped[str | None] = mapped_column(Text)

    monthly_rent: Mapped[float | None] = mapped_column(Numeric(12, 2))
    charges: Mapped[float | None] = mapped_column(Numeric(12, 2))
    deposit: Mapped[float | None] = mapped_column(Numeric(12, 2))
    price_sale: Mapped[float | None] = mapped_column(Numeric(14, 2))

    is_furnished: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    has_parking: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    pets_allowed: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    __table_args__ = (
        Index("ix_properties_owner_id", "owner_id"),
        Index("ix_properties_agency_id", "agency_id"),
        Index("ix_properties_created_by_id", "created_by_id"),
        Index("ix_properties_status", "status"),
        Index("ix_properties_type", "type"),
        Index("ix_properties_city", "city"),
        Index("ix_properties_zip_code", "zip_code"),
    )


class PropertyImage(BaseModel):
    __tablename__ = "property_images"

    property_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("properties.id", ondelete="CASCADE"), nullable=False
    )
    url: Mapped[str] = mapped_column(Text, nullable=False)
    order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_cover: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    __table_args__ = (
        Index("ix_property_images_property_id", "property_id"),
        Index("ix_property_images_order", "property_id", "order"),
    )


class PropertyDocument(BaseModel):
    __tablename__ = "property_documents"

    property_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("properties.id", ondelete="CASCADE"), nullable=False
    )
    type: Mapped[str] = mapped_column(PropertyDocumentType, nullable=False)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)

    __table_args__ = (
        Index("ix_property_documents_property_id", "property_id"),
        Index("ix_property_documents_type", "type"),
    )
