"""ai_sphere.py — Chat, briefing, voice, agency-advisor, parse-contract-params."""

from __future__ import annotations

import json as _json
import re as _re
import uuid as _uuid
from typing import Annotated

from app.core.database import get_db
from app.core.limiter import rate_limit
from app.core.security import get_current_user
from app.models.user import User
from app.services.ai_service import chat_stream, generate_briefing
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/ai", tags=["ai"])

DbDep       = Annotated[AsyncSession, Depends(get_db)]
AuthUserDep = Annotated[User, Depends(get_current_user)]


# ── Schemas ───────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    context: dict = {}


class CopilotResponse(BaseModel):
    response: str


class VoiceActionRequest(BaseModel):
    transcript: str


class AdvisorRequest(BaseModel):
    question: str
    context: dict = {}


class ContractParamsRequest(BaseModel):
    description: str


class RedigerDescriptionRequest(BaseModel):
    type_publication: str
    type_intervention: str
    adresse_bien: str | None = None
    description_contexte: str | None = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/copilot", response_model=CopilotResponse)
async def copilot(
    payload: ChatRequest,
    current_user: AuthUserDep,
    db: DbDep,
) -> CopilotResponse:
    """Non-streaming copilot — collects the full Claude response and returns it."""
    user_name = current_user.first_name or (current_user.email or "").split("@")[0]
    context = {**payload.context, "role": current_user.role, "user_name": user_name}
    parts: list[str] = []
    async for chunk in chat_stream(
        message=payload.message,
        context=context,
        db=db,
        user_id=str(current_user.id),
    ):
        if chunk.startswith("data: ") and chunk.strip() != "data: [DONE]":
            import json as _j
            try:
                parsed = _j.loads(chunk[6:].strip())
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
    """Conversational copilot — streams SSE events."""
    user_name = current_user.first_name or (current_user.email or "").split("@")[0]
    context = {**payload.context, "role": current_user.role, "user_name": user_name}

    async def _generate():
        async for chunk in chat_stream(
            message=payload.message, context=context, db=db, user_id=str(current_user.id),
        ):
            yield chunk

    return StreamingResponse(
        _generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/chat")
async def chat_get(
    current_user: AuthUserDep,
    db: DbDep,
    message: str = Query(..., description="Message de l'utilisateur"),
    _=rate_limit(20, 60),
) -> StreamingResponse:
    """SSE streaming chat avec contexte auto-injecté (biens, locataires, interventions)."""
    from app.models.bien import Bien
    from app.models.intervention import Intervention
    from app.models.locataire import Locataire
    from sqlalchemy import and_, func, select as sa_sel

    uid = current_user.id
    ctx: dict = {"role": current_user.role, "user_name": current_user.first_name or ""}

    try:
        biens_count = (await db.execute(
            sa_sel(func.count()).select_from(Bien).where(Bien.owner_id == uid)
        )).scalar() or 0
        ctx["nb_biens"] = biens_count

        biens_res = await db.execute(sa_sel(Bien).where(Bien.owner_id == uid).limit(10))
        biens = biens_res.scalars().all()
        bien_ids = [b.id for b in biens]
        ctx["biens"] = [{"adresse": b.adresse, "ville": b.ville, "statut": b.statut} for b in biens]

        if bien_ids:
            loc_res = await db.execute(
                sa_sel(func.count()).select_from(Locataire).where(
                    and_(Locataire.bien_id.in_(bien_ids), Locataire.statut == "actif")
                )
            )
            ctx["nb_locataires_actifs"] = loc_res.scalar() or 0

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
        pass

    async def _generate():
        async for chunk in chat_stream(
            message=message, context=ctx, db=db, user_id=str(current_user.id),
        ):
            yield chunk

    return StreamingResponse(
        _generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/voice-action")
async def voice_action(
    payload: VoiceActionRequest,
    current_user: AuthUserDep,
    db: DbDep,
    _=rate_limit(10, 60),
):
    """Analyse un message vocal et exécute l'action détectée."""
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
    "address": null, "city": null, "zip_code": null,
    "surface": null, "rooms": null, "monthly_rent": null,
    "charges": null, "deposit": null,
    "status": "available", "is_furnished": false, "has_parking": false, "country": "CH"
  }}
}}

Règles :
- "create_property" si l'utilisateur veut ajouter/créer un bien immobilier
- "navigate" si l'utilisateur veut aller sur une page
- "question" pour toute autre demande
- Extrais les détails du bien si intent=create_property
- type : "apartment"=appartement, "house"=maison/villa, "studio"=studio
"""}]
    )

    raw = response.content[0].text.strip()
    if "```" in raw:
        raw = raw.split("```")[1].lstrip("json").strip()

    try:
        result = _json.loads(raw)
    except Exception:
        return {"intent": "question", "message": "Je n'ai pas compris. Reformulez votre demande.", "property": None}

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
            result["message"] = f"Bien créé : {new_prop.type} à {new_prop.city or new_prop.address}."
        else:
            result["intent"] = "need_more_info"
            result["message"] = "J'ai besoin d'une adresse ou d'une ville pour créer le bien."

    return result


@router.get("/briefing")
async def get_briefing(
    current_user: AuthUserDep,
    db: DbDep,
) -> dict:
    """Generate a personalised home screen briefing based on real data."""
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
            res = await db.execute(
                select(Txn).where(
                    Txn.owner_id == uid, Txn.status.in_(["pending", "late"]),
                    Txn.due_date <= today, Txn.is_active.is_(True),
                ).limit(5)
            )
            late = res.scalars().all()
            context["late_transactions"] = [
                {"id": str(t.id), "amount": float(t.amount),
                 "due_date": t.due_date.isoformat() if t.due_date else None,
                 "days_late": (today - t.due_date).days if t.due_date else 0,
                 "reference": t.reference}
                for t in late
            ]
            res = await db.execute(
                select(Contract).where(
                    Contract.owner_id == uid, Contract.status == "active",
                    Contract.end_date.isnot(None),
                    Contract.end_date <= today + timedelta(days=60),
                    Contract.end_date >= today,
                ).limit(3)
            )
            expiring = res.scalars().all()
            context["expiring_contracts"] = [
                {"id": str(c.id), "end_date": c.end_date.isoformat() if c.end_date else None,
                 "days_left": (c.end_date - today).days if c.end_date else 0,
                 "monthly_rent": float(c.monthly_rent) if c.monthly_rent else 0}
                for c in expiring
            ]
            res = await db.execute(
                select(PropertyModel).where(
                    PropertyModel.owner_id == uid, PropertyModel.status == "available",
                    PropertyModel.is_active.is_(True),
                ).limit(3)
            )
            vacant = res.scalars().all()
            context["vacant_properties"] = [
                {"id": str(p.id), "address": p.address, "city": p.city,
                 "monthly_rent": float(p.monthly_rent) if p.monthly_rent else 0}
                for p in vacant
            ]

        elif role == "opener":
            res = await db.execute(
                select(Mission).where(Mission.status == "pending", Mission.opener_id.is_(None)).limit(5)
            )
            missions = res.scalars().all()
            context["available_missions"] = [
                {"id": str(m.id), "type": m.type,
                 "scheduled_at": m.scheduled_at.isoformat() if m.scheduled_at else None,
                 "price": float(m.price) if m.price else 0}
                for m in missions
            ]

        elif role == "tenant":
            res = await db.execute(
                select(Contract).where(Contract.tenant_id == uid, Contract.status == "active").limit(2)
            )
            contracts = res.scalars().all()
            context["active_contracts"] = [
                {"id": str(c.id), "end_date": c.end_date.isoformat() if c.end_date else None,
                 "monthly_rent": float(c.monthly_rent) if c.monthly_rent else 0}
                for c in contracts
            ]
            res = await db.execute(
                select(Txn).where(
                    Txn.tenant_id == uid, Txn.status == "pending", Txn.due_date >= today,
                ).order_by(Txn.due_date).limit(3)
            )
            upcoming = res.scalars().all()
            context["upcoming_payments"] = [
                {"id": str(t.id), "amount": float(t.amount),
                 "due_date": t.due_date.isoformat() if t.due_date else None}
                for t in upcoming
            ]

        elif role == "company":
            res = await db.execute(select(RFQ).where(RFQ.status == "published").limit(5))
            rfqs = res.scalars().all()
            context["open_rfqs"] = [
                {"id": str(r.id), "title": r.title, "category": r.category, "city": r.city,
                 "budget_min": float(r.budget_min) if r.budget_min else 0,
                 "budget_max": float(r.budget_max) if r.budget_max else 0,
                 "urgency": r.urgency}
                for r in rfqs
            ]

    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning("Briefing context fetch failed: %s", exc)

    try:
        return await generate_briefing(
            first_name=first_name, role=role, context=context,
            db=db, user_id=str(current_user.id),
        )
    except RuntimeError as exc:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, str(exc))


@router.post("/agency-advisor")
async def agency_advisor(
    payload: AdvisorRequest,
    current_user: AuthUserDep,
    db: DbDep,
    _=rate_limit(15, 60),
):
    """Conseiller IA spécialisé pour agences et propriétaires."""
    from anthropic import AsyncAnthropic
    from app.core.config import settings
    from app.models.contract import Contract
    from app.models.transaction import Transaction
    from sqlalchemy import select as sa_sel, and_

    if current_user.role not in ("agency", "owner", "super_admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Réservé aux agences et propriétaires")

    client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    contracts = (await db.execute(
        sa_sel(Contract).where(
            and_(Contract.is_active.is_(True),
                 (Contract.owner_id == current_user.id) | (Contract.agency_id == current_user.id))
        ).limit(20)
    )).scalars().all()

    late_tx = (await db.execute(
        sa_sel(Transaction).where(
            and_(Transaction.owner_id == current_user.id,
                 Transaction.status == "late", Transaction.is_active.is_(True))
        ).limit(10)
    )).scalars().all()

    context_data = {
        "nb_contrats_actifs":   len([c for c in contracts if c.status == "active"]),
        "nb_contrats_brouillon": len([c for c in contracts if c.status == "draft"]),
        "nb_loyers_en_retard":  len(late_tx),
        "types_contrats":       list({c.type for c in contracts}),
        **(payload.context or {}),
    }

    role_label = "agence immobilière" if current_user.role == "agency" else "propriétaire"
    system = f"""Tu es AlthyLegal, conseiller IA expert en droit immobilier suisse (CO, LDTR, bail à loyer).
Tu conseilles {current_user.first_name or 'l\'utilisateur'}, {role_label}.

Données de son portefeuille :
{_json.dumps(context_data, ensure_ascii=False)}

Tu peux conseiller sur :
- Conformité juridique des baux (durée, loyer initial, hausses, résiliation)
- Qualité des états des lieux et ce qui doit être documenté
- Optimisation des paiements et gestion des retards
- Commissions de gérance (taux légaux suisses)
- Dépôts de garantie (max 3 mois selon CO art. 257e)
- Baux saisonniers vs longue durée

Réponds en français, cite les articles de loi suisses si pertinent. Sois direct et actionnable. Max 300 mots."""

    response = await client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=600,
        system=system,
        messages=[{"role": "user", "content": payload.question}],
    )
    return {"advice": response.content[0].text.strip()}


@router.post("/parse-contract-params")
async def parse_contract_params(
    payload: ContractParamsRequest,
    current_user: AuthUserDep,
    _=rate_limit(20, 60),
):
    """Parse une description en langage naturel → paramètres de contrat structurés."""
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
  "deposit_months": <nombre de mois (max 3 selon CO) ou null>,
  "notice_months": <préavis en mois ou null>,
  "min_duration_months": <durée minimale en mois ou null>,
  "rent_increase_pct": <hausse annuelle max en % ou null>,
  "included_charges": true/false,
  "management_fee_pct": <honoraires de gérance % ou null>,
  "ai_recommendations": ["recommandation 1", "recommandation 2"],
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


@router.post("/briefing-quotidien")
async def briefing_quotidien(
    current_user: AuthUserDep,
    db: DbDep,
) -> dict:
    """Déclenche la génération du briefing quotidien. Réservé aux super_admin."""
    if current_user.role != "super_admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Réservé aux super_admin")

    from app.tasks.ai_tasks import daily_briefing_all_users
    task = daily_briefing_all_users.delay()
    return {"task_id": task.id, "status": "queued"}


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
    """Génère une description professionnelle pour une mission ou devis en streaming SSE."""
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

    context = {"page": "publications/new", "role": current_user.role, "user_name": current_user.first_name or ""}

    async def _generate():
        async for chunk in chat_stream(
            message=prompt, context=context, db=db, user_id=str(current_user.id),
        ):
            yield chunk

    return StreamingResponse(
        _generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
