from __future__ import annotations

from typing import Annotated

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.contract import ContractCreate, ContractRead, ContractUpdate, PaginatedContracts
from app.services.contract_service import ContractService
from app.services.partner_hooks import on_contract_signed
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

DbDep = Annotated[AsyncSession, Depends(get_db)]
AuthUserDep = Annotated[User, Depends(get_current_user)]


@router.get("", response_model=PaginatedContracts)
async def list_contracts(
    current_user: AuthUserDep,
    db: DbDep,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    status: str | None = Query(None),
    property_id: str | None = Query(None),
    tenant_id: str | None = Query(None),
) -> PaginatedContracts:
    return await ContractService(db).list(
        current_user=current_user,
        page=page,
        size=size,
        contract_status=status,
        property_id=property_id,
        tenant_id=tenant_id,
    )


@router.post("", response_model=ContractRead, status_code=status.HTTP_201_CREATED)
async def create_contract(
    payload: ContractCreate,
    current_user: AuthUserDep,
    db: DbDep,
) -> ContractRead:
    if current_user.role not in ("proprio_solo", "agence", "super_admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")
    contract = await ContractService(db).create(payload, current_user=current_user)
    return ContractRead.model_validate(contract)


@router.get("/{contract_id}", response_model=ContractRead)
async def get_contract(
    contract_id: str,
    current_user: AuthUserDep,
    db: DbDep,
) -> ContractRead:
    contract = await ContractService(db).get(contract_id, current_user=current_user)
    if contract is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Contrat introuvable")
    return ContractRead.model_validate(contract)


@router.put("/{contract_id}", response_model=ContractRead)
async def update_contract(
    contract_id: str,
    payload: ContractUpdate,
    current_user: AuthUserDep,
    db: DbDep,
) -> ContractRead:
    contract = await ContractService(db).update(contract_id, payload, current_user=current_user)
    return ContractRead.model_validate(contract)


@router.delete("/{contract_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_contract(
    contract_id: str,
    current_user: AuthUserDep,
    db: DbDep,
):
    await ContractService(db).delete(contract_id, current_user=current_user)


@router.post("/{contract_id}/sign", response_model=ContractRead)
async def sign_contract(
    contract_id: str,
    request: Request,
    current_user: AuthUserDep,
    db: DbDep,
) -> ContractRead:
    """Digital signature: records timestamp and client IP."""
    client_ip = request.client.host if request.client else "unknown"
    # Respect X-Forwarded-For if behind a proxy
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        client_ip = forwarded.split(",")[0].strip()
    contract = await ContractService(db).sign(contract_id, ip=client_ip, current_user=current_user)
    # Partner hook P1 : propose assurance au propriétaire (best-effort, RGPD-gated).
    await on_contract_signed(db, contract)
    return ContractRead.model_validate(contract)


@router.get("/{contract_id}/pdf")
async def get_contract_pdf(
    contract_id: str,
    current_user: AuthUserDep,
    db: DbDep,
):
    """Generate and stream the contract as a PDF."""
    return await ContractService(db).generate_pdf(contract_id, current_user=current_user)
