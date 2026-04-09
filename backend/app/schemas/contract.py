from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

ContractType = Literal["long_term", "seasonal", "short_term", "sale"]
ContractStatus = Literal["draft", "active", "terminated", "expired"]


class ContractCreate(BaseModel):
    property_id: uuid.UUID
    tenant_id: uuid.UUID | None = None
    agency_id: uuid.UUID | None = None
    type: ContractType
    status: ContractStatus = "draft"
    start_date: datetime
    end_date: datetime | None = None
    monthly_rent: float | None = Field(None, ge=0)
    charges: float | None = Field(None, ge=0)
    deposit: float | None = Field(None, ge=0)
    # Extended fields
    is_furnished: bool = False
    payment_day: int = 5
    notice_period_months: int = 3
    tourist_tax_amount: float | None = None
    cleaning_fee_hourly: float = 42
    linen_fee_included: bool = False
    deposit_type: str = "gocaution"
    subletting_allowed: bool = False
    animals_allowed: bool = False
    smoking_allowed: bool = False
    is_for_sale: bool = False
    signed_at_city: str | None = None
    canton: str = "VS"
    bank_name: str | None = None
    bank_iban: str | None = None
    bank_bic: str | None = None
    occupants_count: int | None = None
    tenant_nationality: str | None = None
    payment_communication: str | None = None


class ContractUpdate(BaseModel):
    tenant_id: uuid.UUID | None = None
    agency_id: uuid.UUID | None = None
    type: ContractType | None = None
    status: ContractStatus | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None
    monthly_rent: float | None = None
    charges: float | None = None
    deposit: float | None = None
    # Extended fields
    is_furnished: bool | None = None
    payment_day: int | None = None
    notice_period_months: int | None = None
    tourist_tax_amount: float | None = None
    cleaning_fee_hourly: float | None = None
    linen_fee_included: bool | None = None
    deposit_type: str | None = None
    subletting_allowed: bool | None = None
    animals_allowed: bool | None = None
    smoking_allowed: bool | None = None
    is_for_sale: bool | None = None
    signed_at_city: str | None = None
    canton: str | None = None
    bank_name: str | None = None
    bank_iban: str | None = None
    bank_bic: str | None = None
    occupants_count: int | None = None
    tenant_nationality: str | None = None
    payment_communication: str | None = None


class ContractRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    reference: str
    owner_id: uuid.UUID
    property_id: uuid.UUID
    tenant_id: uuid.UUID | None
    agency_id: uuid.UUID | None
    type: str
    status: str
    start_date: datetime
    end_date: datetime | None
    monthly_rent: float | None
    charges: float | None
    deposit: float | None
    signed_at: datetime | None
    signed_ip: str | None
    terminated_at: datetime | None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    # Extended fields
    is_furnished: bool = False
    payment_day: int = 5
    notice_period_months: int = 3
    tourist_tax_amount: float | None = None
    cleaning_fee_hourly: float = 42
    linen_fee_included: bool = False
    deposit_type: str = "gocaution"
    subletting_allowed: bool = False
    animals_allowed: bool = False
    smoking_allowed: bool = False
    is_for_sale: bool = False
    signed_at_city: str | None = None
    canton: str = "VS"
    bank_name: str | None = None
    bank_iban: str | None = None
    bank_bic: str | None = None
    occupants_count: int | None = None
    tenant_nationality: str | None = None
    payment_communication: str | None = None


class PaginatedContracts(BaseModel):
    items: list[ContractRead]
    total: int
    page: int
    size: int
    pages: int
