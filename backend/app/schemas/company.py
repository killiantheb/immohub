from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

CompanyStatus = Literal["active", "inactive"]


class CompanyBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    siret: str | None = Field(None, min_length=14, max_length=14)
    vat_number: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    address: str | None = None
    city: str | None = None
    zip_code: str | None = None
    country: str = Field(default="FR", min_length=2, max_length=2)
    status: CompanyStatus = "active"


class CompanyCreate(CompanyBase):
    pass


class CompanyUpdate(BaseModel):
    name: str | None = None
    siret: str | None = None
    vat_number: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    address: str | None = None
    city: str | None = None
    zip_code: str | None = None
    country: str | None = None
    status: CompanyStatus | None = None


class CompanyRead(CompanyBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    owner_id: str
    created_at: datetime
    updated_at: datetime
