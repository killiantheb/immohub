import uuid
from datetime import datetime

from app.models.base import BaseModel
from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

AutonomyStatus = Enum(
    "active",
    "paused",
    "cancelled",
    name="autonomy_status_enum",
)


class AutonomySubscription(BaseModel):
    """
    Althy Autonomie (A4) — CHF 39/mois pivot stratégique.
    Permet aux propriétaires de quitter leur agence tout en restant autonomes
    grâce aux outils Althy + 4 vérifications locataires + 4 missions ouvreur
    + assistance juridique + partenariat assurance incluses par an.
    """

    __tablename__ = "autonomy_subscriptions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )

    stripe_subscription_id: Mapped[str | None] = mapped_column(String(255))

    status: Mapped[str] = mapped_column(
        AutonomyStatus, nullable=False, default="active", server_default="active"
    )

    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancellation_reason: Mapped[str | None] = mapped_column(Text)

    previous_agency_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )

    included_verifications_used_this_year: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    included_opener_missions_used_this_year: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )

    legal_assistance_included: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    insurance_partner_id: Mapped[str | None] = mapped_column(String(255))

    __table_args__ = (
        Index("ix_autonomy_subscriptions_user_id", "user_id"),
        Index("ix_autonomy_subscriptions_status", "status"),
        Index(
            "ix_autonomy_subscriptions_stripe_subscription_id",
            "stripe_subscription_id",
        ),
    )
