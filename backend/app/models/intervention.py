"""Modèles SQLAlchemy — tables interventions + devis + intervention_photos."""

from __future__ import annotations

import uuid
from datetime import date, datetime

from app.models.base import BaseModel
from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

InterventionCategorie = Enum(
    "plomberie",
    "electricite",
    "menuiserie",
    "peinture",
    "serrurerie",
    "chauffage",
    "autre",
    name="intervention_categorie_enum",
)

InterventionUrgence = Enum(
    "faible",
    "moderee",
    "urgente",
    "tres_urgente",
    name="intervention_urgence_enum",
)

InterventionStatut = Enum(
    "nouveau",
    "en_cours",
    "planifie",
    "resolu",
    name="intervention_statut_enum",
)

DevisStatut = Enum(
    "en_attente",
    "accepte",
    "refuse",
    name="devis_statut_enum",
)


class Intervention(BaseModel):
    __tablename__ = "interventions"

    bien_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("biens.id", ondelete="CASCADE"), nullable=False, index=True
    )
    signale_par_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    artisan_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    titre: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    categorie: Mapped[str] = mapped_column(InterventionCategorie, nullable=False, default="autre")
    urgence: Mapped[str] = mapped_column(InterventionUrgence, nullable=False, default="moderee")
    statut: Mapped[str] = mapped_column(
        InterventionStatut, nullable=False, default="nouveau", server_default="nouveau"
    )
    avancement: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    date_signalement: Mapped[date | None] = mapped_column(Date)
    date_intervention: Mapped[date | None] = mapped_column(Date)
    cout: Mapped[float | None] = mapped_column(Numeric(10, 2))
    # Legacy ARRAY de URLs — conservé pour compat. La nouvelle UI utilise
    # la relation `images` (intervention_photos) qui expose des IDs stables.
    photos: Mapped[list[str] | None] = mapped_column(ARRAY(Text))
    # Champs de clôture (PR-A11.A.5).
    note_cloture: Mapped[str | None] = mapped_column(Text)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    images: Mapped[list[InterventionPhoto]] = relationship(
        "InterventionPhoto",
        cascade="all, delete-orphan",
        order_by="InterventionPhoto.order",
        lazy="selectin",
    )


class InterventionPhoto(BaseModel):
    """Photo jointe à une intervention — table relation, ID stable.

    URL = lien public Supabase Storage (bucket
    `settings.SUPABASE_BUCKET_BIEN_IMAGES`, chemin
    `{bien_id}/interventions/{intervention_id}/{photo_id}{ext}`).
    """

    __tablename__ = "intervention_photos"

    intervention_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("interventions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    url: Mapped[str] = mapped_column(Text, nullable=False)
    order: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )


class Devis(BaseModel):
    __tablename__ = "devis"

    intervention_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("interventions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    artisan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    montant: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    statut: Mapped[str] = mapped_column(
        DevisStatut, nullable=False, default="en_attente", server_default="en_attente"
    )
    date_envoi: Mapped[date | None] = mapped_column(Date)
    date_reponse: Mapped[date | None] = mapped_column(Date)
