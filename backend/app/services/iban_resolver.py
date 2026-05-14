"""IBAN resolver — résolution canonique du compte bancaire d'un bien.

Source de vérité Phase 1.0 (Sprint 9 Lot A, 2026-05-14) :
La table `bank_accounts` est la SEULE source canonique des coordonnées
bancaires bailleur côté Althy. Les colonnes legacy `users.iban_legacy`
(physique DB, attribut Python `User.iban`) sont conservées pour
rétrocompatibilité mais ne doivent plus être lues en direct depuis
le code métier — utiliser ce resolver.

Cascade de résolution
─────────────────────
1. `Bien.iban_compte_id` IS NOT NULL → BankAccount FK direct.
   Cas : bailleur multi-régies qui veut un compte spécifique pour ce bien
   (ex. PPE bouclée sur compte caution séparé).
2. Sinon → BankAccount du propriétaire `owner_id` avec
   `est_principal = true` AND `is_active = true`. Garanti unique côté DB
   par le partial index `ix_bank_accounts_user_principal_unique`
   (migration 0036).
3. Sinon → None. L'appelant choisit le fallback (ex. `settings.ALTHY_QR_IBAN`
   pour les QR-factures collectées par Althy en Phase 1 MVP).

Doctrine §B.12 : lecture seule, pas de db.flush() / db.add() — pure query.
Doctrine §B.13 : sans rapport (pas de migration ici).
"""

from __future__ import annotations

import uuid

from app.models.bank_account import BankAccount
from app.models.bien import Bien
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


async def get_effective_iban(
    db: AsyncSession,
    bien_id: uuid.UUID,
) -> BankAccount | None:
    """Retourne le `BankAccount` à utiliser pour les flux financiers de ce bien.

    Cascade :
        bien.iban_compte_id  (FK directe — override par bien)
        ↳ bank_accounts WHERE user_id = bien.owner_id AND est_principal = true
        ↳ None

    Note : on charge le `Bien` minimal (`owner_id` + `iban_compte_id`) puis
    on effectue 1 ou 2 requêtes ciblées. Aucun side effect, aucun flush.
    """
    bien_row = (
        await db.execute(
            select(Bien.owner_id, Bien.iban_compte_id).where(Bien.id == bien_id)
        )
    ).one_or_none()
    if bien_row is None:
        return None

    owner_id, iban_compte_id = bien_row.owner_id, bien_row.iban_compte_id

    # ── 1. Override par bien ──────────────────────────────────────────────
    if iban_compte_id is not None:
        ba = (
            await db.execute(
                select(BankAccount).where(
                    BankAccount.id == iban_compte_id,
                    BankAccount.is_active.is_(True),
                )
            )
        ).scalar_one_or_none()
        if ba is not None:
            return ba
        # FK orpheline (ne devrait pas arriver grâce à ON DELETE SET NULL,
        # mais on retombe sur le compte principal du propriétaire au cas où).

    # ── 2. Compte principal du propriétaire ───────────────────────────────
    return (
        await db.execute(
            select(BankAccount).where(
                BankAccount.user_id == owner_id,
                BankAccount.est_principal.is_(True),
                BankAccount.is_active.is_(True),
            )
        )
    ).scalar_one_or_none()
