"""Service métier — comptes bancaires utilisateur (PR-A11.A.6.b).

Particularité métier : `est_principal=true` est unique par user. Lors
d'un set principal, on bascule tous les autres comptes du user à
`est_principal=false` dans la même transaction (pattern aligné sur
`BienService.add_image` qui bascule `is_cover` sur les autres images).

Cette logique service-side est **doublée** d'une contrainte DB unique
partial index `ix_bank_accounts_user_principal_unique` (migration 0035) :
si un bug futur tentait d'insérer 2 principaux pour un même user, la DB
rejetterait avec une `IntegrityError`. Le service prévient ce cas en
amont.
"""

from __future__ import annotations

import uuid

from app.models.bank_account import BankAccount
from app.models.user import User
from app.schemas.bien import BankAccountCreate, BankAccountUpdate
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


class BankAccountService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_for_user(self, current_user: User) -> list[BankAccount]:
        rows = await self.db.execute(
            select(BankAccount)
            .where(
                BankAccount.user_id == current_user.id,
                BankAccount.is_active.is_(True),
            )
            .order_by(
                BankAccount.est_principal.desc(),  # principal en haut
                BankAccount.created_at,
            )
        )
        return list(rows.scalars())

    async def create(self, payload: BankAccountCreate, current_user: User) -> BankAccount:
        if payload.est_principal:
            await self._unset_other_principals(current_user.id, exclude_id=None)

        account = BankAccount(user_id=current_user.id, **payload.model_dump())
        self.db.add(account)
        await self.db.flush()
        await self.db.refresh(account)
        return account

    async def update(
        self,
        account_id: uuid.UUID,
        payload: BankAccountUpdate,
        current_user: User,
    ) -> BankAccount | None:
        account = await self._get(account_id, current_user.id)
        if account is None:
            return None

        data = payload.model_dump(exclude_unset=True)

        # Bascule des autres principaux AVANT d'appliquer le True sur la
        # cible — sinon la contrainte unique partial peut rejeter au flush.
        if data.get("est_principal") is True:
            await self._unset_other_principals(current_user.id, exclude_id=account.id)

        for field, value in data.items():
            setattr(account, field, value)
        await self.db.flush()
        await self.db.refresh(account)
        return account

    async def delete(self, account_id: uuid.UUID, current_user: User) -> bool:
        """Soft delete (`is_active=False`)."""
        account = await self._get(account_id, current_user.id)
        if account is None:
            return False
        # Si le compte supprimé était principal, l'utilisateur perd son
        # principal — pas de bascule auto vers un autre compte (decision P1
        # — l'UI demandera explicitement de désigner le nouveau principal).
        account.is_active = False
        await self.db.flush()
        return True

    async def _unset_other_principals(
        self, user_id: uuid.UUID, exclude_id: uuid.UUID | None
    ) -> None:
        q = select(BankAccount).where(
            BankAccount.user_id == user_id,
            BankAccount.is_active.is_(True),
            BankAccount.est_principal.is_(True),
        )
        if exclude_id is not None:
            q = q.where(BankAccount.id != exclude_id)
        rows = (await self.db.execute(q)).scalars().all()
        for other in rows:
            other.est_principal = False
        # Un flush explicite ici garantit que le UPDATE est envoyé au
        # backend AVANT le SET sur la cible (évite que la contrainte
        # unique partial voie 2 lignes principal=true en même temps).
        if rows:
            await self.db.flush()

    async def _get(self, account_id: uuid.UUID, user_id: uuid.UUID) -> BankAccount | None:
        row = await self.db.execute(
            select(BankAccount).where(
                BankAccount.id == account_id,
                BankAccount.user_id == user_id,
                BankAccount.is_active.is_(True),
            )
        )
        return row.scalar_one_or_none()
