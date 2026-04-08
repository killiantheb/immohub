"""Schémas Pydantic v2 — paiements."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, field_validator


class PaiementBase(BaseModel):
    locataire_id: uuid.UUID
    bien_id: uuid.UUID
    mois: str  # YYYY-MM
    montant: Decimal
    date_echeance: date
    date_paiement: Optional[date] = None
    statut: Literal["recu", "en_attente", "retard"] = "en_attente"
    jours_retard: int = 0

    @field_validator("mois")
    @classmethod
    def validate_mois(cls, v: str) -> str:
        import re
        if not re.match(r"^\d{4}-\d{2}$", v):
            raise ValueError("mois doit être au format YYYY-MM")
        return v


class PaiementCreate(PaiementBase):
    pass


class PaiementUpdate(BaseModel):
    date_paiement: Optional[date] = None
    statut: Optional[Literal["recu", "en_attente", "retard"]] = None
    jours_retard: Optional[int] = None
    montant: Optional[Decimal] = None


class PaiementRead(PaiementBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
