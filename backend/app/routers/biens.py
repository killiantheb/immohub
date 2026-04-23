"""Router FastAPI — /api/v1/biens (refonte fusion 2026-04-23).

Inclut :
    - CRUD biens (list paginée, create, read detail, update, soft delete)
    - Images (add, delete)
    - Documents (add)
    - Équipements (get, set liste, remove)
    - Historique audit
    - Génération description IA
    - Potentiel IA (conservé de l'ancien router)
"""

from __future__ import annotations

import uuid
from typing import Annotated

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.bien import Bien
from app.models.user import User
from app.schemas.bien import (
    AuditLogResponse,
    BienCreate,
    BienDetail,
    BienDocumentRead,
    BienImageRead,
    BienRead,
    BienUpdate,
    CatalogueEquipementRead,
    PaginatedBiens,
    SetEquipementsRequest,
)
from app.services.bien_service import BienService
from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

DbDep = Annotated[AsyncSession, Depends(get_db)]
AuthDep = Annotated[User, Depends(get_current_user)]


# ═════════════════════════════════════════════════════════════════════════════
# CRUD biens
# ═════════════════════════════════════════════════════════════════════════════


@router.get("", response_model=PaginatedBiens)
async def list_biens(
    current_user: AuthDep,
    db: DbDep,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    type: str | None = Query(None),
    statut: str | None = Query(None),
    ville: str | None = Query(None),
    canton: str | None = Query(None),
    owner_id: str | None = Query(None),
    agency_id: str | None = Query(None),
) -> PaginatedBiens:
    return await BienService(db).list(
        current_user=current_user,
        page=page,
        size=size,
        type=type,
        statut=statut,
        ville=ville,
        canton=canton,
        owner_id=owner_id,
        agency_id=agency_id,
    )


@router.post("", response_model=BienRead, status_code=status.HTTP_201_CREATED)
async def create_bien(
    payload: BienCreate,
    current_user: AuthDep,
    db: DbDep,
) -> BienRead:
    bien = await BienService(db).create(payload, current_user=current_user)
    return BienRead.model_validate(bien)


@router.get("/{bien_id}", response_model=BienDetail)
async def get_bien(
    bien_id: str,
    current_user: AuthDep,
    db: DbDep,
) -> BienDetail:
    detail = await BienService(db).get_detail(bien_id, current_user=current_user)
    if detail is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bien introuvable")
    return detail


@router.patch("/{bien_id}", response_model=BienRead)
async def update_bien(
    bien_id: str,
    payload: BienUpdate,
    current_user: AuthDep,
    db: DbDep,
) -> BienRead:
    bien = await BienService(db).update(bien_id, payload, current_user=current_user)
    if bien is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bien introuvable")
    return BienRead.model_validate(bien)


@router.delete("/{bien_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_bien(
    bien_id: str,
    current_user: AuthDep,
    db: DbDep,
) -> None:
    ok = await BienService(db).delete(bien_id, current_user=current_user)
    if not ok:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bien introuvable")


# ═════════════════════════════════════════════════════════════════════════════
# Images
# ═════════════════════════════════════════════════════════════════════════════


@router.post("/{bien_id}/images", response_model=BienImageRead, status_code=status.HTTP_201_CREATED)
async def upload_image(
    bien_id: str,
    current_user: AuthDep,
    db: DbDep,
    file: UploadFile = File(...),
    is_cover: bool = Form(False),
) -> BienImageRead:
    return await BienService(db).add_image(bien_id, file, is_cover, current_user)


@router.delete(
    "/{bien_id}/images/{image_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
)
async def delete_image(
    bien_id: str,
    image_id: str,
    current_user: AuthDep,
    db: DbDep,
) -> None:
    ok = await BienService(db).delete_image(bien_id, image_id, current_user)
    if not ok:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Image introuvable")


# ═════════════════════════════════════════════════════════════════════════════
# Documents
# ═════════════════════════════════════════════════════════════════════════════


@router.post(
    "/{bien_id}/documents",
    response_model=BienDocumentRead,
    status_code=status.HTTP_201_CREATED,
)
async def upload_document(
    bien_id: str,
    current_user: AuthDep,
    db: DbDep,
    file: UploadFile = File(...),
    doc_type: str = Form("autre"),
) -> BienDocumentRead:
    return await BienService(db).add_document(bien_id, file, doc_type, current_user)


# ═════════════════════════════════════════════════════════════════════════════
# Équipements
# ═════════════════════════════════════════════════════════════════════════════


@router.get("/{bien_id}/equipements", response_model=list[CatalogueEquipementRead])
async def get_bien_equipements(
    bien_id: str,
    current_user: AuthDep,
    db: DbDep,
) -> list[CatalogueEquipementRead]:
    return await BienService(db).get_equipements(bien_id, current_user)


@router.put("/{bien_id}/equipements", response_model=list[CatalogueEquipementRead])
async def set_bien_equipements(
    bien_id: str,
    payload: SetEquipementsRequest,
    current_user: AuthDep,
    db: DbDep,
) -> list[CatalogueEquipementRead]:
    """Remplace intégralement la liste d'équipements d'un bien."""
    return await BienService(db).set_equipements(
        bien_id, payload.equipement_ids, current_user
    )


@router.delete(
    "/{bien_id}/equipements/{equipement_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
)
async def remove_bien_equipement(
    bien_id: str,
    equipement_id: str,
    current_user: AuthDep,
    db: DbDep,
) -> None:
    ok = await BienService(db).remove_equipement(bien_id, equipement_id, current_user)
    if not ok:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Équipement non attaché")


# ═════════════════════════════════════════════════════════════════════════════
# History (audit log)
# ═════════════════════════════════════════════════════════════════════════════


@router.get("/{bien_id}/history", response_model=list[AuditLogResponse])
async def get_bien_history(
    bien_id: str,
    current_user: AuthDep,
    db: DbDep,
    limit: int = Query(50, ge=1, le=200),
) -> list[AuditLogResponse]:
    # Vérifie l'accès au bien d'abord
    detail = await BienService(db).get_detail(bien_id, current_user=current_user)
    if detail is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bien introuvable")
    return await BienService(db).get_history(bien_id, limit=limit)


# ═════════════════════════════════════════════════════════════════════════════
# Generate description IA (Claude)
# ═════════════════════════════════════════════════════════════════════════════


@router.post("/{bien_id}/generate-description")
async def generate_description(
    bien_id: str,
    current_user: AuthDep,
    db: DbDep,
) -> dict:
    description = await BienService(db).generate_description(bien_id, current_user)
    return {"description": description}


# ═════════════════════════════════════════════════════════════════════════════
# Potentiel IA (analyse 7 blocs pour la fiche bien)
# ═════════════════════════════════════════════════════════════════════════════


from pydantic import BaseModel as _PydanticBase  # noqa: E402


class PotentielIAResponse(_PydanticBase):
    """7 blocs d'analyse IA pour un bien."""

    valeur_min: float
    valeur_max: float
    rendement_brut: float
    rendement_net: float
    loyer_actuel: float
    loyer_marche: float
    ecart_marche_pct: float
    score_investissement: float
    recommandations: list[str]
    conseil_fiscal: str
    prochaine_action: str


@router.get(
    "/{bien_id}/potentiel",
    response_model=PotentielIAResponse,
    summary="Potentiel IA du bien",
)
async def get_potentiel_ia(
    bien_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> PotentielIAResponse:
    """Calcul financier + Claude pour recommandations textuelles."""
    from anthropic import AsyncAnthropic
    from app.core.config import settings

    result = await db.execute(select(Bien).where(Bien.id == bien_id))
    bien = result.scalar_one_or_none()
    if not bien:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bien introuvable")

    # Access check simple (owner only pour ce endpoint)
    if current_user.role not in ("super_admin",):
        if (
            bien.owner_id != current_user.id
            and bien.agency_id != current_user.id
            and bien.created_by_id != current_user.id
        ):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")

    loyer = float(bien.loyer or 0)
    charges = float(bien.charges or 0)
    surface = float(bien.surface or 0)

    valeur_min = round(loyer * 200, 0) if loyer > 0 else 0.0
    valeur_max = round(loyer * 260, 0) if loyer > 0 else 0.0
    loyer_net_annuel = (loyer - charges) * 12
    valeur_mid = (valeur_min + valeur_max) / 2 if valeur_max > 0 else 1

    rendement_brut = round((loyer * 12 / valeur_mid * 100), 2) if valeur_mid > 0 else 0.0
    rendement_net = round((loyer_net_annuel / valeur_mid * 100), 2) if valeur_mid > 0 else 0.0

    loyer_marche = round(loyer * 1.04, 0) if loyer > 0 else 0.0
    ecart_marche_pct = round(((loyer_marche - loyer) / loyer * 100), 1) if loyer > 0 else 0.0

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
        conseil_fiscal = (
            "Déduisez les charges d'entretien, intérêts hypothécaires et frais de gérance "
            "de votre revenu imposable."
        )
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
