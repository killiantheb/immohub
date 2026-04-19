from __future__ import annotations

from datetime import datetime

from app.models.base import BaseModel
from sqlalchemy import Boolean, DateTime, Enum, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

UserRole = Enum(
    "proprio_solo",
    "agence",
    "portail_proprio",
    "opener",
    "artisan",
    "expert",
    "hunter",
    "locataire",
    "acheteur_premium",
    "super_admin",
    name="user_role_enum",
)


class User(BaseModel):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    hashed_password: Mapped[str | None] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(UserRole, nullable=False, default="proprio_solo")
    first_name: Mapped[str | None] = mapped_column(String(100))
    last_name: Mapped[str | None] = mapped_column(String(100))
    phone: Mapped[str | None] = mapped_column(String(20))
    avatar_url: Mapped[str | None] = mapped_column(Text)
    is_verified: Mapped[bool] = mapped_column(nullable=False, default=False, server_default="false")
    supabase_uid: Mapped[str | None] = mapped_column(String(36), unique=True)

    # ── Coordonnées bancaires ─────────────────────────────────────────────────
    iban: Mapped[str | None] = mapped_column(String(34))
    bic: Mapped[str | None] = mapped_column(String(11))
    bank_account_holder: Mapped[str | None] = mapped_column(String(200))

    # ── Profil personnel ──────────────────────────────────────────────────────
    adresse: Mapped[str | None] = mapped_column(String(300))
    langue: Mapped[str | None] = mapped_column(String(5), default="fr", server_default="fr")

    # ── Quota IA mensuel ──────────────────────────────────────────────────────
    monthly_ai_tokens_used: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    monthly_ai_reset_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # ── Notification channels ─────────────────────────────────────────────────
    notif_email:  Mapped[bool] = mapped_column(Boolean, nullable=False, default=True,  server_default="true")
    notif_sms:    Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    notif_push:   Mapped[bool] = mapped_column(Boolean, nullable=False, default=True,  server_default="true")
    notif_inapp:  Mapped[bool] = mapped_column(Boolean, nullable=False, default=True,  server_default="true")

    # ── Notification events ───────────────────────────────────────────────────
    notif_nouvelle_mission:  Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    notif_devis_accepte:     Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    notif_devis_refuse:      Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    notif_mission_urgente:   Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    notif_rappel_j1:         Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    notif_rappel_2h:         Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    notif_facture_impayee:   Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    notif_paiement_recu:     Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")

    __table_args__ = (
        Index("ix_users_email", "email"),
        Index("ix_users_role", "role"),
        Index("ix_users_supabase_uid", "supabase_uid"),
    )
