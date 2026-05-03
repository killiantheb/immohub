"""Modèle SQLAlchemy — compteurs de consommation par bien (PR-A11.A.6.a).

Trace les compteurs (eau froide, eau chaude, électricité, gaz, mazout,
chauffage) attachés au bien : numéro, emplacement, unité de mesure, relevé
initial à l'entrée locataire, et qui paie la consommation (proprio, locataire
ou divisé).
"""

from __future__ import annotations

import uuid
from datetime import date
from typing import TYPE_CHECKING

from app.models.base import BaseModel
from sqlalchemy import Date, ForeignKey, Index, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

if TYPE_CHECKING:
    from app.models.bien import Bien


class BienCompteur(BaseModel):
    """Compteur de consommation lié à un bien."""

    __tablename__ = "bien_compteurs"

    bien_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("biens.id", ondelete="CASCADE"),
        nullable=False,
    )
    # type : eau_froide / eau_chaude / electricite / gaz / mazout / chauffage /
    # autre
    type: Mapped[str] = mapped_column(String(30), nullable=False)
    numero_compteur: Mapped[str | None] = mapped_column(String(100))
    emplacement: Mapped[str | None] = mapped_column(String(100))
    # unite : m3 / kwh / litres / autre — default selon type côté service.
    unite: Mapped[str | None] = mapped_column(String(20))
    releve_initial: Mapped[float | None] = mapped_column(Numeric(10, 2))
    date_releve_initial: Mapped[date | None] = mapped_column(Date)
    # partage : proprietaire / locataire / divise
    partage: Mapped[str | None] = mapped_column(String(20))
    notes: Mapped[str | None] = mapped_column(Text)

    bien: Mapped[Bien] = relationship("Bien", back_populates="compteurs")

    __table_args__ = (
        Index("ix_bien_compteurs_bien_id", "bien_id"),
        Index("ix_bien_compteurs_bien_type", "bien_id", "type"),
    )
