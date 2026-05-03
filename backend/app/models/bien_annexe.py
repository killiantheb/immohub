"""Modèle SQLAlchemy — annexes liées à un bien (caves, parkings, garages).

PR-A11.A.6.a — fiche bien complète. Une annexe est une entité physique
distincte du logement principal (cave numérotée, place de parc, box, etc.)
mais rattachée au même bien. Permet de tracer le rendement individuel et
les inclusions dans le loyer.
"""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from app.models.base import BaseModel
from sqlalchemy import Boolean, ForeignKey, Index, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

if TYPE_CHECKING:
    from app.models.bien import Bien


class BienAnnexe(BaseModel):
    """Annexe d'un bien : cave, parking, place, box, garage, grenier, autre."""

    __tablename__ = "bien_annexes"

    bien_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("biens.id", ondelete="CASCADE"),
        nullable=False,
    )
    # type : cave / parking_couvert / parking_exterieur / box / garage /
    # grenier / autre  (validation Pydantic au niveau Create/Update)
    type: Mapped[str] = mapped_column(String(30), nullable=False)
    numero: Mapped[str | None] = mapped_column(String(50))
    surface_m2: Mapped[float | None] = mapped_column(Numeric(6, 2))
    inclus_dans_loyer: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    loyer_supplement: Mapped[float | None] = mapped_column(Numeric(8, 2))

    bien: Mapped[Bien] = relationship("Bien", back_populates="annexes")

    __table_args__ = (
        Index("ix_bien_annexes_bien_id", "bien_id"),
        Index("ix_bien_annexes_bien_type", "bien_id", "type"),
    )
