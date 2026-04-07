import uuid

from app.models.company import Company
from app.schemas.company import CompanyCreate, CompanyUpdate
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


class CompanyService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list(self, owner_id: str, page: int = 1, size: int = 20) -> list[Company]:
        offset = (page - 1) * size
        result = await self.db.execute(
            select(Company)
            .where(Company.owner_id == owner_id)
            .order_by(Company.created_at.desc())
            .offset(offset)
            .limit(size)
        )
        return list(result.scalars().all())

    async def get(self, company_id: str, owner_id: str) -> Company | None:
        result = await self.db.execute(
            select(Company).where(
                Company.id == company_id,
                Company.owner_id == owner_id,
            )
        )
        return result.scalar_one_or_none()

    async def create(self, payload: CompanyCreate, owner_id: str) -> Company:
        company = Company(
            id=str(uuid.uuid4()),
            owner_id=owner_id,
            **payload.model_dump(),
        )
        self.db.add(company)
        await self.db.flush()
        await self.db.refresh(company)
        return company

    async def update(
        self, company_id: str, payload: CompanyUpdate, owner_id: str
    ) -> Company | None:
        company = await self.get(company_id, owner_id)
        if not company:
            return None
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(company, field, value)
        await self.db.flush()
        await self.db.refresh(company)
        return company
