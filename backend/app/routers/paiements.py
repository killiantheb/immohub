"""Router FastAPI — /api/v1/paiements."""

from __future__ import annotations

import uuid
from typing import Annotated

import stripe
from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.paiement import Paiement
from app.models.user import User
from app.schemas.paiement import PaiementCreate, PaiementRead, PaiementUpdate
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

stripe.api_key = settings.STRIPE_SECRET_KEY

router = APIRouter()

DbDep = Annotated[AsyncSession, Depends(get_db)]
AuthDep = Annotated[User, Depends(get_current_user)]


# ═════════════════════════════════════════════════════════════════════════════
# SUPPRIMÉ — POST /paiements/creer-intent
# Les loyers ne passent plus par Stripe Connect.
# Ils sont gérés par QR-facture (SPC 2.0) + réconciliation CAMT.054.
# Voir : app/routers/loyers.py — POST /api/v1/loyers/generer-qr
# ═════════════════════════════════════════════════════════════════════════════


# ═════════════════════════════════════════════════════════════════════════════
# POST /paiements/frais-dossier — CHF 90 si locataire retenu
# ═════════════════════════════════════════════════════════════════════════════


class FraisDossierRequest(BaseModel):
    candidature_id: uuid.UUID


class FraisDossierResponse(BaseModel):
    client_secret: str
    payment_intent_id: str
    montant: float   # CHF 90


FRAIS_DOSSIER_CHF = 90.0


@router.post("/frais-dossier", response_model=FraisDossierResponse, status_code=status.HTTP_201_CREATED)
async def creer_frais_dossier(
    payload: FraisDossierRequest,
    current_user: AuthDep,
    db: DbDep,
) -> FraisDossierResponse:
    """
    Crée un Stripe PaymentIntent de CHF 90 (frais de dossier Althy).
    Déclenché uniquement si le candidat a été retenu (statut = 'acceptee').
    Les CHF 90 vont directement à Althy — pas de transfer_data verso le proprio.
    Le webhook payment_intent.succeeded (type=frais_dossier) met à jour frais_payes = true.
    """
    from app.models.candidature import Candidature

    candidature = (
        await db.execute(
            select(Candidature).where(
                Candidature.id == payload.candidature_id,
                Candidature.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()

    if not candidature:
        raise HTTPException(404, "Candidature introuvable")
    if candidature.statut != "acceptee":
        raise HTTPException(422, "Les frais de dossier ne sont dus que si votre candidature a été acceptée")
    if candidature.frais_payes:
        raise HTTPException(409, "Les frais de dossier ont déjà été réglés")

    amount_centimes = int(FRAIS_DOSSIER_CHF * 100)

    pi = stripe.PaymentIntent.create(
        amount=amount_centimes,
        currency="chf",
        metadata={
            "type": "frais_dossier",
            "candidature_id": str(payload.candidature_id),
            "user_id": str(current_user.id),
        },
        description="Frais de dossier Althy — CHF 90",
        automatic_payment_methods={"enabled": True},
    )

    # Stocker le PI sur la candidature pour le reconcilier via webhook
    candidature.stripe_pi_id = pi.id
    await db.commit()

    return FraisDossierResponse(
        client_secret=pi.client_secret,
        payment_intent_id=pi.id,
        montant=FRAIS_DOSSIER_CHF,
    )


# ═════════════════════════════════════════════════════════════════════════════
# CRUD paiements
# ═════════════════════════════════════════════════════════════════════════════


@router.get("", response_model=list[PaiementRead])
async def list_paiements(
    current_user: AuthDep,
    db: DbDep,
    locataire_id: uuid.UUID | None = Query(None),
    bien_id: uuid.UUID | None = Query(None),
    statut: str | None = Query(None),
    mois: str | None = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
) -> list[PaiementRead]:
    q = select(Paiement)
    if locataire_id:
        q = q.where(Paiement.locataire_id == locataire_id)
    if bien_id:
        q = q.where(Paiement.bien_id == bien_id)
    if statut:
        q = q.where(Paiement.statut == statut)
    if mois:
        q = q.where(Paiement.mois == mois)
    q = q.offset((page - 1) * size).limit(size)
    rows = await db.execute(q)
    return [PaiementRead.model_validate(r) for r in rows.scalars()]


@router.post("", response_model=PaiementRead, status_code=status.HTTP_201_CREATED)
async def create_paiement(
    payload: PaiementCreate,
    current_user: AuthDep,
    db: DbDep,
) -> PaiementRead:
    p = Paiement(**payload.model_dump())
    db.add(p)
    await db.flush()
    await db.refresh(p)
    return PaiementRead.model_validate(p)


@router.get("/{paiement_id}", response_model=PaiementRead)
async def get_paiement(
    paiement_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> PaiementRead:
    result = await db.execute(select(Paiement).where(Paiement.id == paiement_id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Paiement introuvable")
    return PaiementRead.model_validate(p)


@router.patch("/{paiement_id}", response_model=PaiementRead)
async def update_paiement(
    paiement_id: uuid.UUID,
    payload: PaiementUpdate,
    current_user: AuthDep,
    db: DbDep,
) -> PaiementRead:
    result = await db.execute(select(Paiement).where(Paiement.id == paiement_id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Paiement introuvable")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(p, field, value)
    await db.flush()
    await db.refresh(p)
    return PaiementRead.model_validate(p)


@router.delete("/{paiement_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_paiement(
    paiement_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> None:
    result = await db.execute(select(Paiement).where(Paiement.id == paiement_id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Paiement introuvable")
    await db.delete(p)
