"""Partner service — routage leads + commissions mensuelles.

Architecture :
  router partners.py         ─┐
                               │
                               ├─► partner_service (ce module)
  flows métier (bail signé…) ─┘          │
                                         ├─ select_partner_for(vertical, region)
                                         ├─ send_lead_to_partner(user, vertical, data)
                                         ├─ calculate_monthly_commission
                                         └─ check_minimum_guarantee_met
                                              │
                                              ▼
                                  services/partners/* (adapters)

Contraintes :
  - RGPD : send_lead_to_partner refuse si pas de consentement explicite
    (type consents `partner_<vertical>`).
  - Chiffrement : api_key est déchiffrée juste avant l'appel adaptateur,
    jamais stockée en mémoire au-delà.
  - Stubs : aucun appel réseau tant que les adaptateurs restent en mode stub.
"""

from __future__ import annotations

import base64
import hashlib
import logging
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from app.core.config import settings
from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import case, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

# Import adaptateurs pour peupler le registre (side-effect register()).
from app.services.partners import (  # noqa: F401
    PartnerAdapter,
    adapters_for,
    get_adapter,
)
from app.services.partners import la_mobiliere, raiffeisen, swisscaution  # noqa: F401

from app.models.partner import Partner, PartnerCommission, PartnerDeal, PartnerLead

logger = logging.getLogger("althy.partners")


# ── Crypto : api_key_encrypted ────────────────────────────────────────────────


def _fernet() -> Fernet:
    """Dérive une clé Fernet depuis SECRET_KEY (32 bytes → urlsafe base64)."""
    digest = hashlib.sha256(settings.SECRET_KEY.encode("utf-8")).digest()
    key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


def encrypt_api_key(plaintext: str | None) -> str | None:
    if not plaintext:
        return None
    token = _fernet().encrypt(plaintext.encode("utf-8"))
    return token.decode("utf-8")


def decrypt_api_key(ciphertext: str | None) -> str | None:
    if not ciphertext:
        return None
    try:
        return _fernet().decrypt(ciphertext.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        logger.error("partners.decrypt_api_key: token invalide — SECRET_KEY a changé ?")
        return None


# ── RGPD : vérif consentement ────────────────────────────────────────────────


async def has_partner_consent(
    db: AsyncSession, user_id: uuid.UUID, vertical: str
) -> tuple[bool, uuid.UUID | None]:
    """Retourne (consenti, consent_id) — utilise la vue consents_latest."""
    consent_type = f"partner_{vertical}"
    row = (await db.execute(
        text("""
            select id, accepted
            from consents_latest
            where user_id = :uid and consent_type = :ctype
            limit 1
        """),
        {"uid": str(user_id), "ctype": consent_type},
    )).one_or_none()
    if not row or not row.accepted:
        return False, None
    return True, row.id


# ── Sélection partenaire ─────────────────────────────────────────────────────


async def select_partner_for(
    db: AsyncSession, vertical: str, region: str | None
) -> Partner | None:
    """Choisit le partenaire actif couvrant cette verticale/région.

    Priorité :
      1. partenaire actif avec exclusivity_region == region
      2. partenaire actif region == region
      3. partenaire actif national (region null)
    """
    q = select(Partner).where(
        Partner.vertical == vertical,
        Partner.status == "active",
    )
    rows = (await db.execute(q)).scalars().all()
    if not rows:
        return None

    if region:
        excl = next((p for p in rows if (p.exclusivity_region or "") == region), None)
        if excl:
            return excl
        regional = next((p for p in rows if (p.region or "") == region), None)
        if regional:
            return regional

    national = next((p for p in rows if not p.region), None)
    return national or rows[0]


# ── send_lead_to_partner ─────────────────────────────────────────────────────


class PartnerConsentRequired(Exception):
    """Raised when send_lead_to_partner is called without explicit RGPD consent."""


class NoPartnerAvailable(Exception):
    pass


async def send_lead_to_partner(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    vertical: str,
    lead_data: dict,
    region: str | None = None,
) -> PartnerLead:
    """Crée et envoie un lead au bon partenaire.

    Étapes :
      1. Vérifie consentement explicite `partner_<vertical>` (sinon raise).
      2. Sélectionne le partenaire adapté (region puis national).
      3. Crée la ligne partner_leads (status=sent).
      4. Appelle l'adaptateur si disponible (best-effort : les erreurs réseau
         n'annulent pas l'enregistrement DB, elles passent le statut à sent
         avec notes).
      5. Retourne le PartnerLead.
    """
    consented, consent_id = await has_partner_consent(db, user_id, vertical)
    if not consented:
        raise PartnerConsentRequired(
            f"Consentement `partner_{vertical}` manquant pour l'user {user_id}"
        )

    partner = await select_partner_for(db, vertical, region)
    if partner is None:
        raise NoPartnerAvailable(
            f"Aucun partenaire actif pour vertical={vertical} region={region}"
        )

    lead = PartnerLead(
        id=uuid.uuid4(),
        partner_id=partner.id,
        user_id=user_id,
        vertical=vertical,
        lead_data=lead_data,
        status="sent",
        sent_at=datetime.now(timezone.utc),
        consent_id=consent_id,
    )
    db.add(lead)
    await db.flush()

    # Appel adaptateur (stub par défaut). Les exceptions sont loggées —
    # le lead reste en DB pour audit.
    adapter = get_adapter(vertical, partner.name)
    if adapter is None:
        # Fallback : premier adaptateur enregistré pour cette verticale.
        candidates = adapters_for(vertical)
        adapter = candidates[0] if candidates else None

    if adapter is not None:
        try:
            result = await adapter.send_lead(
                lead_id=str(lead.id),
                user_payload=lead_data,
                api_base_url=partner.api_base_url,
                api_key=decrypt_api_key(partner.api_key_encrypted),
            )
            lead.external_reference = result.get("external_reference")
            lead.notes = result.get("message")
            if result.get("accepted") is False:
                lead.status = "rejected"
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "partners.send_lead adapter_error partner=%s vertical=%s err=%s",
                partner.name, vertical, exc,
            )
            lead.notes = f"adapter_error: {exc}"

    await db.commit()
    await db.refresh(lead)

    logger.info(
        "partners.lead_sent id=%s partner=%s vertical=%s user=%s",
        lead.id, partner.name, vertical, user_id,
    )
    return lead


# ── Commissions ──────────────────────────────────────────────────────────────


def _month_bounds(year: int, month: int) -> tuple[date, date]:
    start = date(year, month, 1)
    if month == 12:
        end = date(year + 1, 1, 1)
    else:
        end = date(year, month + 1, 1)
    return start, end


async def calculate_monthly_commission(
    db: AsyncSession,
    partner_id: uuid.UUID,
    year: int,
    month: int,
) -> dict:
    """Calcule la commission à facturer au partenaire pour ce mois.

    Formule :
      total = max(minimum_garanti, variable)
      variable = per_lead * total_leads + per_contract * total_signed + revshare * signed_amount
    """
    start, end = _month_bounds(year, month)

    # Deal actif sur la période (si chevauchement)
    deal = (await db.execute(
        select(PartnerDeal).where(
            PartnerDeal.partner_id == partner_id,
            PartnerDeal.status == "active",
            PartnerDeal.start_date < end,
            (PartnerDeal.end_date.is_(None)) | (PartnerDeal.end_date >= start),
        ).order_by(PartnerDeal.start_date.desc()).limit(1)
    )).scalar_one_or_none()

    # Compteurs leads
    leads_q = await db.execute(
        select(
            func.count(PartnerLead.id),
            func.sum(case((PartnerLead.status == "signed", 1), else_=0)),
            func.sum(
                case(
                    (PartnerLead.status == "signed", PartnerLead.commission_amount),
                    else_=0,
                )
            ),
        ).where(
            PartnerLead.partner_id == partner_id,
            PartnerLead.sent_at >= start,
            PartnerLead.sent_at < end,
        )
    )
    total_leads, total_signed, signed_amount = leads_q.one()
    total_leads = int(total_leads or 0)
    total_signed = int(total_signed or 0)
    signed_amount = Decimal(signed_amount or 0)

    variable = Decimal(0)
    min_guar = Decimal(0)
    if deal:
        if deal.per_lead_commission:
            variable += Decimal(deal.per_lead_commission) * total_leads
        if deal.per_contract_commission:
            variable += Decimal(deal.per_contract_commission) * total_signed
        if deal.revenue_share_percentage:
            variable += signed_amount * Decimal(deal.revenue_share_percentage) / Decimal(100)
        min_guar = Decimal(deal.min_monthly_guarantee or 0)

    total = max(min_guar, variable)

    return {
        "period_start": start,
        "period_end": end,
        "total_leads": total_leads,
        "total_signed": total_signed,
        "minimum_guarantee_amount": min_guar,
        "variable_commission_amount": variable,
        "total_amount": total,
        "deal_id": str(deal.id) if deal else None,
    }


async def check_minimum_guarantee_met(
    db: AsyncSession,
    partner_id: uuid.UUID,
    year: int,
    month: int,
) -> bool:
    """True si le variable >= minimum garanti sur le mois."""
    res = await calculate_monthly_commission(db, partner_id, year, month)
    return res["variable_commission_amount"] >= res["minimum_guarantee_amount"]


async def upsert_monthly_commission(
    db: AsyncSession,
    partner_id: uuid.UUID,
    year: int,
    month: int,
) -> PartnerCommission:
    """Persiste (ou met à jour) la commission calculée pour le mois."""
    res = await calculate_monthly_commission(db, partner_id, year, month)

    existing = (await db.execute(
        select(PartnerCommission).where(
            PartnerCommission.partner_id == partner_id,
            PartnerCommission.period_start == res["period_start"],
            PartnerCommission.period_end == res["period_end"],
        )
    )).scalar_one_or_none()

    if existing:
        existing.total_leads = res["total_leads"]
        existing.total_signed = res["total_signed"]
        existing.minimum_guarantee_amount = res["minimum_guarantee_amount"]
        existing.variable_commission_amount = res["variable_commission_amount"]
        existing.total_amount = res["total_amount"]
        await db.commit()
        await db.refresh(existing)
        return existing

    row = PartnerCommission(
        id=uuid.uuid4(),
        partner_id=partner_id,
        period_start=res["period_start"],
        period_end=res["period_end"],
        total_leads=res["total_leads"],
        total_signed=res["total_signed"],
        minimum_guarantee_amount=res["minimum_guarantee_amount"],
        variable_commission_amount=res["variable_commission_amount"],
        total_amount=res["total_amount"],
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row
