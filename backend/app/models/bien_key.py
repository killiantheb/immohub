"""Modèle SQLAlchemy — clés / badges / cadenas liés à un bien (PR-A11.A.6.d).

Pattern aligné `BienAnnexe` / `BienContact` / `BienCompteur` (1:N par bien,
soft-delete via is_active, timestamps audit). Permet de tracer chaque clé
ou badge physique distribué au locataire (entrée, cave, boîte aux lettres,
parking, etc.).

Le champ `Bien.keys_count` est conservé sur Bien (compat affichage rapide)
et recalculé à chaque CRUD par `BienKeyService`.
"""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from app.models.base import BaseModel
from sqlalchemy import Boolean, ForeignKey, Index, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

if TYPE_CHECKING:
    from app.models.bien import Bien


class BienKey(BaseModel):
    """Clé / badge / cadenas physique lié à un bien."""

    __tablename__ = "bien_keys"

    bien_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("biens.id", ondelete="CASCADE"),
        nullable=False,
    )
    # type : str libre — liste métier 14 valeurs côté frontend (PR-A11.A.6.h) :
    # appartement / immeuble / boite_aux_lettres / cave_acces / cave_personnelle /
    # buanderie / machine_laver_badge / garage_bippeur / garage_porte / ski_room /
    # ski_room_acces / chaufferie / carte_securite_protegee / autre
    type: Mapped[str] = mapped_column(String(30), nullable=False)
    numero_badge: Mapped[str | None] = mapped_column(String(50))
    description: Mapped[str | None] = mapped_column(String(300))

    # ── Innovation métier sprint 6.h ────────────────────────────────────────
    # Code gravé : pour refabrication chez serrurier en cas de perte.
    code_grave: Mapped[str | None] = mapped_column(String(100))
    # Carte de sécurité brevetée (Mul-T-Lock / Kaba / Assa) :
    carte_securite: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    numero_carte_securite: Mapped[str | None] = mapped_column(String(100))

    bien: Mapped[Bien] = relationship("Bien", back_populates="keys")

    __table_args__ = (
        Index("ix_bien_keys_bien_id", "bien_id"),
        Index("ix_bien_keys_bien_type", "bien_id", "type"),
    )
