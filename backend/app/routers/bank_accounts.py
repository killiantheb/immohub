"""Router FastAPI — /api/v1/users/me/bank-accounts (PR-A11.A.6.b).

CRUD pour les comptes bancaires de l'utilisateur authentifié. Toutes les
routes sont scoped au `current_user` (l'utilisateur ne voit / n'édite que
ses propres comptes).

Logique métier `est_principal` unique par user : enforced à la fois
service-side (bascule des autres principaux à false avant set) et
DB-side (unique partial index, migration 0035).
"""

from __future__ import annotations

import uuid
from typing import Annotated

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.bien import (
    BankAccountCreate,
    BankAccountRead,
    BankAccountUpdate,
)
from app.services.bank_account_service import BankAccountService
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

DbDep = Annotated[AsyncSession, Depends(get_db)]
AuthDep = Annotated[User, Depends(get_current_user)]


@router.get(
    "/me/bank-accounts",
    response_model=list[BankAccountRead],
)
async def list_bank_accounts(
    current_user: AuthDep,
    db: DbDep,
) -> list[BankAccountRead]:
    rows = await BankAccountService(db).list_for_user(current_user)
    return [BankAccountRead.model_validate(r) for r in rows]


@router.post(
    "/me/bank-accounts",
    response_model=BankAccountRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_bank_account(
    payload: BankAccountCreate,
    current_user: AuthDep,
    db: DbDep,
) -> BankAccountRead:
    account = await BankAccountService(db).create(payload, current_user)
    return BankAccountRead.model_validate(account)


@router.patch(
    "/me/bank-accounts/{account_id}",
    response_model=BankAccountRead,
)
async def update_bank_account(
    account_id: uuid.UUID,
    payload: BankAccountUpdate,
    current_user: AuthDep,
    db: DbDep,
) -> BankAccountRead:
    account = await BankAccountService(db).update(account_id, payload, current_user)
    if account is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Compte introuvable")
    return BankAccountRead.model_validate(account)


@router.delete(
    "/me/bank-accounts/{account_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
)
async def delete_bank_account(
    account_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> None:
    ok = await BankAccountService(db).delete(account_id, current_user)
    if not ok:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Compte introuvable")
