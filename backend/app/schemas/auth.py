from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, computed_field

# ── Requests ──────────────────────────────────────────────────────────────────


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    phone: str | None = Field(None, max_length=20)
    role: Literal["owner", "tenant", "agency", "opener", "company"] = "owner"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class UpdateProfileRequest(BaseModel):
    first_name: str | None = Field(None, min_length=1, max_length=100)
    last_name: str | None = Field(None, min_length=1, max_length=100)
    phone: str | None = Field(None, max_length=20)
    avatar_url: str | None = None
    adresse: str | None = Field(None, max_length=300)
    langue: str | None = Field(None, max_length=5)
    # Coordonnées bancaires
    iban: str | None = Field(None, max_length=34)
    bic: str | None = Field(None, max_length=11)
    bank_account_holder: str | None = Field(None, max_length=200)
    # Notification channels
    notif_email: bool | None = None
    notif_sms: bool | None = None
    notif_push: bool | None = None
    notif_inapp: bool | None = None
    # Notification events
    notif_nouvelle_mission: bool | None = None
    notif_devis_accepte: bool | None = None
    notif_devis_refuse: bool | None = None
    notif_mission_urgente: bool | None = None
    notif_rappel_j1: bool | None = None
    notif_rappel_2h: bool | None = None
    notif_facture_impayee: bool | None = None
    notif_paiement_recu: bool | None = None


# ── Responses ─────────────────────────────────────────────────────────────────


class UserProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    role: str
    first_name: str | None
    last_name: str | None
    phone: str | None
    avatar_url: str | None
    is_verified: bool
    is_active: bool
    created_at: datetime
    adresse: str | None = None
    langue: str | None = None
    # Coordonnées bancaires
    iban: str | None = None
    bic: str | None = None
    bank_account_holder: str | None = None
    # Quota IA
    monthly_ai_tokens_used: int = 0
    # Notifications — channels
    notif_email: bool = True
    notif_sms: bool = False
    notif_push: bool = True
    notif_inapp: bool = True
    # Notifications — events
    notif_nouvelle_mission: bool = True
    notif_devis_accepte: bool = True
    notif_devis_refuse: bool = True
    notif_mission_urgente: bool = True
    notif_rappel_j1: bool = True
    notif_rappel_2h: bool = True
    notif_facture_impayee: bool = True
    notif_paiement_recu: bool = True

    @computed_field
    @property
    def full_name(self) -> str:
        parts = [self.first_name, self.last_name]
        return " ".join(p for p in parts if p) or self.email

    @computed_field
    @property
    def permissions(self) -> list[str]:
        base = ["properties:read", "contracts:read", "transactions:read"]
        role_perms: dict[str, list[str]] = {
            "super_admin": ["*"],
            "agency": [
                *base,
                "properties:write",
                "properties:delete",
                "contracts:write",
                "transactions:write",
                "openers:manage",
                "companies:manage",
            ],
            "owner": [
                *base,
                "properties:write",
                "contracts:write",
                "transactions:write",
            ],
            "tenant": base,
            "opener": [*base, "missions:write"],
            "company": [*base, "quotes:write"],
        }
        return role_perms.get(self.role, base)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class AuthResponse(BaseModel):
    token: TokenResponse
    user: UserProfileResponse
