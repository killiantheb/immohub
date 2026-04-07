"""Document templates and generated documents."""

from __future__ import annotations

import uuid

from app.models.base import BaseModel
from sqlalchemy import Boolean, DateTime, Index, Integer, JSON, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func


class DocumentTemplate(BaseModel):
    __tablename__ = "document_templates"

    template_type: Mapped[str] = mapped_column(String(60), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    language: Mapped[str] = mapped_column(String(5), nullable=False, default="fr")
    canton: Mapped[str | None] = mapped_column(String(10))
    content_html: Mapped[str] = mapped_column(Text, nullable=False)
    variables_used: Mapped[list | None] = mapped_column(JSON)
    agency_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")

    __table_args__ = (
        Index("ix_document_templates_type", "template_type"),
        Index("ix_document_templates_agency", "agency_id"),
    )


class GeneratedDocument(BaseModel):
    __tablename__ = "generated_documents"

    template_type: Mapped[str] = mapped_column(String(60), nullable=False)
    contract_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    property_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    agency_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    generated_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    content_html: Mapped[str] = mapped_column(Text, nullable=False)
    context_data: Mapped[dict | None] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")

    __table_args__ = (
        Index("ix_generated_documents_contract", "contract_id"),
        Index("ix_generated_documents_owner", "owner_id"),
        Index("ix_generated_documents_type", "template_type"),
    )
