import uuid

from app.models.base import BaseModel
from sqlalchemy import Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column


class OnboardingScan(BaseModel):
    """
    Résultats d'un scan automatique post-inscription.
    Stocke tout ce que scanner_tout() a trouvé, en attente de validation
    par l'utilisateur dans l'onboarding.
    """
    __tablename__ = "onboarding_scans"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True,
    )

    # "pending_review" | "reviewed" | "imported" | "skipped"
    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="pending_review",
        server_default="pending_review",
    )

    # JSON sérialisé — liste de dicts (ElementTrouve)
    elements_trouves: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="[]",
        server_default="'[]'",
    )

    nb_elements: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )

    # Contexte utilisé pour le scan (agence_nom, ville, site_web…)
    contexte_scan: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (
        Index("ix_onboarding_scans_user_id", "user_id"),
        Index("ix_onboarding_scans_status", "status"),
    )
