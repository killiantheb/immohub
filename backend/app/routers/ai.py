"""AI router — all endpoints under /api/v1/ai"""

from __future__ import annotations

from typing import Annotated

import json as _json
import re as _re
import uuid as _uuid

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.core.limiter import rate_limit
from app.services.ai_service import (
    PaymentAlert,
    QuoteRecommendation,
    TenantScore,
    chat_stream,
    detect_payment_anomalies,
    draft_company_quote,
    draft_edl,
    draft_lease,
    draft_mission_report,
    draft_notification,
    explain_contract,
    generate_briefing,
    generate_listing_description,
    generate_property_recap,
    recommend_best_quote,
    score_tenant_application,
)
from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import StreamingResponse
import pydantic as _pydantic
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

DbDep = Annotated[AsyncSession, Depends(get_db)]
AuthUserDep = Annotated[User, Depends(get_current_user)]


# ── Schemas ───────────────────────────────────────────────────────────────────


class GenerateListingRequest(BaseModel):
    property_id: str


class GenerateListingResponse(BaseModel):
    description: str


class ScoreTenantRequest(BaseModel):
    tenant_data: dict


class ScoreTenantResponse(BaseModel):
    score: int
    recommendation: str
    risk_flags: list[str]
    summary: str


class QuoteItem(BaseModel):
    company_name: str
    price: float
    rating: float | None = None
    delay_days: int | None = None
    description: str | None = None


class RecommendQuoteRequest(BaseModel):
    quotes: list[QuoteItem]


class RecommendQuoteResponse(BaseModel):
    best_quote_index: int
    runner_up_index: int | None
    justification: str


class ChatRequest(BaseModel):
    message: str
    context: dict = {}


class CopilotResponse(BaseModel):
    response: str


class AnomalyResponse(BaseModel):
    type: str
    severity: str
    description: str
    property_id: str | None
    tenant_id: str | None


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.post("/generate-listing", response_model=GenerateListingResponse)
async def generate_listing(
    payload: GenerateListingRequest,
    current_user: AuthUserDep,
    db: DbDep,
) -> GenerateListingResponse:
    """Generate an SEO property description via Claude."""
    import uuid

    from app.models.property import Property
    from sqlalchemy import select

    try:
        pid = uuid.UUID(payload.property_id)
    except ValueError:
        raise HTTPException(422, "property_id invalide")

    result = await db.execute(select(Property).where(Property.id == pid))
    prop = result.scalar_one_or_none()
    if not prop:
        raise HTTPException(404, "Bien introuvable")

    try:
        description = await generate_listing_description(prop, db, str(current_user.id))
    except RuntimeError as exc:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, str(exc))

    return GenerateListingResponse(description=description)


@router.post("/score-tenant", response_model=ScoreTenantResponse)
async def score_tenant(
    payload: ScoreTenantRequest,
    current_user: AuthUserDep,
    db: DbDep,
) -> ScoreTenantResponse:
    """Score a tenant application 0-100."""
    try:
        result: TenantScore = await score_tenant_application(
            payload.tenant_data, db, str(current_user.id)
        )
    except RuntimeError as exc:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, str(exc))

    return ScoreTenantResponse(
        score=result.score,
        recommendation=result.recommendation,
        risk_flags=result.risk_flags,
        summary=result.summary,
    )


@router.post("/recommend-quote", response_model=RecommendQuoteResponse)
async def recommend_quote(
    payload: RecommendQuoteRequest,
    current_user: AuthUserDep,
    db: DbDep,
) -> RecommendQuoteResponse:
    """Return the best contractor quote with justification."""
    if len(payload.quotes) < 2:
        raise HTTPException(422, "Au moins 2 devis requis pour une comparaison")

    quotes_dicts = [q.model_dump() for q in payload.quotes]
    try:
        result: QuoteRecommendation = await recommend_best_quote(
            quotes_dicts, db, str(current_user.id)
        )
    except RuntimeError as exc:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, str(exc))

    return RecommendQuoteResponse(
        best_quote_index=result.best_quote_index,
        runner_up_index=result.runner_up_index,
        justification=result.justification,
    )


@router.post("/copilot", response_model=CopilotResponse)
async def copilot(
    payload: ChatRequest,
    current_user: AuthUserDep,
    db: DbDep,
) -> CopilotResponse:
    """
    Non-streaming copilot — collects the full Claude response and returns it.
    Use /chat for SSE streaming.
    """
    user_name = current_user.first_name or (current_user.email or "").split("@")[0]
    context = {**payload.context, "role": current_user.role, "user_name": user_name}
    parts: list[str] = []
    async for chunk in chat_stream(
        message=payload.message,
        context=context,
        db=db,
        user_id=str(current_user.id),
    ):
        # SSE format: "data: {...}\n\n" or "data: [DONE]\n\n"
        if chunk.startswith("data: ") and chunk.strip() != "data: [DONE]":
            import json as _json

            try:
                parsed = _json.loads(chunk[6:].strip())
                if "text" in parsed:
                    parts.append(parsed["text"].replace("\\n", "\n"))
            except Exception:
                pass
    return CopilotResponse(response="".join(parts))


@router.post("/chat")
async def chat(
    payload: ChatRequest,
    current_user: AuthUserDep,
    db: DbDep,
    _=rate_limit(20, 60),
) -> StreamingResponse:
    """
    Conversational copilot — streams SSE events.
    Each event: data: {"text": "..."}\n\n
    Final event: data: [DONE]\n\n
    """
    user_name = current_user.first_name or (current_user.email or "").split("@")[0]
    context = {**payload.context, "role": current_user.role, "user_name": user_name}

    async def _generate():
        async for chunk in chat_stream(
            message=payload.message,
            context=context,
            db=db,
            user_id=str(current_user.id),
        ):
            yield chunk

    return StreamingResponse(
        _generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


class VoiceActionRequest(BaseModel):
    transcript: str


@router.post("/voice-action")
async def voice_action(
    payload: VoiceActionRequest,
    current_user: AuthUserDep,
    db: DbDep,
    _=rate_limit(10, 60),
):
    """
    Analyse un message vocal et exécute l'action détectée.
    Retourne: {intent, data, message, property_id?}
    """
    from anthropic import AsyncAnthropic
    from app.core.config import settings

    client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    response = await client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=800,
        messages=[{"role": "user", "content": f"""
Tu es Althy, assistant immobilier suisse. L'utilisateur a dit :
"{payload.transcript}"

Détecte l'intention et retourne UNIQUEMENT ce JSON :
{{
  "intent": "create_property|navigate|question|unknown",
  "message": "ta réponse courte en français (1 phrase)",
  "navigate_path": null,
  "property": {{
    "type": "apartment|house|studio|commercial|parking|land",
    "address": null,
    "city": null,
    "zip_code": null,
    "surface": null,
    "rooms": null,
    "monthly_rent": null,
    "charges": null,
    "deposit": null,
    "status": "available",
    "is_furnished": false,
    "has_parking": false,
    "country": "CH"
  }}
}}

Règles :
- "create_property" si l'utilisateur veut ajouter/créer un bien immobilier
- "navigate" si l'utilisateur veut aller sur une page (property→/app/properties, contrat→/app/contracts, etc.)
- "question" pour toute autre demande
- Extrais les détails du bien depuis le transcript si intent=create_property
- type : "apartment"=appartement, "house"=maison/villa, "studio"=studio, "commercial"=commercial
"""}]
    )

    raw = response.content[0].text.strip()
    if "```" in raw:
        raw = raw.split("```")[1].lstrip("json").strip()

    try:
        result = _json.loads(raw)
    except Exception:
        return {"intent": "question", "message": "Je n'ai pas compris. Reformulez votre demande.", "property": None}

    # Si intent = create_property, on crée directement le bien en base
    if result.get("intent") == "create_property" and result.get("property"):
        prop_data = result["property"]
        if prop_data.get("address") or prop_data.get("city"):
            from app.models.property import Property
            new_prop = Property(
                id=_uuid.uuid4(),
                type=prop_data.get("type", "apartment"),
                address=prop_data.get("address") or "",
                city=prop_data.get("city") or "",
                zip_code=prop_data.get("zip_code") or "",
                country=prop_data.get("country") or "CH",
                surface=prop_data.get("surface"),
                rooms=prop_data.get("rooms"),
                monthly_rent=prop_data.get("monthly_rent"),
                charges=prop_data.get("charges"),
                deposit=prop_data.get("deposit"),
                status=prop_data.get("status", "available"),
                is_furnished=bool(prop_data.get("is_furnished", False)),
                has_parking=bool(prop_data.get("has_parking", False)),
                owner_id=current_user.id,
                created_by_id=current_user.id,
                is_active=True,
            )
            db.add(new_prop)
            await db.commit()
            result["property_id"] = str(new_prop.id)
            result["message"] = f"Bien créé : {new_prop.type} à {new_prop.city or new_prop.address}. Vous pouvez compléter les détails."
        else:
            result["intent"] = "need_more_info"
            result["message"] = "J'ai besoin d'une adresse ou d'une ville pour créer le bien."

    return result


@router.post("/import-property")
async def import_property_file(
    current_user: AuthUserDep,
    db: DbDep,
    file: UploadFile = File(...),
    _=rate_limit(5, 60),
):
    """
    Upload un fichier (PDF, Excel, CSV, image) → Claude extrait les données → crée les biens en DB.
    Retourne la liste des biens créés.
    """
    from app.models.property import Property
    from app.services.import_service import (
        extract_from_csv_bytes,
        extract_from_excel_bytes,
        extract_from_image_bytes,
        extract_from_pdf_bytes,
    )

    if current_user.role not in ("owner", "agency", "super_admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Réservé aux propriétaires et agences")

    content_type = file.content_type or ""
    filename = (file.filename or "").lower()
    file_bytes = await file.read()

    if len(file_bytes) > 20 * 1024 * 1024:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Fichier trop volumineux (max 20 Mo)")

    # ── Dispatch selon le type de fichier ─────────────────────────────────────
    try:
        if "pdf" in content_type or filename.endswith(".pdf"):
            result = await extract_from_pdf_bytes(file_bytes)
        elif content_type in ("image/jpeg", "image/png", "image/webp") or filename.endswith((".jpg", ".jpeg", ".png", ".webp")):
            mt = content_type if content_type.startswith("image/") else "image/jpeg"
            result = await extract_from_image_bytes(file_bytes, mt)
        elif "spreadsheet" in content_type or "excel" in content_type or filename.endswith((".xlsx", ".xls")):
            result = await extract_from_excel_bytes(file_bytes)
        elif "csv" in content_type or filename.endswith(".csv"):
            result = await extract_from_csv_bytes(file_bytes)
        else:
            raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Format non supporté. Utilisez PDF, Excel, CSV ou image.")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Erreur d'extraction : {exc}") from exc

    props_data = result.get("properties", [])
    if not props_data:
        return {"created": [], "count": 0, "notes": result.get("notes", "Aucun bien détecté dans le fichier.")}

    # ── Création en base ───────────────────────────────────────────────────────
    created = []
    for p in props_data:
        if not (p.get("address") or p.get("city")):
            continue  # Skip si pas d'adresse ni ville
        try:
            new_prop = Property(
                id=_uuid.uuid4(),
                type=p.get("type", "apartment"),
                address=p.get("address") or "",
                city=p.get("city") or "",
                zip_code=p.get("zip_code") or "",
                country=p.get("country") or "CH",
                surface=float(p["surface"]) if p.get("surface") else None,
                rooms=float(p["rooms"]) if p.get("rooms") else None,
                floor=int(p["floor"]) if p.get("floor") else None,
                monthly_rent=float(p["monthly_rent"]) if p.get("monthly_rent") else None,
                charges=float(p["charges"]) if p.get("charges") else None,
                deposit=float(p["deposit"]) if p.get("deposit") else None,
                price_sale=float(p["price_sale"]) if p.get("price_sale") else None,
                status=p.get("status", "available"),
                is_furnished=bool(p.get("is_furnished", False)),
                has_parking=bool(p.get("has_parking", False)),
                pets_allowed=bool(p.get("pets_allowed", False)),
                description=p.get("description"),
                owner_id=current_user.id,
                created_by_id=current_user.id,
                is_active=True,
            )
            db.add(new_prop)
            await db.flush()
            created.append({
                "id": str(new_prop.id),
                "type": new_prop.type,
                "address": new_prop.address,
                "city": new_prop.city,
                "monthly_rent": new_prop.monthly_rent,
                "status": new_prop.status,
            })
        except Exception:
            continue

    await db.commit()

    # ── Mise à jour du logo agence si détecté ─────────────────────────────────
    agency_identity: dict = {}
    if content_type.startswith("image/") or "pdf" in content_type or filename.endswith(".pdf"):
        from app.services.import_service import extract_agency_identity
        try:
            agency_identity = await extract_agency_identity(file_bytes, content_type, file.filename or "")
            logo_url = agency_identity.get("logo_url")
            if logo_url and current_user.role in ("agency", "owner"):
                # Vérifie que le logo est accessible
                import httpx
                async with httpx.AsyncClient(timeout=5) as hclient:
                    resp = await hclient.head(logo_url)
                    if resp.status_code == 200:
                        from sqlalchemy import select as sa_select
                        from app.models.user import User as UserModel
                        result2 = await db.execute(sa_select(UserModel).where(UserModel.id == current_user.id))
                        user_row = result2.scalar_one_or_none()
                        if user_row and not user_row.avatar_url:
                            user_row.avatar_url = logo_url
                            await db.commit()
                            agency_identity["logo_updated"] = True
        except Exception:
            pass

    return {
        "created": created,
        "count": len(created),
        "notes": result.get("notes", ""),
        "agency_identity": agency_identity,
    }


# ── Agency AI Advisor ──────────────────────────────────────────────────────────

class AdvisorRequest(BaseModel):
    question: str
    context: dict = {}


@router.post("/agency-advisor")
async def agency_advisor(
    payload: AdvisorRequest,
    current_user: AuthUserDep,
    db: DbDep,
    _=rate_limit(15, 60),
):
    """
    Conseiller IA spécialisé pour agences et propriétaires.
    Analyse baux, EDL, paiements et donne des conseils juridiques/financiers suisses.
    """
    from anthropic import AsyncAnthropic
    from app.core.config import settings
    from app.models.contract import Contract
    from app.models.transaction import Transaction
    from sqlalchemy import select as sa_select, and_

    if current_user.role not in ("agency", "owner", "super_admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Réservé aux agences et propriétaires")

    client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    # Récupère les données réelles de l'utilisateur pour contexte
    contracts = (await db.execute(
        sa_select(Contract).where(
            and_(Contract.is_active.is_(True),
                 (Contract.owner_id == current_user.id) | (Contract.agency_id == current_user.id))
        ).limit(20)
    )).scalars().all()

    late_tx = (await db.execute(
        sa_select(Transaction).where(
            and_(Transaction.owner_id == current_user.id,
                 Transaction.status == "late",
                 Transaction.is_active.is_(True))
        ).limit(10)
    )).scalars().all()

    context_data = {
        "nb_contrats_actifs": len([c for c in contracts if c.status == "active"]),
        "nb_contrats_brouillon": len([c for c in contracts if c.status == "draft"]),
        "nb_loyers_en_retard": len(late_tx),
        "types_contrats": list({c.type for c in contracts}),
        **(payload.context or {}),
    }

    system = f"""Tu es AlthyLegal, conseiller IA expert en droit immobilier suisse (CO, LDTR, bail à loyer).
Tu conseilles {current_user.first_name or 'l\'utilisateur'}, {'agence immobilière' if current_user.role == 'agency' else 'propriétaire'}.

Données de son portefeuille :
{_json.dumps(context_data, ensure_ascii=False)}

Tu peux conseiller sur :
- Conformité juridique des baux (durée, loyer initial, hausses de loyer, résiliation)
- Qualité des états des lieux (EDL) et ce qui doit être documenté
- Optimisation des paiements et gestion des retards
- Commissions de gérance (taux légaux suisses)
- Dépôts de garantie (max 3 mois selon CO art. 257e)
- Baux saisonniers vs longue durée
- Recommandations sur les paramètres contractuels

Réponds en français, sois précis et cite les articles de loi suisses si pertinent.
Sois direct et actionnable. Max 300 mots."""

    response = await client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=600,
        system=system,
        messages=[{"role": "user", "content": payload.question}],
    )

    return {"advice": response.content[0].text.strip()}


# ── Smart Contract Parameters from Natural Language ────────────────────────────

class ContractParamsRequest(BaseModel):
    description: str  # ex: "location saisonnière, commission 15%, dépôt 2 mois"


@router.post("/parse-contract-params")
async def parse_contract_params(
    payload: ContractParamsRequest,
    current_user: AuthUserDep,
    _=rate_limit(20, 60),
):
    """
    Parse une description en langage naturel et retourne des paramètres de contrat structurés.
    Ex: "saisonnier 15% commission, dépôt 2 mois" → {type, commission_pct, deposit_months, ...}
    """
    from anthropic import AsyncAnthropic
    from app.core.config import settings

    if current_user.role not in ("agency", "owner", "super_admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Réservé aux agences et propriétaires")

    client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    response = await client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=500,
        messages=[{"role": "user", "content": f"""
Tu es un expert en droit du bail suisse. Analyse cette description et extrait les paramètres du contrat.

Description : "{payload.description}"

Retourne UNIQUEMENT ce JSON :
{{
  "type": "long_term|seasonal|short_term|management",
  "commission_pct": <pourcentage de commission ou null>,
  "deposit_months": <nombre de mois de dépôt (max 3 selon CO) ou null>,
  "notice_months": <préavis en mois ou null>,
  "min_duration_months": <durée minimale en mois ou null>,
  "rent_increase_pct": <hausse annuelle max en % ou null>,
  "included_charges": true/false,
  "management_fee_pct": <honoraires de gérance % ou null>,
  "ai_recommendations": [
    "recommandation juridique courte 1",
    "recommandation juridique courte 2"
  ],
  "warnings": ["avertissement si paramètre hors norme suisse"]
}}

Droit suisse : dépôt max 3 mois, préavis standard 3 mois longue durée, bail saisonnier < 1 an.
"""}]
    )

    raw = response.content[0].text.strip()
    if "```" in raw:
        raw = _re.sub(r"```(?:json)?", "", raw).strip()

    try:
        return _json.loads(raw)
    except Exception:
        return {"type": "long_term", "ai_recommendations": [], "warnings": ["Impossible de parser les paramètres"]}


@router.get("/briefing")
async def get_briefing(
    current_user: AuthUserDep,
    db: DbDep,
) -> dict:
    """Generate a personalised Cathy home screen briefing based on real data."""
    from datetime import date, timedelta

    from app.models.contract import Contract
    from app.models.opener import Mission
    from app.models.property import Property as PropertyModel
    from app.models.rfq import RFQ
    from app.models.transaction import Transaction as Txn
    from sqlalchemy import select

    role = current_user.role
    first_name = current_user.first_name or (current_user.email or "").split("@")[0]
    context: dict = {}

    try:
        today = date.today()
        uid = current_user.id

        if role in ("owner", "agency", "super_admin"):
            # Late / pending rent
            res = await db.execute(
                select(Txn)
                .where(
                    Txn.owner_id == uid,
                    Txn.status.in_(["pending", "late"]),
                    Txn.due_date <= today,
                    Txn.is_active.is_(True),
                )
                .limit(5)
            )
            late = res.scalars().all()
            context["late_transactions"] = [
                {
                    "id": str(t.id),
                    "amount": float(t.amount),
                    "due_date": t.due_date.isoformat() if t.due_date else None,
                    "days_late": (today - t.due_date).days if t.due_date else 0,
                    "reference": t.reference,
                }
                for t in late
            ]
            # Expiring contracts (60 days)
            res = await db.execute(
                select(Contract)
                .where(
                    Contract.owner_id == uid,
                    Contract.status == "active",
                    Contract.end_date.isnot(None),
                    Contract.end_date <= today + timedelta(days=60),
                    Contract.end_date >= today,
                )
                .limit(3)
            )
            expiring = res.scalars().all()
            context["expiring_contracts"] = [
                {
                    "id": str(c.id),
                    "end_date": c.end_date.isoformat() if c.end_date else None,
                    "days_left": (c.end_date - today).days if c.end_date else 0,
                    "monthly_rent": float(c.monthly_rent) if c.monthly_rent else 0,
                }
                for c in expiring
            ]
            # Vacant properties
            res = await db.execute(
                select(PropertyModel)
                .where(
                    PropertyModel.owner_id == uid,
                    PropertyModel.status == "available",
                    PropertyModel.is_active.is_(True),
                )
                .limit(3)
            )
            vacant = res.scalars().all()
            context["vacant_properties"] = [
                {
                    "id": str(p.id),
                    "address": p.address,
                    "city": p.city,
                    "monthly_rent": float(p.monthly_rent) if p.monthly_rent else 0,
                }
                for p in vacant
            ]

        elif role == "opener":
            res = await db.execute(
                select(Mission)
                .where(
                    Mission.status == "pending",
                    Mission.opener_id.is_(None),
                )
                .limit(5)
            )
            missions = res.scalars().all()
            context["available_missions"] = [
                {
                    "id": str(m.id),
                    "type": m.type,
                    "scheduled_at": m.scheduled_at.isoformat() if m.scheduled_at else None,
                    "price": float(m.price) if m.price else 0,
                }
                for m in missions
            ]

        elif role == "tenant":
            res = await db.execute(
                select(Contract)
                .where(
                    Contract.tenant_id == uid,
                    Contract.status == "active",
                )
                .limit(2)
            )
            contracts = res.scalars().all()
            context["active_contracts"] = [
                {
                    "id": str(c.id),
                    "end_date": c.end_date.isoformat() if c.end_date else None,
                    "monthly_rent": float(c.monthly_rent) if c.monthly_rent else 0,
                }
                for c in contracts
            ]
            res = await db.execute(
                select(Txn)
                .where(
                    Txn.tenant_id == uid,
                    Txn.status == "pending",
                    Txn.due_date >= today,
                )
                .order_by(Txn.due_date)
                .limit(3)
            )
            upcoming = res.scalars().all()
            context["upcoming_payments"] = [
                {
                    "id": str(t.id),
                    "amount": float(t.amount),
                    "due_date": t.due_date.isoformat() if t.due_date else None,
                }
                for t in upcoming
            ]

        elif role == "company":
            res = await db.execute(select(RFQ).where(RFQ.status == "published").limit(5))
            rfqs = res.scalars().all()
            context["open_rfqs"] = [
                {
                    "id": str(r.id),
                    "title": r.title,
                    "category": r.category,
                    "city": r.city,
                    "budget_min": float(r.budget_min) if r.budget_min else 0,
                    "budget_max": float(r.budget_max) if r.budget_max else 0,
                    "urgency": r.urgency,
                }
                for r in rfqs
            ]

    except Exception as exc:
        import logging

        logging.getLogger(__name__).warning("Briefing context fetch failed: %s", exc)

    try:
        return await generate_briefing(
            first_name=first_name,
            role=role,
            context=context,
            db=db,
            user_id=str(current_user.id),
        )
    except RuntimeError as exc:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, str(exc))


# ── New role-specific agents ──────────────────────────────────────────────────


class DraftLeaseRequest(BaseModel):
    property_id: str
    tenant_data: dict
    params: dict  # {start_date, end_date?, monthly_rent, charges, deposit, type, commission_pct?}
    requires_validation: bool = True


@router.post("/draft-lease")
async def draft_lease_endpoint(
    payload: DraftLeaseRequest,
    current_user: AuthUserDep,
    db: DbDep,
    _=rate_limit(5, 60),
):
    """Generate a complete Swiss-law compliant lease. Owners and agencies only."""
    import uuid as _uuid_mod
    from app.models.property import Property
    from sqlalchemy import select as sa_sel

    if current_user.role not in ("owner", "agency", "super_admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Réservé aux propriétaires et agences")

    try:
        pid = _uuid_mod.UUID(payload.property_id)
    except ValueError:
        raise HTTPException(422, "property_id invalide")

    result = await db.execute(sa_sel(Property).where(Property.id == pid))
    prop = result.scalar_one_or_none()
    if not prop:
        raise HTTPException(404, "Bien introuvable")

    property_data = {
        "type": prop.type,
        "address": prop.address,
        "city": prop.city,
        "zip_code": prop.zip_code,
        "surface": float(prop.surface) if prop.surface else None,
        "rooms": float(prop.rooms) if prop.rooms else None,
        "floor": prop.floor,
        "is_furnished": prop.is_furnished,
    }

    try:
        text = await draft_lease(property_data, payload.tenant_data, payload.params, db, str(current_user.id))
    except RuntimeError as exc:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, str(exc))

    return {
        "lease_text": text,
        "requires_validation": payload.requires_validation,
        "disclaimer": "Ce bail est fourni à titre indicatif. Faites-le valider par un juriste avant signature officielle.",
    }


class DraftEDLRequest(BaseModel):
    property_id: str
    edl_type: str = "entry"  # "entry" | "exit"
    inspection_date: str
    previous_edl: dict | None = None
    requires_validation: bool = True


@router.post("/draft-edl")
async def draft_edl_endpoint(
    payload: DraftEDLRequest,
    current_user: AuthUserDep,
    db: DbDep,
    _=rate_limit(5, 60),
):
    """Generate a structured entry/exit inspection form."""
    import uuid as _uuid_mod
    from app.models.property import Property
    from sqlalchemy import select as sa_sel

    if current_user.role not in ("owner", "agency", "opener", "super_admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès non autorisé")

    if payload.edl_type not in ("entry", "exit"):
        raise HTTPException(422, "edl_type doit être 'entry' ou 'exit'")

    try:
        pid = _uuid_mod.UUID(payload.property_id)
    except ValueError:
        raise HTTPException(422, "property_id invalide")

    result = await db.execute(sa_sel(Property).where(Property.id == pid))
    prop = result.scalar_one_or_none()
    if not prop:
        raise HTTPException(404, "Bien introuvable")

    property_data = {
        "type": prop.type,
        "address": prop.address,
        "city": prop.city,
        "surface": float(prop.surface) if prop.surface else None,
        "rooms": float(prop.rooms) if prop.rooms else None,
        "floor": prop.floor,
        "is_furnished": prop.is_furnished,
        "description": prop.description,
    }

    try:
        edl = await draft_edl(
            property_data,
            payload.edl_type,
            payload.inspection_date,
            payload.previous_edl,
            db,
            str(current_user.id),
        )
    except RuntimeError as exc:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, str(exc))

    return {**edl, "requires_validation": payload.requires_validation}


class MissionReportRequest(BaseModel):
    mission_id: str
    observations: str


@router.post("/mission-report")
async def mission_report_endpoint(
    payload: MissionReportRequest,
    current_user: AuthUserDep,
    db: DbDep,
    _=rate_limit(10, 60),
):
    """Generate a professional mission report for an opener."""
    import uuid as _uuid_mod
    from app.models.opener import Mission
    from sqlalchemy import select as sa_sel

    if current_user.role not in ("opener", "super_admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Réservé aux ouvreurs")

    try:
        mid = _uuid_mod.UUID(payload.mission_id)
    except ValueError:
        raise HTTPException(422, "mission_id invalide")

    result = await db.execute(sa_sel(Mission).where(Mission.id == mid))
    mission = result.scalar_one_or_none()
    if not mission:
        raise HTTPException(404, "Mission introuvable")

    mission_data = {
        "type": mission.type,
        "status": mission.status,
        "scheduled_at": mission.scheduled_at.isoformat() if mission.scheduled_at else None,
        "price": float(mission.price) if mission.price else None,
    }

    try:
        report = await draft_mission_report(mission_data, payload.observations, db, str(current_user.id))
    except RuntimeError as exc:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, str(exc))

    return {"report": report, "mission_id": payload.mission_id}


class DraftQuoteRequest(BaseModel):
    rfq_id: str
    work_description: str = ""


@router.post("/draft-quote")
async def draft_quote_endpoint(
    payload: DraftQuoteRequest,
    current_user: AuthUserDep,
    db: DbDep,
    _=rate_limit(10, 60),
):
    """AI-assisted quote draft for a company responding to an RFQ."""
    import uuid as _uuid_mod
    from app.models.rfq import RFQ
    from app.models.company import Company
    from sqlalchemy import select as sa_sel

    if current_user.role not in ("company", "super_admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Réservé aux entreprises")

    try:
        rid = _uuid_mod.UUID(payload.rfq_id)
    except ValueError:
        raise HTTPException(422, "rfq_id invalide")

    rfq_res = await db.execute(sa_sel(RFQ).where(RFQ.id == rid))
    rfq = rfq_res.scalar_one_or_none()
    if not rfq:
        raise HTTPException(404, "Appel d'offre introuvable")

    company_res = await db.execute(sa_sel(Company).where(Company.user_id == current_user.id))
    company = company_res.scalar_one_or_none()

    rfq_data = {
        "title": rfq.title,
        "description": rfq.description,
        "category": rfq.category,
        "urgency": rfq.urgency,
        "budget_min": float(rfq.budget_min) if rfq.budget_min else None,
        "budget_max": float(rfq.budget_max) if rfq.budget_max else None,
        "city": rfq.city,
    }
    company_data = {
        "type": company.type if company else "other",
        "name": company.name if company else "",
        "rating": float(company.rating) if company and company.rating else None,
    }

    try:
        quote = await draft_company_quote(rfq_data, company_data, payload.work_description, db, str(current_user.id))
    except RuntimeError as exc:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, str(exc))

    return quote


class ExplainContractRequest(BaseModel):
    contract_id: str


@router.post("/explain-contract")
async def explain_contract_endpoint(
    payload: ExplainContractRequest,
    current_user: AuthUserDep,
    db: DbDep,
    _=rate_limit(10, 60),
):
    """Explain a lease contract in plain language for a tenant."""
    import uuid as _uuid_mod
    from app.models.contract import Contract
    from sqlalchemy import select as sa_sel

    try:
        cid = _uuid_mod.UUID(payload.contract_id)
    except ValueError:
        raise HTTPException(422, "contract_id invalide")

    result = await db.execute(sa_sel(Contract).where(Contract.id == cid))
    contract = result.scalar_one_or_none()
    if not contract:
        raise HTTPException(404, "Contrat introuvable")

    # Tenants can only read their own contract
    if current_user.role == "tenant" and contract.tenant_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès non autorisé")

    contract_data = {
        "type": contract.type,
        "status": contract.status,
        "start_date": contract.start_date.isoformat() if contract.start_date else None,
        "end_date": contract.end_date.isoformat() if contract.end_date else None,
        "monthly_rent": float(contract.monthly_rent) if contract.monthly_rent else None,
        "charges": float(contract.charges) if contract.charges else None,
        "deposit": float(contract.deposit) if contract.deposit else None,
        "notice_months": getattr(contract, "notice_months", 3),
        "is_furnished": getattr(contract, "is_furnished", False),
        "pets_allowed": getattr(contract, "pets_allowed", None),
        "special_clauses": getattr(contract, "special_clauses", None),
    }

    try:
        explanation = await explain_contract(contract_data, db, str(current_user.id))
    except RuntimeError as exc:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, str(exc))

    return explanation


class NotificationRequest(BaseModel):
    channel: str = "email"  # "email" | "whatsapp"
    recipient_role: str  # "tenant" | "owner" | "company" | "opener"
    subject: str
    context: dict = {}


@router.post("/draft-notification")
async def draft_notification_endpoint(
    payload: NotificationRequest,
    current_user: AuthUserDep,
    db: DbDep,
    _=rate_limit(15, 60),
):
    """Draft a ready-to-send email or WhatsApp message."""
    if payload.channel not in ("email", "whatsapp"):
        raise HTTPException(422, "channel doit être 'email' ou 'whatsapp'")

    try:
        result = await draft_notification(
            payload.channel,
            payload.recipient_role,
            payload.subject,
            payload.context,
            db,
            str(current_user.id),
        )
    except RuntimeError as exc:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, str(exc))

    return result


class PropertyRecapRequest(BaseModel):
    property_id: str


@router.post("/property-recap")
async def property_recap_endpoint(
    payload: PropertyRecapRequest,
    current_user: AuthUserDep,
    db: DbDep,
    _=rate_limit(5, 60),
):
    """Generate a complete property history recap (owner/agency only)."""
    import uuid as _uuid_mod
    from app.models.property import Property
    from app.models.contract import Contract
    from app.models.transaction import Transaction as Txn
    from app.models.rfq import RFQ
    from sqlalchemy import select as sa_sel, and_

    if current_user.role not in ("owner", "agency", "super_admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Réservé aux propriétaires et agences")

    try:
        pid = _uuid_mod.UUID(payload.property_id)
    except ValueError:
        raise HTTPException(422, "property_id invalide")

    result = await db.execute(sa_sel(Property).where(Property.id == pid))
    prop = result.scalar_one_or_none()
    if not prop:
        raise HTTPException(404, "Bien introuvable")

    # Fetch history
    contracts = (await db.execute(
        sa_sel(Contract).where(Contract.property_id == pid).order_by(Contract.start_date.desc()).limit(20)
    )).scalars().all()

    transactions = (await db.execute(
        sa_sel(Txn).where(and_(Txn.property_id == pid, Txn.is_active.is_(True))).limit(100)
    )).scalars().all()

    rfqs = (await db.execute(
        sa_sel(RFQ).where(RFQ.property_id == pid).order_by(RFQ.created_at.desc()).limit(20)
    )).scalars().all()

    property_data = {"type": prop.type, "address": prop.address, "city": prop.city, "status": prop.status}

    tenants_history = [
        {
            "id": str(c.id),
            "type": c.type,
            "status": c.status,
            "start_date": c.start_date.isoformat() if c.start_date else None,
            "end_date": c.end_date.isoformat() if c.end_date else None,
            "monthly_rent": float(c.monthly_rent) if c.monthly_rent else 0,
        }
        for c in contracts
    ]

    total_revenue = sum(float(t.amount) for t in transactions if t.status == "paid")
    unpaid = [t for t in transactions if t.status in ("pending", "late")]

    transactions_summary = {
        "total_revenue_chf": total_revenue,
        "unpaid_count": len(unpaid),
        "unpaid_total_chf": sum(float(t.amount) for t in unpaid),
        "total_transactions": len(transactions),
    }

    interventions = [
        {
            "id": str(r.id),
            "title": r.title,
            "category": r.category,
            "status": r.status,
            "urgency": r.urgency,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rfqs
    ]

    try:
        recap = await generate_property_recap(
            property_data, tenants_history, transactions_summary, interventions, [], db, str(current_user.id)
        )
    except RuntimeError as exc:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, str(exc))

    return recap


@router.get("/anomalies", response_model=list[AnomalyResponse])
async def anomalies(
    current_user: AuthUserDep,
    db: DbDep,
) -> list[AnomalyResponse]:
    """Detect payment anomalies for the current owner."""
    try:
        alerts: list[PaymentAlert] = await detect_payment_anomalies(
            str(current_user.id), db, str(current_user.id)
        )
    except RuntimeError as exc:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, str(exc))

    return [
        AnomalyResponse(
            type=a.type,
            severity=a.severity,
            description=a.description,
            property_id=a.property_id,
            tenant_id=a.tenant_id,
        )
        for a in alerts
    ]


# ── Rédiger description (SSE) ─────────────────────────────────────────────────

class RedigerDescriptionRequest(BaseModel):
    type_publication: str          # "mission" | "devis"
    type_intervention: str         # visite/EDL/plomberie/etc.
    adresse_bien: str | None = None
    description_contexte: str | None = None


@router.post(
    "/rediger-description",
    summary="Rédige une description de mission ou devis (SSE streaming)",
)
async def rediger_description(
    payload: RedigerDescriptionRequest,
    current_user: AuthUserDep,
    db: DbDep,
    _=rate_limit(15, 60),
) -> StreamingResponse:
    """
    Génère une description professionnelle pour une publication (mission ouvreur
    ou devis artisan) en streaming SSE.
    """
    if payload.type_publication == "mission":
        prompt = (
            f"Rédige une description professionnelle et concise (3-5 lignes) pour une mission ouvreur de type "
            f"'{payload.type_intervention}'"
            + (f" au bien situé à {payload.adresse_bien}" if payload.adresse_bien else "")
            + (f". Contexte : {payload.description_contexte}" if payload.description_contexte else "")
            + ". La description doit être claire, attrayante pour un ouvreur qualifié, "
            "et mentionner le type de mission, les attentes principales et le niveau de service attendu. "
            "Réponds uniquement avec la description, sans titre ni introduction."
        )
    else:
        prompt = (
            f"Rédige une description professionnelle pour une demande de devis de travaux : "
            f"type '{payload.type_intervention}'"
            + (f" au bien situé à {payload.adresse_bien}" if payload.adresse_bien else "")
            + (f". Contexte supplémentaire : {payload.description_contexte}" if payload.description_contexte else "")
            + ". La description doit être précise pour un artisan, mentionner la nature du problème, "
            "les contraintes éventuelles et les attentes en termes de qualité. "
            "Réponds uniquement avec la description, sans titre ni introduction."
        )

    context = {
        "page": "publications/new",
        "role": current_user.role,
        "user_name": current_user.first_name or "",
    }

    async def _generate():
        async for chunk in chat_stream(
            message=prompt,
            context=context,
            db=db,
            user_id=str(current_user.id),
        ):
            yield chunk

    return StreamingResponse(
        _generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── GET /chat — SSE with auto-injected context ────────────────────────────────

@router.get("/chat")
async def chat_get(
    current_user: AuthUserDep,
    db: DbDep,
    message: str = Query(..., description="Message de l'utilisateur"),
    _=rate_limit(20, 60),
) -> StreamingResponse:
    """
    SSE streaming chat avec contexte auto-injecté (biens, locataires, interventions).
    Compatible EventSource — auth via Bearer header.
    """
    from app.models.bien import Bien
    from app.models.intervention import Intervention
    from app.models.locataire import Locataire
    from sqlalchemy import and_, func, select as sa_sel

    uid = current_user.id
    ctx: dict = {"role": current_user.role, "user_name": current_user.first_name or ""}

    try:
        # Biens de l'utilisateur
        biens_count = (await db.execute(
            sa_sel(func.count()).select_from(Bien).where(Bien.owner_id == uid)
        )).scalar() or 0
        ctx["nb_biens"] = biens_count

        biens_res = await db.execute(sa_sel(Bien).where(Bien.owner_id == uid).limit(10))
        biens = biens_res.scalars().all()
        bien_ids = [b.id for b in biens]
        ctx["biens"] = [{"adresse": b.adresse, "ville": b.ville, "statut": b.statut} for b in biens]

        if bien_ids:
            # Locataires actifs
            loc_res = await db.execute(
                sa_sel(func.count()).select_from(Locataire).where(
                    and_(Locataire.bien_id.in_(bien_ids), Locataire.statut == "actif")
                )
            )
            ctx["nb_locataires_actifs"] = loc_res.scalar() or 0

            # Interventions en cours
            inter_res = await db.execute(
                sa_sel(Intervention).where(
                    and_(
                        Intervention.bien_id.in_(bien_ids),
                        Intervention.statut.in_(["nouveau", "en_cours"]),
                    )
                ).limit(5)
            )
            interventions = inter_res.scalars().all()
            ctx["interventions_en_cours"] = [
                {"titre": i.titre, "categorie": i.categorie, "urgence": i.urgence, "statut": i.statut}
                for i in interventions
            ]
    except Exception:
        pass  # Degrade gracefully — still return a streamed answer

    async def _generate():
        async for chunk in chat_stream(
            message=message,
            context=ctx,
            db=db,
            user_id=str(current_user.id),
        ):
            yield chunk

    return StreamingResponse(
        _generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── POST /briefing-quotidien ──────────────────────────────────────────────────

@router.post("/briefing-quotidien")
async def briefing_quotidien(
    current_user: AuthUserDep,
    db: DbDep,
) -> dict:
    """
    Déclenche la génération du briefing quotidien pour tous les utilisateurs actifs.
    Réservé aux super_admin — le job tourne aussi automatiquement à 07h00.
    """
    if current_user.role != "super_admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Réservé aux super_admin")

    from app.tasks.ai_tasks import daily_briefing_all_users
    task = daily_briefing_all_users.delay()
    return {"task_id": task.id, "status": "queued"}


# ── POST /scoring-locataire ───────────────────────────────────────────────────

class ScoringLocataireRequest(BaseModel):
    locataire_id: _uuid.UUID


class ScoringLocataireResponse(BaseModel):
    locataire_id: _uuid.UUID
    ponctualite: float
    solvabilite: float
    communication: float
    etat_logement: float
    score_global: float
    nb_retards: int
    resume: str


@router.post("/scoring-locataire", response_model=ScoringLocataireResponse)
async def scoring_locataire(
    payload: ScoringLocataireRequest,
    current_user: AuthUserDep,
    db: DbDep,
    _=rate_limit(20, 60),
) -> ScoringLocataireResponse:
    """
    Calcule le score d'un locataire à partir de ses paiements et dossier,
    génère un résumé via Claude, et sauvegarde dans scoring_locataires.
    """
    from anthropic import AsyncAnthropic
    from app.core.config import settings
    from app.models.locataire import DossierLocataire, Locataire
    from app.models.paiement import Paiement
    from app.models.scoring import ScoringLocataire
    from datetime import datetime, timezone
    from sqlalchemy import and_, select as sa_sel

    loc_res = await db.execute(sa_sel(Locataire).where(Locataire.id == payload.locataire_id))
    loc = loc_res.scalar_one_or_none()
    if not loc:
        raise HTTPException(404, "Locataire introuvable")

    # Fetch paiements
    paie_res = await db.execute(
        sa_sel(Paiement).where(Paiement.locataire_id == payload.locataire_id)
    )
    paiements = paie_res.scalars().all()

    # Fetch dossier
    dos_res = await db.execute(
        sa_sel(DossierLocataire).where(DossierLocataire.locataire_id == payload.locataire_id)
    )
    dossier = dos_res.scalar_one_or_none()

    # ── Calcul ponctualité ────────────────────────────────────────────────────
    nb_retards = sum(1 for p in paiements if p.statut == "retard")
    avg_jours_retard = 0.0
    if paiements:
        retard_paiements = [p for p in paiements if p.jours_retard > 0]
        if retard_paiements:
            avg_jours_retard = sum(p.jours_retard for p in retard_paiements) / len(retard_paiements)

    ponctualite = max(0.0, min(10.0, 10.0 - (nb_retards * 0.8) - (avg_jours_retard * 0.05)))

    # ── Calcul solvabilité ────────────────────────────────────────────────────
    solvabilite = 5.0  # default
    if dossier and dossier.salaire_net and loc.loyer:
        ratio = float(loc.loyer) / float(dossier.salaire_net)
        if ratio <= 0.25:
            solvabilite = 10.0
        elif ratio <= 0.33:
            solvabilite = 8.0
        elif ratio <= 0.40:
            solvabilite = 6.0
        elif ratio <= 0.50:
            solvabilite = 4.0
        else:
            solvabilite = 2.0

    communication = 5.0  # pas de données directes
    etat_logement = 5.0  # pas de données directes

    score_global = round((ponctualite * 0.4 + solvabilite * 0.3 + communication * 0.15 + etat_logement * 0.15), 2)

    # ── Résumé Claude ─────────────────────────────────────────────────────────
    try:
        client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        prompt_data = {
            "nb_paiements": len(paiements),
            "nb_retards": nb_retards,
            "avg_jours_retard": round(avg_jours_retard, 1),
            "type_contrat": dossier.type_contrat if dossier else None,
            "anciennete_mois": dossier.anciennete if dossier else None,
            "ratio_loyer_salaire": round(float(loc.loyer or 0) / float(dossier.salaire_net or 1), 2) if dossier and dossier.salaire_net else None,
            "score_global": score_global,
        }
        resp = await client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=1024,
            system="Tu es Althy, assistante immobilière suisse. Génère un résumé concis (2-3 phrases) du profil locataire en français.",
            messages=[{"role": "user", "content": f"Données locataire : {_json.dumps(prompt_data, ensure_ascii=False)}"}],
        )
        resume = resp.content[0].text.strip()
    except Exception:
        resume = f"Score global {score_global:.1f}/10. Ponctualité {ponctualite:.1f}/10, solvabilité {solvabilite:.1f}/10."

    # ── Upsert scoring ────────────────────────────────────────────────────────
    existing_res = await db.execute(
        sa_sel(ScoringLocataire).where(ScoringLocataire.locataire_id == payload.locataire_id)
    )
    scoring = existing_res.scalar_one_or_none()

    if scoring:
        scoring.ponctualite = round(ponctualite, 2)
        scoring.solvabilite = round(solvabilite, 2)
        scoring.communication = communication
        scoring.etat_logement = etat_logement
        scoring.score_global = score_global
        scoring.nb_retards = nb_retards
        scoring.updated_at = datetime.now(timezone.utc)
    else:
        scoring = ScoringLocataire(
            locataire_id=payload.locataire_id,
            ponctualite=round(ponctualite, 2),
            solvabilite=round(solvabilite, 2),
            communication=communication,
            etat_logement=etat_logement,
            score_global=score_global,
            nb_retards=nb_retards,
            updated_at=datetime.now(timezone.utc),
        )
        db.add(scoring)

    await db.commit()

    return ScoringLocataireResponse(
        locataire_id=payload.locataire_id,
        ponctualite=round(ponctualite, 2),
        solvabilite=round(solvabilite, 2),
        communication=communication,
        etat_logement=etat_logement,
        score_global=score_global,
        nb_retards=nb_retards,
        resume=resume,
    )


# ── POST /generer-document ────────────────────────────────────────────────────

class GenererDocumentRequest(BaseModel):
    type: str  # bail | quittance | edl | relance
    bien_id: _uuid.UUID
    locataire_id: _uuid.UUID | None = None
    params: dict = {}


class GenererDocumentResponse(BaseModel):
    document_id: _uuid.UUID
    url: str
    type: str


@router.post("/generer-document", response_model=GenererDocumentResponse)
async def generer_document(
    payload: GenererDocumentRequest,
    current_user: AuthUserDep,
    db: DbDep,
    _=rate_limit(5, 60),
) -> GenererDocumentResponse:
    """
    Génère un document (bail, quittance, EDL, relance) via Claude,
    crée un PDF et le stocke dans Supabase Storage.
    """
    import io
    from anthropic import AsyncAnthropic
    from app.core.config import settings
    from app.models.bien import Bien
    from app.models.document_althy import DocumentAlthy
    from app.models.locataire import DossierLocataire, Locataire
    from datetime import date, datetime, timezone
    from fpdf import FPDF
    from sqlalchemy import select as sa_sel
    import httpx

    DOC_TYPES = {"bail", "quittance", "edl", "relance"}
    if payload.type not in DOC_TYPES:
        raise HTTPException(422, f"type doit être l'un de : {', '.join(DOC_TYPES)}")

    # ── Fetch bien ────────────────────────────────────────────────────────────
    bien_res = await db.execute(sa_sel(Bien).where(Bien.id == payload.bien_id))
    bien = bien_res.scalar_one_or_none()
    if not bien:
        raise HTTPException(404, "Bien introuvable")

    # ── Fetch locataire (optional) ────────────────────────────────────────────
    loc_data: dict = {}
    if payload.locataire_id:
        loc_res = await db.execute(sa_sel(Locataire).where(Locataire.id == payload.locataire_id))
        loc = loc_res.scalar_one_or_none()
        if loc:
            loc_data = {
                "loyer": float(loc.loyer or 0),
                "charges": float(loc.charges or 0),
                "date_entree": loc.date_entree.isoformat() if loc.date_entree else None,
                "date_sortie": loc.date_sortie.isoformat() if loc.date_sortie else None,
            }
            dos_res = await db.execute(
                sa_sel(DossierLocataire).where(DossierLocataire.locataire_id == payload.locataire_id)
            )
            dossier = dos_res.scalar_one_or_none()
            if dossier:
                loc_data["employeur"] = dossier.employeur
                loc_data["type_contrat"] = dossier.type_contrat

    # ── Build prompt ──────────────────────────────────────────────────────────
    bien_info = f"{bien.adresse}, {bien.cp} {bien.ville} ({bien.type})"
    today_str = date.today().strftime("%d/%m/%Y")
    params_str = _json.dumps(payload.params, ensure_ascii=False) if payload.params else "{}"

    type_prompts = {
        "bail": (
            f"Génère un bail à loyer conforme au droit suisse (CO art. 253 ss) pour le bien : {bien_info}. "
            f"Données locataire : {_json.dumps(loc_data, ensure_ascii=False)}. "
            f"Paramètres supplémentaires : {params_str}. "
            "Structure : parties, objet, loyer/charges, durée, résiliation, dépôt, clauses spéciales. "
            "Sois complet et professionnel."
        ),
        "quittance": (
            f"Génère une quittance de loyer pour : {bien_info}, date : {today_str}. "
            f"Données : {_json.dumps(loc_data, ensure_ascii=False)}. Params : {params_str}. "
            "Inclure : désignation du bien, montant loyer + charges, période, signature propriétaire."
        ),
        "edl": (
            "Génère un état des lieux "
            + ("d'entrée" if payload.params.get("type") == "entree" else "de sortie")
            + f" pour : {bien_info}, date : {today_str}. "
            f"Params : {params_str}. "
            "Structure : pièces (entrée, séjour, cuisine, salle de bain, chambres, WC, extérieur), "
            "état de chaque élément, compteurs, clés remises. Format structuré et professionnel."
        ),
        "relance": (
            f"Rédige une lettre de relance pour loyer impayé concernant le bien : {bien_info}. "
            f"Date : {today_str}. Données : {_json.dumps(loc_data, ensure_ascii=False)}. "
            f"Params : {params_str}. "
            "Ton professionnel mais ferme. Mentionner le montant dû, la date d'échéance, "
            "et les conséquences légales suisses en cas de non-paiement (CO art. 257d)."
        ),
    }

    # ── Claude generation ─────────────────────────────────────────────────────
    try:
        client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        response = await client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=4096,
            system="Tu es Althy, assistante immobilière suisse experte en droit du bail. "
                   "Génère des documents juridiques précis et conformes au droit suisse.",
            messages=[{"role": "user", "content": type_prompts[payload.type]}],
        )
        doc_text = response.content[0].text.strip()
    except RuntimeError as exc:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, str(exc))

    # ── PDF generation ────────────────────────────────────────────────────────
    pdf = FPDF()
    pdf.set_margins(20, 20, 20)
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(0, 10, f"Althy — {payload.type.upper()} — {today_str}", ln=True, align="C")
    pdf.ln(5)
    pdf.set_font("Helvetica", size=10)
    for line in doc_text.split("\n"):
        pdf.multi_cell(0, 6, line if line else " ")

    pdf_bytes = pdf.output()

    # ── Upload to Supabase Storage ────────────────────────────────────────────
    ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    storage_path = f"documents/{payload.type}/{payload.bien_id}/{ts}.pdf"

    async with httpx.AsyncClient(timeout=30.0) as http:
        upload_resp = await http.post(
            f"{settings.SUPABASE_URL}/storage/v1/object/althy-docs/{storage_path}",
            content=bytes(pdf_bytes),
            headers={
                "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
                "Content-Type": "application/pdf",
            },
        )
        if upload_resp.status_code not in (200, 201):
            raise HTTPException(500, f"Erreur upload Supabase: {upload_resp.text}")

    public_url = f"{settings.SUPABASE_URL}/storage/v1/object/public/althy-docs/{storage_path}"

    # ── Save document record ──────────────────────────────────────────────────
    doc_type_map = {
        "bail": "bail",
        "quittance": "quittance",
        "edl": "edl_entree" if payload.params.get("type") != "sortie" else "edl_sortie",
        "relance": "autre",
    }

    doc = DocumentAlthy(
        bien_id=payload.bien_id,
        locataire_id=payload.locataire_id,
        type=doc_type_map[payload.type],
        url_storage=public_url,
        date_document=date.today(),
        genere_par_ia=True,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    return GenererDocumentResponse(
        document_id=doc.id,
        url=public_url,
        type=payload.type,
    )


# ── Property estimation (lead magnet) ─────────────────────────────────────────

class EstimateRequest(BaseModel):
    address: str
    city: str
    property_type: str = "apartment"  # apartment | house | villa | commercial
    surface: float | None = None
    rooms: int | None = None
    year_built: int | None = None
    condition: str = "good"  # new | good | average | poor


class EstimateResponse(BaseModel):
    sale_price_min: int
    sale_price_max: int
    rent_monthly_min: int
    rent_monthly_max: int
    rent_seasonal_week: int | None
    rent_nightly: int | None
    gross_yield_pct: float
    price_per_sqm: int | None
    ai_comment: str
    confidence: str  # high | medium | low


# City-based fallback price/m² (CHF)
_CITY_PRICES: dict[str, int] = {
    "genève": 13500, "geneva": 13500, "ge": 13500,
    "zürich": 13000, "zurich": 13000, "zuerich": 13000,
    "lausanne": 10500, "vaud": 9000,
    "berne": 8500, "bern": 8500,
    "bâle": 9000, "basel": 9000, "bale": 9000,
    "zug": 14000, "zoug": 14000,
    "lugano": 9500,
    "neuchâtel": 7500, "neuchatel": 7500,
    "fribourg": 7000,
}


def _price_per_sqm(city: str) -> int:
    city_lower = city.lower().strip()
    for key, price in _CITY_PRICES.items():
        if key in city_lower:
            return price
    return 7500  # Swiss average fallback


@router.post("/estimate", response_model=EstimateResponse)
async def estimate_property(body: EstimateRequest):
    """Public estimation endpoint — no auth required (lead magnet)."""
    p_sqm = _price_per_sqm(body.city)

    if body.surface and body.surface > 0:
        mid_price = int(p_sqm * body.surface)
        price_min = int(mid_price * 0.88)
        price_max = int(mid_price * 1.12)
        rent_monthly = int(body.surface * 25)  # ~CHF 25/m²/month in CH
    else:
        # No surface: estimate based on rooms
        rooms = body.rooms or 3
        estimated_surface = rooms * 30  # rough ~30m² per room
        mid_price = int(p_sqm * estimated_surface)
        price_min = int(mid_price * 0.85)
        price_max = int(mid_price * 1.15)
        rent_monthly = int(estimated_surface * 25)

    rent_min = int(rent_monthly * 0.88)
    rent_max = int(rent_monthly * 1.12)

    gross_yield = round((rent_monthly * 12 / mid_price) * 100, 1)

    city_lower = body.city.lower()
    is_tourist = any(k in city_lower for k in ["genève", "geneva", "lausanne", "verbier", "zermatt", "lugano"])
    rent_seasonal_week = int(rent_monthly * 0.4) if is_tourist else None
    rent_nightly = int(rent_monthly / 15) if is_tourist else None

    surface_text = f"{int(body.surface)}m² · " if body.surface else ""
    ai_comment = (
        f"Estimation basée sur le marché immobilier de {body.city} ({surface_text}"
        f"prix moyen CHF {p_sqm:,}/m²). "
        f"Rendement brut estimé de {gross_yield}% — "
        + ("excellent pour la Suisse romande." if gross_yield >= 5 else
           "dans la moyenne suisse." if gross_yield >= 3.5 else
           "typique des marchés premium suisses.")
    )

    return EstimateResponse(
        sale_price_min=price_min,
        sale_price_max=price_max,
        rent_monthly_min=rent_min,
        rent_monthly_max=rent_max,
        rent_seasonal_week=rent_seasonal_week,
        rent_nightly=rent_nightly,
        gross_yield_pct=gross_yield,
        price_per_sqm=p_sqm if body.surface else None,
        ai_comment=ai_comment,
        confidence="medium" if body.surface else "low",
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Scan factures — OCR + extraction IA + affectation OBLF suisse
# ═══════════════════════════════════════════════════════════════════════════════

OBLF_CATEGORIES = {
    "entretien": "Entretien courant (nettoyage, jardinage, petites réparations)",
    "reparation": "Réparations (électricité, plomberie, toiture, carrelage)",
    "assurance": "Assurances (bâtiment, RC, incendie, dégâts d'eau)",
    "impots": "Impôts et taxes (foncier, déchets, eaux usées)",
    "frais_admin": "Frais administratifs (gérance, courrier recommandé, notaire)",
    "amortissement": "Amortissement et entretien différé",
    "autre": "Autre charge locative",
}


class ScanFactureResponse(BaseModel):
    id: _uuid.UUID
    montant: float | None
    fournisseur: str | None
    date_facture: str | None
    description: str | None
    numero_facture: str | None
    categorie_oblf: str | None
    sous_categorie: str | None
    bien_id: _uuid.UUID | None
    bien_adresse: str | None
    statut: str
    confidence: float


class ConfirmerFactureRequest(BaseModel):
    depense_id: _uuid.UUID
    bien_id: _uuid.UUID
    categorie_oblf: str
    montant: float | None = None
    description: str | None = None


@router.post("/scan-facture", response_model=ScanFactureResponse)
async def scan_facture(
    request: Request,
    current_user: AuthUserDep,
    db: DbDep,
    _=rate_limit(20, 60),
):
    """
    Scan une facture (image JPEG/PNG/WEBP ou PDF) via Claude Vision.
    Extrait montant, fournisseur, date, description, numéro.
    Propose une catégorie OBLF et un bien de rattachement.
    Body : multipart/form-data avec champ 'file'.
    """
    import base64
    import io as _io
    import httpx
    from datetime import date as _date, datetime, timezone
    from anthropic import AsyncAnthropic
    from app.core.config import settings
    from app.models.bien import Bien
    from sqlalchemy import select as sa_sel, text as sa_text

    form = await request.form()
    file = form.get("file")
    if not file or not hasattr(file, "read"):
        raise HTTPException(422, "Champ 'file' requis (image ou PDF)")

    file_bytes = await file.read()  # type: ignore[union-attr]
    content_type: str = getattr(file, "content_type", None) or "image/jpeg"
    filename: str = getattr(file, "filename", None) or "facture"

    # Detect media type
    fn_lower = filename.lower()
    if fn_lower.endswith((".jpg", ".jpeg")) or "jpeg" in content_type:
        media_type = "image/jpeg"
    elif fn_lower.endswith(".png") or "png" in content_type:
        media_type = "image/png"
    elif fn_lower.endswith(".webp") or "webp" in content_type:
        media_type = "image/webp"
    elif fn_lower.endswith(".gif"):
        media_type = "image/gif"
    else:
        media_type = "pdf"

    # Upload to Supabase Storage
    ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    storage_path = f"factures/{current_user.id}/{ts}_{filename}"
    public_url: str | None = None
    async with httpx.AsyncClient(timeout=30.0) as http:
        up = await http.post(
            f"{settings.SUPABASE_URL}/storage/v1/object/althy-docs/{storage_path}",
            content=file_bytes,
            headers={
                "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
                "Content-Type": content_type,
            },
        )
        if up.status_code in (200, 201):
            public_url = f"{settings.SUPABASE_URL}/storage/v1/object/public/althy-docs/{storage_path}"

    # Build Claude prompt
    OBLF_LIST = "\n".join(f"- {k}: {v}" for k, v in OBLF_CATEGORIES.items())
    extraction_prompt = (
        "Analyse cette facture et extrais les informations suivantes.\n\n"
        f"Catégories OBLF disponibles (droit suisse du bail) :\n{OBLF_LIST}\n\n"
        "Retourne UNIQUEMENT ce JSON (pas de markdown) :\n"
        '{"montant":<float|null>,"fournisseur":"<str|null>","date_facture":"<YYYY-MM-DD|null>",'
        '"description":"<str|null>","numero_facture":"<str|null>",'
        '"categorie_oblf":"<clé|null>","sous_categorie":"<str|null>","confidence":<0.0-1.0>}'
    )

    extracted: dict = {}
    try:
        client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        if media_type != "pdf":
            b64 = base64.standard_b64encode(file_bytes).decode()
            msg = await client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=400,
                messages=[{"role": "user", "content": [
                    {"type": "text", "text": extraction_prompt},
                    {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}},
                ]}],
            )
        else:
            try:
                import pdfplumber
                with pdfplumber.open(_io.BytesIO(file_bytes)) as pdf:
                    pdf_text = "\n".join(p.extract_text() or "" for p in pdf.pages)
            except Exception:
                pdf_text = "(Contenu PDF non lisible)"
            msg = await client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=400,
                messages=[{"role": "user", "content": f"{extraction_prompt}\n\nContenu PDF:\n{pdf_text[:3000]}"}],
            )

        raw = msg.content[0].text.strip()  # type: ignore[union-attr]
        if "```" in raw:
            raw = raw.split("```")[1].lstrip("json").strip()
        extracted = _json.loads(raw)
    except Exception:
        extracted = {"confidence": 0.3}

    # Find the most likely bien for this owner
    biens_rows = (await db.execute(
        sa_sel(Bien).where(Bien.owner_id == current_user.id, Bien.is_active.is_(True)).limit(1)
    )).scalars().all()
    bien_id = biens_rows[0].id if biens_rows else None
    bien_adresse = f"{biens_rows[0].adresse}, {biens_rows[0].ville}" if biens_rows else None

    # Parse date
    date_str = extracted.get("date_facture")
    date_parsed = None
    if date_str:
        try:
            date_parsed = _date.fromisoformat(str(date_str))
        except (ValueError, TypeError):
            pass

    # Insert into DB
    insert_row = (await db.execute(
        sa_text("""
            INSERT INTO depenses_scannees
                (owner_id, bien_id, montant, fournisseur, date_facture, description,
                 numero_facture, categorie_oblf, sous_categorie, url_fichier_source, media_type)
            VALUES
                (:owner_id, :bien_id, :montant, :fournisseur, :date_facture, :description,
                 :numero_facture, :categorie_oblf, :sous_categorie, :url, :media_type)
            RETURNING id
        """),
        {
            "owner_id": str(current_user.id), "bien_id": str(bien_id) if bien_id else None,
            "montant": extracted.get("montant"), "fournisseur": extracted.get("fournisseur"),
            "date_facture": date_parsed, "description": extracted.get("description"),
            "numero_facture": extracted.get("numero_facture"),
            "categorie_oblf": extracted.get("categorie_oblf"),
            "sous_categorie": extracted.get("sous_categorie"),
            "url": public_url, "media_type": media_type,
        },
    )).fetchone()
    await db.commit()

    return ScanFactureResponse(
        id=insert_row[0] if insert_row else _uuid.uuid4(),
        montant=extracted.get("montant"),
        fournisseur=extracted.get("fournisseur"),
        date_facture=extracted.get("date_facture"),
        description=extracted.get("description"),
        numero_facture=extracted.get("numero_facture"),
        categorie_oblf=extracted.get("categorie_oblf"),
        sous_categorie=extracted.get("sous_categorie"),
        bien_id=bien_id,
        bien_adresse=bien_adresse,
        statut="propose",
        confidence=float(extracted.get("confidence", 0.3)),
    )


@router.post("/confirmer-facture")
async def confirmer_facture(
    payload: ConfirmerFactureRequest,
    current_user: AuthUserDep,
    db: DbDep,
) -> dict:
    """Proprio confirme/corrige l'affectation d'une dépense scannée."""
    from sqlalchemy import text as sa_text
    await db.execute(
        sa_text("""
            UPDATE depenses_scannees
            SET bien_id = :bien_id, categorie_oblf = :cat,
                montant = COALESCE(:montant, montant),
                description = COALESCE(:desc, description),
                statut = 'confirme', confirme_par_user = true, updated_at = now()
            WHERE id = :id AND owner_id = :uid
        """),
        {
            "id": str(payload.depense_id), "uid": str(current_user.id),
            "bien_id": str(payload.bien_id), "cat": payload.categorie_oblf,
            "montant": payload.montant, "desc": payload.description,
        },
    )
    await db.commit()
    return {"confirmed": True, "depense_id": str(payload.depense_id)}


@router.get("/depenses-scannees")
async def list_depenses_scannees(
    current_user: AuthUserDep,
    db: DbDep,
    bien_id: _uuid.UUID | None = None,
    statut: str | None = None,
) -> list[dict]:
    """Liste les factures scannées de l'utilisateur."""
    from sqlalchemy import text as sa_text
    where = "WHERE owner_id = :uid"
    params: dict = {"uid": str(current_user.id)}
    if bien_id:
        where += " AND bien_id = :bid"
        params["bid"] = str(bien_id)
    if statut:
        where += " AND statut = :s"
        params["s"] = statut

    rows = (await db.execute(
        sa_text(f"SELECT id, montant, fournisseur, date_facture, description, categorie_oblf, statut, bien_id FROM depenses_scannees {where} ORDER BY created_at DESC LIMIT 50"),
        params,
    )).fetchall()

    return [
        {
            "id": str(r[0]), "montant": float(r[1]) if r[1] else None,
            "fournisseur": r[2], "date_facture": r[3].isoformat() if r[3] else None,
            "description": r[4], "categorie_oblf": r[5],
            "statut": r[6], "bien_id": str(r[7]) if r[7] else None,
        }
        for r in rows
    ]


@router.get("/export/etat-locatif")
async def export_etat_locatif(
    current_user: AuthUserDep,
    db: DbDep,
    year: int = 2025,
):
    """Export état locatif annuel au format CSV (fiduciaire suisse, encodage UTF-8 BOM pour Excel)."""
    import io
    import csv
    from fastapi.responses import StreamingResponse
    from sqlalchemy import text as sa_text

    rows = (await db.execute(
        sa_text("""
            SELECT
                to_char(p.date_echeance, 'YYYY-MM') AS mois,
                b.adresse, b.ville,
                COALESCE(u.email, 'N/A')           AS locataire,
                p.montant                            AS loyer_attendu,
                CASE WHEN p.statut = 'recu' THEN p.montant ELSE 0 END AS loyer_recu,
                COALESCE(l.charges, 0)               AS charges,
                CASE WHEN p.statut = 'recu' THEN COALESCE(p.net_montant, p.montant * 0.96) ELSE NULL END AS net,
                p.statut
            FROM paiements p
            JOIN biens b ON b.id = p.bien_id
            JOIN locataires l ON l.id = p.locataire_id
            LEFT JOIN users u ON u.id = l.user_id
            WHERE b.owner_id = :uid
              AND EXTRACT(YEAR FROM p.date_echeance) = :year
            ORDER BY p.date_echeance, b.adresse
        """),
        {"uid": str(current_user.id), "year": year},
    )).fetchall()

    buf = io.StringIO()
    writer = csv.writer(buf, delimiter=";")
    writer.writerow(["Mois", "Adresse", "Ville", "Locataire", "Loyer attendu CHF",
                     "Loyer reçu CHF", "Charges CHF", "Net reçu CHF", "Statut"])
    for r in rows:
        writer.writerow([
            r[0], r[1], r[2], r[3],
            f"{float(r[4] or 0):.2f}", f"{float(r[5] or 0):.2f}",
            f"{float(r[6] or 0):.2f}", f"{float(r[7] or 0):.2f}" if r[7] else "",
            r[8],
        ])
    buf.seek(0)

    return StreamingResponse(
        iter([buf.getvalue().encode("utf-8-sig")]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=etat_locatif_{year}.csv"},
    )
