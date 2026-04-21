"""ai_scoring.py — Score-tenant, anomalies, scoring-locataire, recommend-quote."""

from __future__ import annotations

import json as _json
import uuid as _uuid
from typing import Annotated

from app.core.database import get_db
from app.core.limiter import rate_limit
from app.core.security import get_current_user
from app.models.user import User
from app.services.ai_service import (
    PaymentAlert,
    QuoteRecommendation,
    TenantScore,
    detect_payment_anomalies,
    recommend_best_quote,
    score_tenant_application,
)
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(tags=["ai"])

DbDep       = Annotated[AsyncSession, Depends(get_db)]
AuthUserDep = Annotated[User, Depends(get_current_user)]


# ── Schemas ───────────────────────────────────────────────────────────────────

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


class AnomalyResponse(BaseModel):
    type: str
    severity: str
    description: str
    property_id: str | None
    tenant_id: str | None


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


# ── Endpoints ─────────────────────────────────────────────────────────────────

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
            type=a.type, severity=a.severity, description=a.description,
            property_id=a.property_id, tenant_id=a.tenant_id,
        )
        for a in alerts
    ]


@router.post("/scoring-locataire", response_model=ScoringLocataireResponse)
async def scoring_locataire(
    payload: ScoringLocataireRequest,
    current_user: AuthUserDep,
    db: DbDep,
    _=rate_limit(20, 60),
) -> ScoringLocataireResponse:
    """Calcule le score d'un locataire, génère un résumé via Claude, sauvegarde."""
    from anthropic import AsyncAnthropic
    from app.core.config import settings
    from app.models.locataire import DossierLocataire, Locataire
    from app.models.paiement import Paiement
    from app.models.scoring import ScoringLocataire
    from datetime import datetime, timezone
    from sqlalchemy import select as sa_sel

    loc_res = await db.execute(sa_sel(Locataire).where(Locataire.id == payload.locataire_id))
    loc = loc_res.scalar_one_or_none()
    if not loc:
        raise HTTPException(404, "Locataire introuvable")

    paie_res = await db.execute(
        sa_sel(Paiement).where(Paiement.locataire_id == payload.locataire_id)
    )
    paiements = paie_res.scalars().all()

    dos_res = await db.execute(
        sa_sel(DossierLocataire).where(DossierLocataire.locataire_id == payload.locataire_id)
    )
    dossier = dos_res.scalar_one_or_none()

    # Ponctualité
    nb_retards     = sum(1 for p in paiements if p.statut == "retard")
    avg_jours_retard = 0.0
    if paiements:
        retard_paiements = [p for p in paiements if p.jours_retard > 0]
        if retard_paiements:
            avg_jours_retard = sum(p.jours_retard for p in retard_paiements) / len(retard_paiements)
    ponctualite = max(0.0, min(10.0, 10.0 - (nb_retards * 0.8) - (avg_jours_retard * 0.05)))

    # Solvabilité
    solvabilite = 5.0
    if dossier and dossier.salaire_net and loc.loyer:
        ratio = float(loc.loyer) / float(dossier.salaire_net)
        if ratio <= 0.25:   solvabilite = 10.0
        elif ratio <= 0.33: solvabilite = 8.0
        elif ratio <= 0.40: solvabilite = 6.0
        elif ratio <= 0.50: solvabilite = 4.0
        else:               solvabilite = 2.0

    communication  = 5.0
    etat_logement  = 5.0
    score_global   = round(ponctualite * 0.4 + solvabilite * 0.3 + communication * 0.15 + etat_logement * 0.15, 2)

    # Résumé Claude
    try:
        client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        prompt_data = {
            "nb_paiements": len(paiements), "nb_retards": nb_retards,
            "avg_jours_retard": round(avg_jours_retard, 1),
            "type_contrat": dossier.type_contrat if dossier else None,
            "anciennete_mois": dossier.anciennete if dossier else None,
            "ratio_loyer_salaire": round(float(loc.loyer or 0) / float(dossier.salaire_net or 1), 2)
                                   if dossier and dossier.salaire_net else None,
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

    # Upsert
    from sqlalchemy import select as sa_sel2
    existing_res = await db.execute(
        sa_sel2(ScoringLocataire).where(ScoringLocataire.locataire_id == payload.locataire_id)
    )
    scoring = existing_res.scalar_one_or_none()

    if scoring:
        scoring.ponctualite   = round(ponctualite, 2)
        scoring.solvabilite   = round(solvabilite, 2)
        scoring.communication = communication
        scoring.etat_logement = etat_logement
        scoring.score_global  = score_global
        scoring.nb_retards    = nb_retards
        scoring.updated_at    = datetime.now(timezone.utc)
    else:
        scoring = ScoringLocataire(
            locataire_id=payload.locataire_id,
            ponctualite=round(ponctualite, 2), solvabilite=round(solvabilite, 2),
            communication=communication, etat_logement=etat_logement,
            score_global=score_global, nb_retards=nb_retards,
            updated_at=datetime.now(timezone.utc),
        )
        db.add(scoring)

    await db.commit()

    return ScoringLocataireResponse(
        locataire_id=payload.locataire_id,
        ponctualite=round(ponctualite, 2), solvabilite=round(solvabilite, 2),
        communication=communication, etat_logement=etat_logement,
        score_global=score_global, nb_retards=nb_retards, resume=resume,
    )
