"""Partner hooks — déclenchement best-effort de leads partenaires depuis les flows métier.

Chaque hook :
  - est async et prend db + les objets métier concernés
  - vérifie le consentement RGPD (partner_<vertical>) via send_lead_to_partner
  - log les erreurs mais ne les remonte jamais (best-effort)
  - PostHog : évènement `partner_lead_sent` (geré plus haut dans le router appelant)

4 hooks actifs :
  P1 on_contract_signed      → insurance (La Mobilière)
  P2 on_candidature_no_caution → caution (SwissCaution)
  P3 on_signup_buy_intent    → mortgage (Raiffeisen)
  P4 on_contract_ended       → moving

Les hooks sont des no-op si :
  - l'user n'a pas consenti (PartnerConsentRequired)
  - aucun partenaire actif pour la verticale/région (NoPartnerAvailable)
"""

from __future__ import annotations

import logging
import uuid
from typing import TYPE_CHECKING

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.partner_service import (
    NoPartnerAvailable,
    PartnerConsentRequired,
    send_lead_to_partner,
)

if TYPE_CHECKING:
    from app.models.contract import Contract

logger = logging.getLogger("althy.partners.hooks")


async def _safe_send(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    vertical: str,
    lead_data: dict,
    region: str | None = None,
    context: str = "",
) -> None:
    try:
        lead = await send_lead_to_partner(
            db,
            user_id=user_id,
            vertical=vertical,
            lead_data=lead_data,
            region=region,
        )
        logger.info("hook.lead_sent context=%s vertical=%s lead_id=%s", context, vertical, lead.id)
    except PartnerConsentRequired:
        logger.debug("hook.skipped_no_consent context=%s vertical=%s user=%s", context, vertical, user_id)
    except NoPartnerAvailable:
        logger.debug("hook.skipped_no_partner context=%s vertical=%s region=%s", context, vertical, region)
    except Exception as exc:  # noqa: BLE001
        logger.warning("hook.error context=%s vertical=%s err=%s", context, vertical, exc)


# ── P1 : bail signé → assurance ──────────────────────────────────────────────


async def on_contract_signed(db: AsyncSession, contract: "Contract") -> None:
    """P1 : propose couverture assurance au propriétaire juste après signature du bail.

    Le consentement doit avoir été donné AVANT la signature (checkbox RGPD).
    """
    if not contract or not contract.owner_id:
        return
    lead_data = {
        "contract_id": str(contract.id),
        "contract_reference": contract.reference,
        "property_id": str(contract.property_id),
        "monthly_rent": float(contract.monthly_rent or 0),
        "canton": contract.canton,
        "start_date": contract.start_date.isoformat() if contract.start_date else None,
    }
    await _safe_send(
        db,
        user_id=contract.owner_id,
        vertical="insurance",
        lead_data=lead_data,
        region=contract.canton,
        context="contract_signed",
    )


# ── P2 : candidature sans caution → SwissCaution ─────────────────────────────


async def on_candidature_no_caution(
    db: AsyncSession,
    *,
    tenant_id: uuid.UUID,
    listing_id: uuid.UUID | None,
    monthly_rent: float | None,
    canton: str | None,
) -> None:
    """P2 : locataire postule sans garantie bancaire → proposer SwissCaution.

    À appeler depuis POST /marketplace/candidature quand le tenant n'a pas
    de dépôt pré-configuré.
    """
    await _safe_send(
        db,
        user_id=tenant_id,
        vertical="caution",
        lead_data={
            "listing_id": str(listing_id) if listing_id else None,
            "monthly_rent": float(monthly_rent or 0),
            "canton": canton,
        },
        region=canton,
        context="candidature_no_caution",
    )


# ── P3 : signup avec intention d'achat → hypothèque ──────────────────────────


async def on_signup_buy_intent(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    canton: str | None,
    price_range: tuple[int, int] | None = None,
) -> None:
    """P3 : user s'inscrit comme acheteur_premium ou déclare une intention
    d'achat dans l'onboarding → lead Raiffeisen."""
    await _safe_send(
        db,
        user_id=user_id,
        vertical="mortgage",
        lead_data={
            "canton": canton,
            "price_range_chf": list(price_range) if price_range else None,
        },
        region=canton,
        context="signup_buy_intent",
    )


# ── P4 : bail terminé → déménageur ───────────────────────────────────────────


async def on_contract_ended(db: AsyncSession, contract: "Contract") -> None:
    """P4 : bail qui se termine → proposer déménageur au locataire."""
    if not contract or not contract.tenant_id:
        return
    await _safe_send(
        db,
        user_id=contract.tenant_id,
        vertical="moving",
        lead_data={
            "contract_id": str(contract.id),
            "end_date": contract.end_date.isoformat() if contract.end_date else None,
            "canton": contract.canton,
        },
        region=contract.canton,
        context="contract_ended",
    )
