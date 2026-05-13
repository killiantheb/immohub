"""Hook d'activation loyer post-contre-signature locataire (Sprint 8 Lot A).

Quand le locataire contre-signe un bail (POST /contracts/{id}/countersign),
on doit :
  1. Lier physiquement `locataires.current_contract_id` → Contract (FK 0049).
  2. Créer la 1re `loyer_transaction` pour le mois en cours (si le bail
     commence aujourd'hui ou avant) ou pour le mois de la date d'entrée
     (si bail futur).

Doctrine §B.12 : on opère dans la même session que l'endpoint appelant —
pas de `AsyncSessionLocal()` isolée car le rollback doit cascader si la
contre-signature échoue plus tard dans le pipeline.

Doctrine §B.15 : Phase 1.0 = paiement direct bailleur, **pas de commission
Stripe Connect** (`commission_pct = 0`, `commission_montant = 0`). Les
colonnes sont conservées en DB pour compat schema legacy (migration 0047
§B.13) mais restent à zéro tant qu'on n'active pas le compte de transit
Althy en Phase 2.

Doctrine §B.11 : pas de fausses données. Si on ne peut pas déterminer un
montant de loyer cohérent (ni `Contract.monthly_rent` ni `Bien.loyer`),
on n'invente pas — on log + on retourne `None` sans créer de transaction
fantaisiste. Le bailleur génèrera la 1re QR-facture manuellement via UI.

Idempotence : un UNIQUE INDEX `uq_loyer_transactions_bien_mois`
(migration 0047) garantit qu'on ne peut pas créer deux transactions pour
le même (bien_id, mois_concerne). On vérifie en amont pour éviter un
IntegrityError → le hook reste "best-effort visible" côté caller.
"""

from __future__ import annotations

import logging
from datetime import UTC, date, datetime
from decimal import Decimal

from app.models.bien import Bien
from app.models.contract import Contract
from app.models.locataire import Locataire
from app.models.loyer_transaction import LoyerTransaction
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


def _resolve_mois_concerne(contract: Contract) -> date:
    """Premier 1er du mois ≥ aujourd'hui à facturer.

    - Bail en cours (start_date <= today) : mois en cours.
    - Bail futur (start_date > today)     : mois d'entrée.
    """
    today = datetime.now(UTC).date()
    if contract.start_date is None:
        return today.replace(day=1)
    start = contract.start_date.date() if isinstance(contract.start_date, datetime) else contract.start_date
    pivot = start if start > today else today
    return pivot.replace(day=1)


async def activate_first_rent(
    db: AsyncSession, contract: Contract
) -> LoyerTransaction | None:
    """Lie Locataire ↔ Contract puis crée la 1re loyer_transaction.

    Retourne la transaction créée, ou `None` si :
      - le contract n'a pas de bien_id / tenant_id,
      - aucun Locataire actif n'est rattaché au user + bien du contrat,
      - le bien n'a pas de loyer cohérent (§B.11),
      - une transaction existe déjà pour ce (bien, mois) — idempotent.
    """
    if not contract.bien_id or not contract.tenant_id:
        logger.info(
            "loyer_activation.skip contract=%s reason=missing_bien_or_tenant",
            contract.id,
        )
        return None

    bien = await db.get(Bien, contract.bien_id)
    if bien is None:
        logger.warning(
            "loyer_activation.skip contract=%s reason=bien_not_found bien_id=%s",
            contract.id, contract.bien_id,
        )
        return None

    # Locataire actif lié à ce user sur ce bien (Contract.tenant_id → users.id).
    locataire = (
        await db.execute(
            select(Locataire).where(
                Locataire.user_id == contract.tenant_id,
                Locataire.bien_id == contract.bien_id,
                Locataire.statut == "actif",
            )
        )
    ).scalar_one_or_none()
    if locataire is None:
        logger.info(
            "loyer_activation.skip contract=%s reason=no_active_locataire",
            contract.id,
        )
        return None

    # Lien physique Locataire ↔ Contract (FK 0049).
    locataire.current_contract_id = contract.id

    mois_concerne = _resolve_mois_concerne(contract)

    # Idempotence applicative en amont du UNIQUE INDEX
    # uq_loyer_transactions_bien_mois (migration 0047).
    already = await db.scalar(
        select(LoyerTransaction.id).where(
            LoyerTransaction.bien_id == contract.bien_id,
            LoyerTransaction.mois_concerne == mois_concerne,
        )
    )
    if already is not None:
        logger.info(
            "loyer_activation.skip contract=%s reason=already_exists mois=%s",
            contract.id, mois_concerne,
        )
        return None

    raw_amount = contract.monthly_rent if contract.monthly_rent is not None else bien.loyer
    if raw_amount is None or float(raw_amount) <= 0:
        logger.info(
            "loyer_activation.skip contract=%s reason=no_rent_amount",
            contract.id,
        )
        return None
    montant_total = Decimal(str(raw_amount))

    tx = LoyerTransaction(
        bien_id=contract.bien_id,
        tenant_id=locataire.id,
        owner_id=contract.owner_id,
        montant_total=montant_total,
        commission_pct=Decimal("0"),
        commission_montant=Decimal("0"),
        statut="en_attente",
        mois_concerne=mois_concerne,
    )
    db.add(tx)
    await db.flush()
    logger.info(
        "loyer_activation.created contract=%s tx=%s mois=%s montant=%s",
        contract.id, tx.id, mois_concerne, montant_total,
    )
    return tx
