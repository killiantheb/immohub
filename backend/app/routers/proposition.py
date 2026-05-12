"""Router FastAPI — Module Proposition de dates locataire (Sprint 4B).

Endpoints (8 — tous sous /api/v1/locataires/{locataire_id}/proposition) :

  GET    /                       → state + computed flags UI
  GET    /peut-proposer          → flags seuls (alias léger pour polling)
  POST   /proposer               → locataire propose (état initial)
  POST   /contre-proposer        → bailleur contre-propose
  POST   /accepter-bailleur      → bailleur accepte la proposition locataire
  POST   /accepter-locataire     → locataire accepte la contre-proposition bailleur
  POST   /re-contre-proposer     → locataire re-contre-propose
  POST   /refuser                → locataire OU bailleur refuse
  POST   /reset                  → locataire relance un nouveau cycle après refus

Doctrine :
  - §B.10 : transitions strictes côté service. HTTPException 400 si état
    incompatible. L'API n'invente pas de statut.
  - §B.12 : un seul commit par appel, via `_commit_or_raise` du service.
  - §B.15 : Phase 1.0 stricte. Aucune notif Resend / OAuth.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.proposition import (
    ContrePropositionBailleurRequest,
    PropositionStatusResponse,
    ProposerDatesRequest,
    ReContrePropositionLocataireRequest,
    RefuserPropositionRequest,
)
from app.services.proposition_service import (
    accepter_contre_proposition_locataire,
    accepter_proposition_bailleur,
    contre_proposer_bailleur,
    get_proposition_status,
    propose_dates_locataire,
    re_contre_proposer_locataire,
    refuser_proposition,
    reset_proposition,
)
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

DbDep = Annotated[AsyncSession, Depends(get_db)]
AuthDep = Annotated[User, Depends(get_current_user)]


@router.get(
    "/{locataire_id}/proposition",
    response_model=PropositionStatusResponse,
)
async def read_proposition(
    locataire_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> PropositionStatusResponse:
    """État + flags UI. Appelé au mount de la page dossier locataire (côté
    locataire ET côté bailleur)."""
    return await get_proposition_status(db, locataire_id, current_user)


@router.get(
    "/{locataire_id}/proposition/peut-proposer",
    response_model=PropositionStatusResponse,
)
async def read_proposition_flags(
    locataire_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> PropositionStatusResponse:
    """Alias de GET / pour clarifier l'intention côté frontend (polling UI).

    Retourne la même structure — le frontend peut ne consommer que les flags
    `peut_*` mais avoir l'état complet permet aussi de hydrater les banners
    en parallèle sans deuxième round-trip.
    """
    return await get_proposition_status(db, locataire_id, current_user)


@router.post(
    "/{locataire_id}/proposition/proposer",
    response_model=PropositionStatusResponse,
    status_code=status.HTTP_201_CREATED,
)
async def proposer(
    locataire_id: uuid.UUID,
    payload: ProposerDatesRequest,
    current_user: AuthDep,
    db: DbDep,
) -> PropositionStatusResponse:
    """Locataire propose ses dates (premier tour ou après reset)."""
    return await propose_dates_locataire(db, locataire_id, payload, current_user)


@router.post(
    "/{locataire_id}/proposition/contre-proposer",
    response_model=PropositionStatusResponse,
    status_code=status.HTTP_201_CREATED,
)
async def contre_proposer(
    locataire_id: uuid.UUID,
    payload: ContrePropositionBailleurRequest,
    current_user: AuthDep,
    db: DbDep,
) -> PropositionStatusResponse:
    """Bailleur contre-propose une autre date."""
    return await contre_proposer_bailleur(db, locataire_id, payload, current_user)


@router.post(
    "/{locataire_id}/proposition/accepter-bailleur",
    response_model=PropositionStatusResponse,
)
async def accepter_bailleur(
    locataire_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> PropositionStatusResponse:
    """Bailleur accepte la date proposée par le locataire."""
    return await accepter_proposition_bailleur(db, locataire_id, current_user)


@router.post(
    "/{locataire_id}/proposition/accepter-locataire",
    response_model=PropositionStatusResponse,
)
async def accepter_locataire(
    locataire_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> PropositionStatusResponse:
    """Locataire accepte la contre-proposition du bailleur."""
    return await accepter_contre_proposition_locataire(db, locataire_id, current_user)


@router.post(
    "/{locataire_id}/proposition/re-contre-proposer",
    response_model=PropositionStatusResponse,
    status_code=status.HTTP_201_CREATED,
)
async def re_contre_proposer(
    locataire_id: uuid.UUID,
    payload: ReContrePropositionLocataireRequest,
    current_user: AuthDep,
    db: DbDep,
) -> PropositionStatusResponse:
    """Locataire re-contre-propose une autre date."""
    return await re_contre_proposer_locataire(db, locataire_id, payload, current_user)


@router.post(
    "/{locataire_id}/proposition/refuser",
    response_model=PropositionStatusResponse,
)
async def refuser(
    locataire_id: uuid.UUID,
    payload: RefuserPropositionRequest,
    current_user: AuthDep,
    db: DbDep,
) -> PropositionStatusResponse:
    """Locataire OU bailleur refuse la proposition courante."""
    return await refuser_proposition(db, locataire_id, payload, current_user)


@router.post(
    "/{locataire_id}/proposition/reset",
    response_model=PropositionStatusResponse,
)
async def reset(
    locataire_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> PropositionStatusResponse:
    """Locataire relance un nouveau cycle après refus."""
    return await reset_proposition(db, locataire_id, current_user)
