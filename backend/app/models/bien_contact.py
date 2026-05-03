"""Modèle SQLAlchemy — contacts externes liés à un bien (PR-A11.A.6.a).

`BienContact` représente un contact non-Althy lié au bien : régie tierce
qui gère, syndic PPE, concierge, garant locataire, voisin avec clés, etc.
NE remplace PAS la relation `User.locataire` ou `User.proprio` qui restent
des utilisateurs Althy authentifiés.
"""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from app.models.base import BaseModel
from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

if TYPE_CHECKING:
    from app.models.bien import Bien


class BienContact(BaseModel):
    """Contact externe (non-Althy) lié à un bien."""

    __tablename__ = "bien_contacts"

    bien_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("biens.id", ondelete="CASCADE"),
        nullable=False,
    )
    # role : regie_tierce / concierge / syndic / garant / voisin_cle /
    # proprietaire_voisin / autre  (validation Pydantic au Create/Update)
    role: Mapped[str] = mapped_column(String(30), nullable=False)
    nom: Mapped[str] = mapped_column(String(200), nullable=False)
    prenom: Mapped[str | None] = mapped_column(String(100))
    societe: Mapped[str | None] = mapped_column(String(200))
    email: Mapped[str | None] = mapped_column(String(255))
    telephone: Mapped[str | None] = mapped_column(String(30))
    adresse: Mapped[str | None] = mapped_column(String(300))
    notes: Mapped[str | None] = mapped_column(Text)

    bien: Mapped[Bien] = relationship("Bien", back_populates="contacts")

    __table_args__ = (
        Index("ix_bien_contacts_bien_id", "bien_id"),
        Index("ix_bien_contacts_bien_role", "bien_id", "role"),
    )
