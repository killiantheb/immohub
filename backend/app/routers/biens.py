"""Router FastAPI — /api/v1/biens."""

from __future__ import annotations

import uuid
from typing import Annotated

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.bien import Bien
from app.models.user import User
from app.schemas.bien import BienCreate, BienRead, BienUpdate
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

DbDep = Annotated[AsyncSession, Depends(get_db)]
AuthDep = Annotated[User, Depends(get_current_user)]

ALLOWED_OWNER_ROLES = {"super_admin", "proprio_solo", "agence"}


def _assert_can_read_bien(bien: Bien, user: User) -> None:
    if user.role in ("admin", "super_admin"):
        return
    if bien.owner_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")


def _assert_can_write_bien(bien: Bien, user: User) -> None:
    if user.role in ("admin", "super_admin"):
        return
    if bien.owner_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Modification refusée")


# ── List ──────────────────────────────────────────────────────────────────────

@router.get("", response_model=list[BienRead])
async def list_biens(
    current_user: AuthDep,
    db: DbDep,
    statut: str | None = Query(None),
    ville: str | None = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
) -> list[BienRead]:
    q = select(Bien)
    if current_user.role not in ("admin", "super_admin"):
        q = q.where(Bien.owner_id == current_user.id)
    if statut:
        q = q.where(Bien.statut == statut)
    if ville:
        q = q.where(Bien.ville.ilike(f"%{ville}%"))
    q = q.offset((page - 1) * size).limit(size)
    rows = await db.execute(q)
    return [BienRead.model_validate(r) for r in rows.scalars()]


# ── Create ────────────────────────────────────────────────────────────────────

@router.post("", response_model=BienRead, status_code=status.HTTP_201_CREATED)
async def create_bien(
    payload: BienCreate,
    current_user: AuthDep,
    db: DbDep,
) -> BienRead:
    if current_user.role not in ALLOWED_OWNER_ROLES:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Rôle insuffisant")
    bien = Bien(**payload.model_dump(), owner_id=current_user.id)
    db.add(bien)
    await db.flush()
    await db.refresh(bien)
    return BienRead.model_validate(bien)


# ── Read ──────────────────────────────────────────────────────────────────────

@router.get("/{bien_id}", response_model=BienRead)
async def get_bien(
    bien_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> BienRead:
    result = await db.execute(select(Bien).where(Bien.id == bien_id))
    bien = result.scalar_one_or_none()
    if not bien:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bien introuvable")
    _assert_can_read_bien(bien, current_user)
    return BienRead.model_validate(bien)


# ── Update ────────────────────────────────────────────────────────────────────

@router.patch("/{bien_id}", response_model=BienRead)
async def update_bien(
    bien_id: uuid.UUID,
    payload: BienUpdate,
    current_user: AuthDep,
    db: DbDep,
) -> BienRead:
    result = await db.execute(select(Bien).where(Bien.id == bien_id))
    bien = result.scalar_one_or_none()
    if not bien:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bien introuvable")
    _assert_can_write_bien(bien, current_user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(bien, field, value)
    await db.flush()
    await db.refresh(bien)
    return BienRead.model_validate(bien)


# ── Delete ────────────────────────────────────────────────────────────────────

@router.delete("/{bien_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_bien(
    bien_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> None:
    result = await db.execute(select(Bien).where(Bien.id == bien_id))
    bien = result.scalar_one_or_none()
    if not bien:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bien introuvable")
    _assert_can_write_bien(bien, current_user)
    await db.delete(bien)


# ── Potentiel IA ──────────────────────────────────────────────────────────────


from pydantic import BaseModel as _PydanticBase  # noqa: E402


class PotentielIAResponse(_PydanticBase):
    """7 blocs d'analyse IA pour un bien."""
    # Bloc 1 — Valeur estimée
    valeur_min: float
    valeur_max: float
    # Bloc 2 — Rendement
    rendement_brut: float
    rendement_net: float
    # Bloc 3 — Loyer marché
    loyer_actuel: float
    loyer_marche: float
    ecart_marche_pct: float
    # Bloc 4 — Score investissement
    score_investissement: float
    # Bloc 5 — Recommandations IA
    recommandations: list[str]
    # Bloc 6 — Conseil fiscalité CH
    conseil_fiscal: str
    # Bloc 7 — Prochaine action
    prochaine_action: str


@router.get("/{bien_id}/potentiel", response_model=PotentielIAResponse, summary="Potentiel IA du bien")
async def get_potentiel_ia(
    bien_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> PotentielIAResponse:
    """
    Compute 7 IA analysis blocs for a property.
    Uses Claude to generate textual recommendations (rate-limited).
    """
    from anthropic import AsyncAnthropic
    from app.core.config import settings

    result = await db.execute(select(Bien).where(Bien.id == bien_id))
    bien = result.scalar_one_or_none()
    if not bien:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bien introuvable")
    _assert_can_read_bien(bien, current_user)

    loyer = float(bien.loyer or 0)
    charges = float(bien.charges or 0)
    surface = float(bien.surface or 0)

    # ── Blocs 1–4 : calculs financiers ────────────────────────────────────────
    # Swiss multiplicateur : 220–250x loyer mensuel brut (marché locatif CH)
    valeur_min = round(loyer * 200, 0) if loyer > 0 else 0.0
    valeur_max = round(loyer * 260, 0) if loyer > 0 else 0.0

    loyer_net_annuel = (loyer - charges) * 12
    valeur_mid = (valeur_min + valeur_max) / 2 if valeur_max > 0 else 1

    rendement_brut = round((loyer * 12 / valeur_mid * 100), 2) if valeur_mid > 0 else 0.0
    rendement_net = round((loyer_net_annuel / valeur_mid * 100), 2) if valeur_mid > 0 else 0.0

    # Loyer marché estimé : +3–5 % au-dessus du loyer actuel (simplification)
    loyer_marche = round(loyer * 1.04, 0) if loyer > 0 else 0.0
    ecart_marche_pct = round(((loyer_marche - loyer) / loyer * 100), 1) if loyer > 0 else 0.0

    # Score investissement (0–10)
    score = 5.0
    if rendement_brut >= 4.5:
        score += 1.5
    elif rendement_brut >= 3.5:
        score += 0.5
    if bien.statut == "loue":
        score += 1.0
    if surface >= 60:
        score += 0.5
    if loyer_marche > loyer:
        score += 0.5
    score = min(10.0, round(score, 1))

    # ── Blocs 5–7 : Claude ────────────────────────────────────────────────────
    context = (
        f"Bien : {bien.type} à {bien.adresse}, {bien.cp} {bien.ville}\n"
        f"Surface : {surface} m²   Étage : {bien.etage or 'RDC'}\n"
        f"Loyer actuel : CHF {loyer}/mois   Charges : CHF {charges}/mois\n"
        f"Statut : {bien.statut}   Rendement brut estimé : {rendement_brut}%\n"
        f"Score investissement Althy : {score}/10"
    )

    try:
        client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        response = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=600,
            system=(
                "Tu es un expert immobilier suisse. "
                "Réponds en JSON valide UNIQUEMENT avec ces 3 clés : "
                '"recommandations" (liste de 3 strings, conseils actionnables courts), '
                '"conseil_fiscal" (string, 1 conseil déduction fiscale CH concis), '
                '"prochaine_action" (string, 1 action prioritaire immédiate). '
                "Pas d'autre texte."
            ),
            messages=[{"role": "user", "content": context}],
        )
        import json as _json
        raw = response.content[0].text.strip()
        ia_data = _json.loads(raw)
        recommandations: list[str] = ia_data.get("recommandations", [])[:5]
        conseil_fiscal: str = ia_data.get("conseil_fiscal", "")
        prochaine_action: str = ia_data.get("prochaine_action", "")
    except Exception:
        recommandations = [
            "Vérifier les attestations d'assurance RC des locataires",
            "Comparer le loyer actuel avec le marché local",
            "Planifier une inspection annuelle du bien",
        ]
        conseil_fiscal = "Déduisez les charges d'entretien, intérêts hypothécaires et frais de gérance de votre revenu imposable."
        prochaine_action = "Vérifier la date d'échéance du prochain loyer."

    return PotentielIAResponse(
        valeur_min=valeur_min,
        valeur_max=valeur_max,
        rendement_brut=rendement_brut,
        rendement_net=rendement_net,
        loyer_actuel=loyer,
        loyer_marche=loyer_marche,
        ecart_marche_pct=ecart_marche_pct,
        score_investissement=score,
        recommandations=recommandations,
        conseil_fiscal=conseil_fiscal,
        prochaine_action=prochaine_action,
    )
