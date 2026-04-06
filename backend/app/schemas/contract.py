from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

ContractType = Literal["long_term", "seasonal", "short_term", "sale"]
ContractStatus = Literal["draft", "active", "terminated", "expired"]


class ContractCreate(BaseModel):
    property_id: str
    tenant_id: str | None = None
    agency_id: str | None = None
    type: ContractType
    status: ContractStatus = "draft"
    start_date: datetime
    end_date: datetime | None = None
    monthly_rent: float | None = Field(None, ge=0)
    charges: float | None = Field(None, ge=0)
    deposit: float | None = Field(None, ge=0)


class ContractUpdate(BaseModel):
    tenant_id: str | None = None
    agency_id: str | None = None
    type: ContractType | None = None
    status: ContractStatus | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None
    monthly_rent: float | None = None
    charges: float | None = None
    deposit: float | None = None


class ContractRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    reference: str
    owner_id: str
    property_id: str
    tenant_id: str | None
    agency_id: str | None
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


class PaginatedContracts(BaseModel):
    items: list[ContractRead]
    total: int
    page: int
    size: int
    pages: int
