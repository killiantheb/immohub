from datetime import UTC, datetime

from app.core.database import get_db
from app.core.security import get_current_user
from app.schemas.rfq import (
    AIQualifyRequest,
    AIQualifyResponse,
    CompanyMarketplaceRead,
    PaginatedRFQs,
    RFQCreate,
    RFQQuoteCreate,
    RFQQuoteRead,
    RFQRating,
    RFQRead,
)
from app.services.rfq_service import RFQService, qualify_need
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


# ── Marketplace companies ──────────────────────────────────────────────────────


@router.get("/marketplace/companies", response_model=list[CompanyMarketplaceRead])
async def list_marketplace_companies(
    company_type: str | None = Query(None),
    city: str | None = Query(None),
    min_rating: float | None = Query(None, ge=0, le=5),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    svc = RFQService(db)
    return await svc.list_marketplace_companies(
        company_type=company_type, city=city, min_rating=min_rating, page=page, size=size
    )


# ── AI qualification ───────────────────────────────────────────────────────────


@router.post("/qualify", response_model=AIQualifyResponse)
async def qualify_rfq(
    payload: AIQualifyRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await qualify_need(payload.description, str(current_user.id), db)


# ── RFQ CRUD ───────────────────────────────────────────────────────────────────


@router.post("", response_model=RFQRead, status_code=status.HTTP_201_CREATED)
async def create_rfq(
    payload: RFQCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    svc = RFQService(db)
    rfq = await svc.create_rfq(payload, current_user)
    await db.commit()
    await db.refresh(rfq)
    result = RFQRead.model_validate(rfq)
    result.quotes = await svc._load_quotes(str(rfq.id))
    return result


@router.get("", response_model=PaginatedRFQs)
async def list_rfqs(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    rfq_status: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    svc = RFQService(db)
    return await svc.list_rfqs(current_user, page=page, size=size, rfq_status=rfq_status)


@router.get("/company/dashboard", response_model=PaginatedRFQs)
async def company_dashboard(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """RFQs where the authenticated company has submitted a quote."""
    svc = RFQService(db)
    return await svc.list_company_rfqs(current_user, page=page, size=size)


@router.get("/{rfq_id}", response_model=RFQRead)
async def get_rfq(
    rfq_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    svc = RFQService(db)
    rfq = await svc.get_rfq(rfq_id, current_user)
    result = RFQRead.model_validate(rfq)
    result.quotes = await svc._load_quotes(rfq_id)
    return result


# ── Quote lifecycle ────────────────────────────────────────────────────────────


@router.post("/{rfq_id}/quotes", response_model=RFQQuoteRead, status_code=status.HTTP_201_CREATED)
async def submit_quote(
    rfq_id: str,
    payload: RFQQuoteCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    svc = RFQService(db)
    quote = await svc.submit_quote(rfq_id, payload, current_user)
    await db.commit()
    await db.refresh(quote)
    return RFQQuoteRead.model_validate(quote)


@router.put("/{rfq_id}/accept/{quote_id}", response_model=RFQRead)
async def accept_quote(
    rfq_id: str,
    quote_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    svc = RFQService(db)
    rfq = await svc.accept_quote(rfq_id, quote_id, current_user)
    await db.commit()
    await db.refresh(rfq)
    result = RFQRead.model_validate(rfq)
    result.quotes = await svc._load_quotes(rfq_id)
    return result


@router.put("/{rfq_id}/complete", response_model=RFQRead)
async def complete_rfq(
    rfq_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    svc = RFQService(db)
    rfq = await svc.complete_rfq(rfq_id, current_user)
    await db.commit()
    await db.refresh(rfq)
    result = RFQRead.model_validate(rfq)
    result.quotes = await svc._load_quotes(rfq_id)
    return result


@router.post("/{rfq_id}/rate", response_model=RFQRead)
async def rate_rfq(
    rfq_id: str,
    payload: RFQRating,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    svc = RFQService(db)
    rfq = await svc.rate_rfq(rfq_id, payload, current_user)
    await db.commit()
    await db.refresh(rfq)
    result = RFQRead.model_validate(rfq)
    result.quotes = await svc._load_quotes(rfq_id)
    return result


# ── IA Comparaison devis ───────────────────────────────────────────────────────


class CompareDevisResponse(BaseModel):
    rfq_id: str
    nb_devis: int
    rapport: str   # Rapport IA complet en Markdown
    recommandation: str  # "Devis A" / "Devis B" / etc.
    cached: bool


@router.post("/{rfq_id}/compare-devis", response_model=CompareDevisResponse)
async def compare_devis(
    rfq_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Althy compare les devis reçus pour un appel d'offres et génère un rapport IA détaillé.
    Analyse : montant, matériaux, main-d'œuvre, délai, fiabilité artisan.
    Commission Althy : 10 % sur artisans (CLAUDE.md §3.4).
    """
    import anthropic
    from app.core.config import settings
    from app.services.ai_service import MODEL, _check_rate_limit, _log_usage

    svc = RFQService(db)
    rfq = await svc.get_rfq(rfq_id, current_user)
    quotes = await svc._load_quotes(rfq_id)

    if len(quotes) < 2:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Au moins 2 devis requis pour une comparaison.",
        )

    # Check cache
    cached_row = (await db.execute(
        text("SELECT ia_compare_report, ia_compared_at FROM rfqs WHERE id = :id"),
        {"id": rfq_id},
    )).fetchone()
    if cached_row and cached_row[0] and cached_row[1]:
        return CompareDevisResponse(
            rfq_id=rfq_id,
            nb_devis=len(quotes),
            rapport=cached_row[0],
            recommandation=_extract_recommandation(cached_row[0]),
            cached=True,
        )

    if not _check_rate_limit(str(current_user.id)):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Limite IA atteinte")

    # Construire le contexte devis
    devis_lines = []
    for i, q in enumerate(quotes):
        label = chr(65 + i)  # A, B, C...
        devis_lines.append(
            f"**Devis {label}** — {q.company_name or 'Artisan'}\n"
            f"  Montant : CHF {q.total_price or '?'}\n"
            f"  Délai : {q.delivery_days or '?'} jours\n"
            f"  Description : {q.description or 'Pas de détail'}\n"
            f"  Note artisan : {q.company_rating or 'N/A'}/5"
        )

    prompt = f"""Tu es un expert en gestion immobilière suisse. Compare ces devis pour un appel d'offres.

**Appel d'offres :** {rfq.title}
**Catégorie :** {rfq.category}
**Description :** {rfq.description or 'Pas de description'}

**Devis reçus :**
{chr(10).join(devis_lines)}

Génère un rapport de comparaison structuré en Markdown avec :
1. **Tableau récapitulatif** (montant, délai, note artisan)
2. **Analyse de chaque devis** (points forts, points faibles, justification du prix)
3. **Recommandation** — quel devis choisir et POURQUOI en 2-3 phrases claires
   Format exact : "Recommandation : Devis X car..."
4. **Alertes** si un devis est anormalement cher ou bas (>30% d'écart)

Sois factuel, précis, et mets en avant le rapport qualité/prix. Maximum 400 mots."""

    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    msg = await client.messages.create(
        model=MODEL,
        max_tokens=800,
        messages=[{"role": "user", "content": prompt}],
    )
    await _log_usage(db, str(current_user.id), "compare_devis", msg.usage)

    rapport = msg.content[0].text.strip()  # type: ignore[union-attr]

    # Mettre en cache sur le RFQ
    await db.execute(
        text("UPDATE rfqs SET ia_compare_report = :r, ia_compared_at = :t WHERE id = :id"),
        {"r": rapport, "t": datetime.now(UTC), "id": rfq_id},
    )
    await db.commit()

    return CompareDevisResponse(
        rfq_id=rfq_id,
        nb_devis=len(quotes),
        rapport=rapport,
        recommandation=_extract_recommandation(rapport),
        cached=False,
    )


def _extract_recommandation(rapport: str) -> str:
    """Extrait la ligne Recommandation du rapport IA."""
    for line in rapport.splitlines():
        if "Recommandation" in line and "Devis" in line:
            return line.strip().lstrip("#").strip()
    return "Voir le rapport complet"
