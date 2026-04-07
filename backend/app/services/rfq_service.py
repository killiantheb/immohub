"""
RFQ Service — marketplace appels d'offres.

Features
--------
- qualify_need        : IA classe le besoin et suggère titre/urgence
- select_companies    : 3-5 meilleures entreprises selon catégorie/zone/rating
- calculate_commission: 10% du montant accepté
- notify_companies    : stub notification (log)
- Full RFQ lifecycle  : create → publish → submit_quote → accept → complete → rate
"""

from __future__ import annotations

import json
import math
import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from app.models.company import Company
from app.models.rfq import RFQ, RFQQuote
from app.schemas.rfq import (
    AIQualifyResponse,
    CompanyMarketplaceRead,
    PaginatedRFQs,
    RFQCreate,
    RFQQuoteCreate,
    RFQQuoteRead,
    RFQRating,
    RFQRead,
)
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

if TYPE_CHECKING:
    from app.models.user import User

COMMISSION_PCT = 0.10

# Map RFQ category → Company type
CATEGORY_TO_TYPE: dict[str, str] = {
    "plumbing": "plumber",
    "electricity": "electrician",
    "cleaning": "cleaner",
    "painting": "painter",
    "locksmith": "locksmith",
    "roofing": "other",
    "gardening": "other",
    "masonry": "other",
    "hvac": "other",
    "renovation": "other",
    "other": "other",
}


# ── AI helpers ─────────────────────────────────────────────────────────────────


async def qualify_need(description: str, user_id: str, db: AsyncSession) -> AIQualifyResponse:
    """Use Claude to classify the need, suggest a title and urgency."""
    import anthropic
    from app.core.config import settings

    if not settings.ANTHROPIC_API_KEY:
        # Fallback: keyword matching
        return _keyword_qualify(description)

    from app.services.ai_service import MODEL, _check_rate_limit, _log_usage

    if not _check_rate_limit(user_id):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Limite IA atteinte")

    prompt = f"""Tu es un expert en gestion immobilière. Analyse cette demande de travaux/services et retourne une classification.

Description : "{description}"

Catégories disponibles : plumbing, electricity, cleaning, painting, locksmith, roofing, gardening, masonry, hvac, renovation, other
Urgences : low (>1 mois), medium (2-4 semaines), high (<2 semaines), emergency (<48h)

Retourne UNIQUEMENT ce JSON :
{{
  "category": "<catégorie>",
  "suggested_title": "<titre clair en 5-10 mots>",
  "urgency": "<urgence>",
  "confidence": <float 0.0-1.0>
}}"""

    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    msg = await client.messages.create(
        model=MODEL,
        max_tokens=200,
        messages=[{"role": "user", "content": prompt}],
    )
    await _log_usage(db, user_id, "qualify_rfq", msg.usage)

    raw = msg.content[0].text.strip()  # type: ignore[union-attr]
    if "```" in raw:
        raw = raw.split("```")[1].lstrip("json").strip()

    try:
        data = json.loads(raw)
        return AIQualifyResponse(**data)
    except Exception:
        return _keyword_qualify(description)


def _keyword_qualify(description: str) -> AIQualifyResponse:
    desc_lower = description.lower()
    if any(w in desc_lower for w in ["fuite", "plomberie", "robinet", "tuyau", "eau"]):
        cat, title = "plumbing", "Intervention plomberie"
    elif any(w in desc_lower for w in ["électricité", "prise", "disjoncteur", "tableau"]):
        cat, title = "electricity", "Travaux électricité"
    elif any(w in desc_lower for w in ["peinture", "repeindre", "mur"]):
        cat, title = "painting", "Travaux de peinture"
    elif any(w in desc_lower for w in ["nettoyage", "ménage", "nettoyer"]):
        cat, title = "cleaning", "Prestation nettoyage"
    elif any(w in desc_lower for w in ["serrure", "clé", "porte blindée"]):
        cat, title = "locksmith", "Intervention serrurerie"
    else:
        cat, title = "renovation", "Travaux de rénovation"

    urgency = (
        "emergency" if "urgence" in desc_lower else ("high" if "urgent" in desc_lower else "medium")
    )
    return AIQualifyResponse(category=cat, suggested_title=title, urgency=urgency, confidence=0.7)  # type: ignore[arg-type]


# ── Commission ─────────────────────────────────────────────────────────────────


def calculate_commission(quote_amount: float) -> float:
    return round(quote_amount * COMMISSION_PCT, 2)


# ── Service ────────────────────────────────────────────────────────────────────


class RFQService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── Company marketplace ────────────────────────────────────────────────────

    async def list_marketplace_companies(
        self,
        company_type: str | None = None,
        city: str | None = None,
        min_rating: float | None = None,
        page: int = 1,
        size: int = 20,
    ) -> list[CompanyMarketplaceRead]:
        q = select(Company).where(Company.is_active.is_(True))
        if company_type:
            q = q.where(Company.type == company_type)
        if min_rating:
            q = q.where(Company.rating >= min_rating)
        q = q.order_by(Company.rating.desc().nullslast(), Company.total_jobs.desc())
        rows = (await self.db.execute(q.offset((page - 1) * size).limit(size))).scalars().all()
        return [CompanyMarketplaceRead.model_validate(c) for c in rows]

    async def select_companies(self, rfq: RFQ) -> list[Company]:
        """Pick 3-5 best companies for a given RFQ."""
        company_type = CATEGORY_TO_TYPE.get(rfq.category, "other")
        q = (
            select(Company)
            .where(
                Company.is_active.is_(True),
                Company.type == company_type,
            )
            .order_by(Company.rating.desc().nullslast(), Company.total_jobs.desc())
            .limit(5)
        )
        rows = (await self.db.execute(q)).scalars().all()
        # If not enough specialists, fill with "other" type
        if len(rows) < 3:
            fallback = (
                (
                    await self.db.execute(
                        select(Company)
                        .where(Company.is_active.is_(True), Company.type == "other")
                        .order_by(Company.rating.desc().nullslast())
                        .limit(5 - len(rows))
                    )
                )
                .scalars()
                .all()
            )
            rows = list(rows) + list(fallback)
        return list(rows)

    def _notify_companies(self, rfq_id: str, company_ids: list[str]) -> None:
        import logging

        log = logging.getLogger(__name__)
        for cid in company_ids:
            log.info("Notifying company %s for RFQ %s", cid, rfq_id)

    # ── RFQ CRUD ──────────────────────────────────────────────────────────────

    async def create_rfq(self, payload: RFQCreate, current_user: User) -> RFQ:
        prop_id = None
        if payload.property_id:
            try:
                prop_id = uuid.UUID(payload.property_id)
            except ValueError:
                raise HTTPException(422, "property_id invalide")

        rfq = RFQ(
            owner_id=current_user.id,
            property_id=prop_id,
            title=payload.title,
            description=payload.description,
            category=payload.category,
            urgency=payload.urgency,
            city=payload.city,
            zip_code=payload.zip_code,
            budget_min=payload.budget_min,
            budget_max=payload.budget_max,
            scheduled_date=payload.scheduled_date,
            status="published",
            published_at=datetime.now(UTC),
        )
        self.db.add(rfq)
        await self.db.flush()
        await self.db.refresh(rfq)

        # Select & notify companies
        companies = await self.select_companies(rfq)
        self._notify_companies(str(rfq.id), [str(c.id) for c in companies])

        return rfq

    async def list_rfqs(
        self,
        current_user: User,
        page: int = 1,
        size: int = 20,
        rfq_status: str | None = None,
    ) -> PaginatedRFQs:
        q = select(RFQ).where(
            RFQ.owner_id == current_user.id,
            RFQ.is_active.is_(True),
        )
        if rfq_status:
            q = q.where(RFQ.status == rfq_status)

        total = (await self.db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()

        rows = (
            (
                await self.db.execute(
                    q.order_by(RFQ.created_at.desc()).offset((page - 1) * size).limit(size)
                )
            )
            .scalars()
            .all()
        )

        items = []
        for rfq in rows:
            data = RFQRead.model_validate(rfq)
            data.quotes = await self._load_quotes(str(rfq.id))
            items.append(data)

        return PaginatedRFQs(
            items=items,
            total=total,
            page=page,
            size=size,
            pages=math.ceil(total / size) if total else 1,
        )

    async def get_rfq(self, rfq_id: str, current_user: User) -> RFQ:
        rfq = await self._get_or_404(rfq_id)
        if str(rfq.owner_id) != str(current_user.id) and current_user.role != "super_admin":
            raise HTTPException(403, "Accès refusé")
        return rfq

    # ── Quote lifecycle ───────────────────────────────────────────────────────

    async def submit_quote(
        self, rfq_id: str, payload: RFQQuoteCreate, current_user: User
    ) -> RFQQuote:
        rfq = await self._get_or_404(rfq_id)
        if rfq.status not in ("published", "quotes_received"):
            raise HTTPException(
                409, f"Impossible de soumettre un devis sur un RFQ au statut '{rfq.status}'"
            )

        # Find company profile for current user
        company = await self._get_company_for_user(current_user)

        quote = RFQQuote(
            rfq_id=rfq.id,
            company_id=company.id,
            amount=payload.amount,
            description=payload.description,
            delay_days=payload.delay_days,
            warranty_months=payload.warranty_months,
            notes=payload.notes,
            status="pending",
            submitted_at=datetime.now(UTC),
        )
        self.db.add(quote)

        rfq.status = "quotes_received"
        await self.db.flush()
        await self.db.refresh(quote)
        return quote

    async def accept_quote(self, rfq_id: str, quote_id: str, current_user: User) -> RFQ:
        rfq = await self._get_or_404(rfq_id)
        if str(rfq.owner_id) != str(current_user.id):
            raise HTTPException(403, "Seul le propriétaire peut accepter un devis")
        if rfq.status != "quotes_received":
            raise HTTPException(409, "Aucun devis à accepter")

        try:
            qid = uuid.UUID(quote_id)
        except ValueError:
            raise HTTPException(422, "quote_id invalide")

        result = await self.db.execute(
            select(RFQQuote).where(RFQQuote.id == qid, RFQQuote.rfq_id == rfq.id)
        )
        quote = result.scalar_one_or_none()
        if not quote:
            raise HTTPException(404, "Devis introuvable")

        # Accept this quote, reject others
        all_quotes = (
            (await self.db.execute(select(RFQQuote).where(RFQQuote.rfq_id == rfq.id)))
            .scalars()
            .all()
        )
        for q in all_quotes:
            q.status = "rejected" if q.id != qid else "accepted"
            if q.id == qid:
                q.accepted_at = datetime.now(UTC)

        rfq.status = "accepted"
        rfq.selected_quote_id = qid
        rfq.accepted_at = datetime.now(UTC)
        rfq.commission_amount = calculate_commission(float(quote.amount))

        await self.db.flush()
        await self.db.refresh(rfq)
        return rfq

    async def complete_rfq(self, rfq_id: str, current_user: User) -> RFQ:
        rfq = await self._get_or_404(rfq_id)
        if str(rfq.owner_id) != str(current_user.id):
            raise HTTPException(403, "Accès refusé")
        if rfq.status not in ("accepted", "in_progress"):
            raise HTTPException(409, f"Impossible de terminer un RFQ au statut '{rfq.status}'")

        rfq.status = "completed"
        rfq.completed_at = datetime.now(UTC)

        # Mark accepted quote completed + increment company jobs
        if rfq.selected_quote_id:
            result = await self.db.execute(
                select(RFQQuote).where(RFQQuote.id == rfq.selected_quote_id)
            )
            quote = result.scalar_one_or_none()
            if quote:
                quote.status = "completed"
                quote.completed_at = datetime.now(UTC)
                company_result = await self.db.execute(
                    select(Company).where(Company.id == quote.company_id)
                )
                company = company_result.scalar_one_or_none()
                if company:
                    company.total_jobs = (company.total_jobs or 0) + 1

        await self.db.flush()
        await self.db.refresh(rfq)
        return rfq

    async def rate_rfq(self, rfq_id: str, payload: RFQRating, current_user: User) -> RFQ:
        rfq = await self._get_or_404(rfq_id)
        if str(rfq.owner_id) != str(current_user.id):
            raise HTTPException(403, "Accès refusé")
        if rfq.status != "completed":
            raise HTTPException(409, "L'intervention doit être terminée pour être notée")
        if rfq.rating_given is not None:
            raise HTTPException(409, "Déjà noté")

        rfq.rating_given = payload.rating
        rfq.rating_comment = payload.comment
        rfq.status = "rated"

        # Recalculate company average rating
        if rfq.selected_quote_id:
            result = await self.db.execute(
                select(RFQQuote).where(RFQQuote.id == rfq.selected_quote_id)
            )
            quote = result.scalar_one_or_none()
            if quote:
                await self._update_company_rating(str(quote.company_id))

        await self.db.flush()
        await self.db.refresh(rfq)
        return rfq

    # ── Company dashboard ─────────────────────────────────────────────────────

    async def list_company_rfqs(
        self, current_user: User, page: int = 1, size: int = 20
    ) -> PaginatedRFQs:
        """RFQs where the company submitted a quote."""
        company = await self._get_company_for_user(current_user)

        subq = select(RFQQuote.rfq_id).where(RFQQuote.company_id == company.id).subquery()
        q = select(RFQ).where(RFQ.id.in_(select(subq)), RFQ.is_active.is_(True))

        total = (await self.db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()

        rows = (
            (
                await self.db.execute(
                    q.order_by(RFQ.created_at.desc()).offset((page - 1) * size).limit(size)
                )
            )
            .scalars()
            .all()
        )

        items = []
        for rfq in rows:
            data = RFQRead.model_validate(rfq)
            data.quotes = await self._load_quotes(str(rfq.id))
            items.append(data)

        return PaginatedRFQs(
            items=items,
            total=total,
            page=page,
            size=size,
            pages=math.ceil(total / size) if total else 1,
        )

    # ── Helpers ───────────────────────────────────────────────────────────────

    async def _get_or_404(self, rfq_id: str) -> RFQ:
        try:
            rid = uuid.UUID(rfq_id)
        except ValueError:
            raise HTTPException(404, "Appel d'offre introuvable")
        result = await self.db.execute(select(RFQ).where(RFQ.id == rid, RFQ.is_active.is_(True)))
        rfq = result.scalar_one_or_none()
        if not rfq:
            raise HTTPException(404, "Appel d'offre introuvable")
        return rfq

    async def _get_company_for_user(self, user: User) -> Company:
        result = await self.db.execute(
            select(Company).where(Company.user_id == user.id, Company.is_active.is_(True))
        )
        company = result.scalar_one_or_none()
        if not company:
            raise HTTPException(404, "Profil entreprise introuvable — créez votre profil d'abord")
        return company

    async def _load_quotes(self, rfq_id: str) -> list[RFQQuoteRead]:
        result = await self.db.execute(
            select(RFQQuote)
            .where(RFQQuote.rfq_id == uuid.UUID(rfq_id), RFQQuote.is_active.is_(True))
            .order_by(RFQQuote.amount.asc())
        )
        return [RFQQuoteRead.model_validate(q) for q in result.scalars().all()]

    async def _update_company_rating(self, company_id: str) -> None:
        cid = uuid.UUID(company_id)
        avg = (
            await self.db.execute(
                select(func.avg(RFQ.rating_given)).where(
                    RFQ.selected_quote_id.in_(
                        select(RFQQuote.id).where(RFQQuote.company_id == cid)
                    ),
                    RFQ.rating_given.isnot(None),
                )
            )
        ).scalar_one()
        if avg is None:
            return
        result = await self.db.execute(select(Company).where(Company.id == cid))
        company = result.scalar_one_or_none()
        if company:
            company.rating = round(float(avg), 2)
            await self.db.flush()
