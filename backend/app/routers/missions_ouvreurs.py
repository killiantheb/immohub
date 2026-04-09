"""Router FastAPI — /api/v1/ouvreurs.

Missions : CRUD + accept/refuse/complete/rate (1-tap) + paiement Stripe Connect (85% → ouvreur).
Profiles : CRUD + geoloc auto + Stripe Connect onboarding.

Commission Althy : 15 % sur missions ouvreurs (CLAUDE.md §3.4).
"""

from __future__ import annotations

import math
import uuid
from datetime import UTC, datetime
from typing import Annotated

import stripe
from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.mission_ouvreur import MissionOuvreur, ProfileOuvreur
from app.models.user import User
from app.services.geocoding import geocode
from app.schemas.mission_ouvreur import (
    MissionOuvreurCreate,
    MissionOuvreurRead,
    MissionOuvreurUpdate,
    ProfileOuvreurCreate,
    ProfileOuvreurRead,
    ProfileOuvreurUpdate,
)
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

stripe.api_key = settings.STRIPE_SECRET_KEY

COMMISSION_OPENER_PCT = 15.0  # 15 % Althy sur missions ouvreurs

router = APIRouter()

DbDep = Annotated[AsyncSession, Depends(get_db)]
AuthDep = Annotated[User, Depends(get_current_user)]


# ══════════════════════════════════════════════════════════════════════════════
# Missions ouvreurs
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/missions", response_model=list[MissionOuvreurRead])
async def list_missions(
    current_user: AuthDep,
    db: DbDep,
    bien_id: uuid.UUID | None = Query(None),
    statut: str | None = Query(None),
    ouvreur_id: uuid.UUID | None = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
) -> list[MissionOuvreurRead]:
    q = select(MissionOuvreur)
    if bien_id:
        q = q.where(MissionOuvreur.bien_id == bien_id)
    if statut:
        q = q.where(MissionOuvreur.statut == statut)
    if ouvreur_id:
        q = q.where(MissionOuvreur.ouvreur_id == ouvreur_id)
    q = q.offset((page - 1) * size).limit(size)
    rows = await db.execute(q)
    return [MissionOuvreurRead.model_validate(r) for r in rows.scalars()]


@router.post("/missions", response_model=MissionOuvreurRead, status_code=status.HTTP_201_CREATED)
async def create_mission(
    payload: MissionOuvreurCreate,
    current_user: AuthDep,
    db: DbDep,
) -> MissionOuvreurRead:
    m = MissionOuvreur(**payload.model_dump())
    db.add(m)
    await db.flush()
    await db.refresh(m)
    return MissionOuvreurRead.model_validate(m)


@router.get("/missions/{mission_id}", response_model=MissionOuvreurRead)
async def get_mission(
    mission_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> MissionOuvreurRead:
    result = await db.execute(select(MissionOuvreur).where(MissionOuvreur.id == mission_id))
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mission introuvable")
    return MissionOuvreurRead.model_validate(m)


@router.patch("/missions/{mission_id}", response_model=MissionOuvreurRead)
async def update_mission(
    mission_id: uuid.UUID,
    payload: MissionOuvreurUpdate,
    current_user: AuthDep,
    db: DbDep,
) -> MissionOuvreurRead:
    result = await db.execute(select(MissionOuvreur).where(MissionOuvreur.id == mission_id))
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mission introuvable")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(m, field, value)
    await db.flush()
    await db.refresh(m)
    return MissionOuvreurRead.model_validate(m)


@router.delete("/missions/{mission_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_mission(
    mission_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> None:
    result = await db.execute(select(MissionOuvreur).where(MissionOuvreur.id == mission_id))
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mission introuvable")
    await db.delete(m)


# ── Accept / Refuse (1-tap ouvreur) ───────────────────────────────────────────


@router.post("/missions/{mission_id}/accept", response_model=MissionOuvreurRead)
async def accept_mission(
    mission_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> MissionOuvreurRead:
    """Ouvreur accepte une mission proposée — statut → acceptee."""
    result = await db.execute(select(MissionOuvreur).where(MissionOuvreur.id == mission_id))
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mission introuvable")
    if m.statut != "proposee":
        raise HTTPException(status.HTTP_409_CONFLICT, f"Mission déjà en statut '{m.statut}'")
    m.statut = "acceptee"
    m.ouvreur_id = current_user.id
    await db.flush()
    await db.refresh(m)
    return MissionOuvreurRead.model_validate(m)


class RefusePayload(BaseModel):
    raison: str | None = None


@router.post("/missions/{mission_id}/refuse", response_model=MissionOuvreurRead)
async def refuse_mission(
    mission_id: uuid.UUID,
    payload: RefusePayload,
    current_user: AuthDep,
    db: DbDep,
) -> MissionOuvreurRead:
    """Ouvreur refuse une mission — statut → annulee."""
    result = await db.execute(select(MissionOuvreur).where(MissionOuvreur.id == mission_id))
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mission introuvable")
    if m.statut not in ("proposee", "acceptee"):
        raise HTTPException(status.HTTP_409_CONFLICT, f"Mission déjà en statut '{m.statut}'")
    m.statut = "annulee"
    if payload.raison:
        await db.execute(
            text("UPDATE missions_ouvreurs SET refuse_reason = :r WHERE id = :id"),
            {"r": payload.raison, "id": str(mission_id)},
        )
    await db.flush()
    await db.refresh(m)
    return MissionOuvreurRead.model_validate(m)


# ── Complete + paiement Stripe Connect (15 % Althy) ───────────────────────────


@router.post("/missions/{mission_id}/complete")
async def complete_mission(
    mission_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> dict:
    """
    Proprio valide que la mission est effectuée.
    Déclenche un Stripe Transfer vers le compte Connect de l'ouvreur.
    Althy retient 15 % de commission — ouvreur reçoit 85 %.
    """
    result = await db.execute(select(MissionOuvreur).where(MissionOuvreur.id == mission_id))
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mission introuvable")
    if m.statut != "acceptee":
        raise HTTPException(status.HTTP_409_CONFLICT, "La mission doit être acceptée avant d'être complétée")
    if not m.ouvreur_id:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Aucun ouvreur assigné")

    # Récupérer compte Connect de l'ouvreur
    row = (await db.execute(
        text("SELECT stripe_account_id FROM profiles_ouvreurs WHERE user_id = :uid"),
        {"uid": str(m.ouvreur_id)},
    )).fetchone()

    remuneration = float(m.remuneration or 0)
    commission = round(remuneration * COMMISSION_OPENER_PCT / 100, 2)
    net = round(remuneration - commission, 2)

    transfer_id: str | None = None
    if row and row[0] and remuneration > 0:
        try:
            transfer = stripe.Transfer.create(
                amount=int(net * 100),
                currency="chf",
                destination=row[0],
                metadata={
                    "mission_id": str(mission_id),
                    "commission_pct": str(COMMISSION_OPENER_PCT),
                    "gross": str(remuneration),
                },
                description=f"Mission ouvreur #{str(mission_id)[:8]} — net CHF {net}",
            )
            transfer_id = transfer.id
        except stripe.error.StripeError as e:
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"Stripe Transfer échoué : {e}")

    m.statut = "effectuee"
    await db.execute(
        text("""
            UPDATE missions_ouvreurs
            SET commission_amount = :c, net_remuneration = :n,
                stripe_transfer_id = :t, paid_at = :p
            WHERE id = :id
        """),
        {
            "c": commission, "n": net, "t": transfer_id,
            "p": datetime.now(UTC), "id": str(mission_id),
        },
    )
    await db.flush()
    await db.refresh(m)

    # Incrémenter nb_missions de l'ouvreur
    await db.execute(
        text("UPDATE profiles_ouvreurs SET nb_missions = nb_missions + 1 WHERE user_id = :uid"),
        {"uid": str(m.ouvreur_id)},
    )
    await db.commit()

    return {
        "mission_id": str(mission_id),
        "statut": "effectuee",
        "remuneration_brut_chf": remuneration,
        "commission_althy_chf": commission,
        "net_ouvreur_chf": net,
        "stripe_transfer_id": transfer_id,
    }


# ── Rate ouvreur ───────────────────────────────────────────────────────────────


class RatePayload(BaseModel):
    note: int  # 1–5
    commentaire: str | None = None


@router.post("/missions/{mission_id}/rate", response_model=MissionOuvreurRead)
async def rate_mission(
    mission_id: uuid.UUID,
    payload: RatePayload,
    current_user: AuthDep,
    db: DbDep,
) -> MissionOuvreurRead:
    """Proprio note l'ouvreur après complétion. Met à jour note_moyenne sur le profil."""
    if not 1 <= payload.note <= 5:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Note doit être entre 1 et 5")

    result = await db.execute(select(MissionOuvreur).where(MissionOuvreur.id == mission_id))
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mission introuvable")
    if m.statut != "effectuee":
        raise HTTPException(status.HTTP_409_CONFLICT, "Notez uniquement après complétion")

    await db.execute(
        text("""
            UPDATE missions_ouvreurs
            SET note_ouvreur = :n, note_commentaire = :c
            WHERE id = :id
        """),
        {"n": payload.note, "c": payload.commentaire, "id": str(mission_id)},
    )

    # Recalculer note_moyenne sur le profil ouvreur
    if m.ouvreur_id:
        await db.execute(
            text("""
                UPDATE profiles_ouvreurs
                SET note_moyenne = (
                    SELECT ROUND(AVG(note_ouvreur::float)::numeric, 2)
                    FROM missions_ouvreurs
                    WHERE ouvreur_id = :uid AND note_ouvreur IS NOT NULL
                )
                WHERE user_id = :uid
            """),
            {"uid": str(m.ouvreur_id)},
        )

    await db.flush()
    await db.refresh(m)
    return MissionOuvreurRead.model_validate(m)


# ── Near-me : missions dans le rayon de l'ouvreur ─────────────────────────────


@router.get("/missions/near-me", response_model=list[MissionOuvreurRead])
async def missions_near_me(
    current_user: AuthDep,
    db: DbDep,
) -> list[MissionOuvreurRead]:
    """
    Ouvreur : retourne les missions 'proposees' dans son rayon d'intervention.
    Utilise la distance Haversine entre coordonnées du bien et du profil ouvreur.
    """
    prof_row = (await db.execute(
        select(ProfileOuvreur).where(ProfileOuvreur.user_id == current_user.id)
    )).scalar_one_or_none()

    if not prof_row or prof_row.lat is None:
        # Pas de coordonnées → retourner toutes les missions proposées
        rows = (await db.execute(
            select(MissionOuvreur).where(
                MissionOuvreur.statut == "proposee",
                MissionOuvreur.is_active.is_(True),
            ).limit(50)
        )).scalars().all()
        return [MissionOuvreurRead.model_validate(r) for r in rows]

    rayon = prof_row.rayon_km or 20

    # Haversine en SQL (approximation sur lat/lng du bien via biens table)
    rows = (await db.execute(
        text("""
            SELECT mo.*
            FROM missions_ouvreurs mo
            JOIN biens b ON b.id = mo.bien_id
            WHERE mo.statut = 'proposee'
              AND mo.is_active = true
              AND b.latitude IS NOT NULL
              AND (
                6371 * acos(
                  cos(radians(:lat)) * cos(radians(b.latitude))
                  * cos(radians(b.longitude) - radians(:lng))
                  + sin(radians(:lat)) * sin(radians(b.latitude))
                )
              ) <= :rayon
            ORDER BY mo.date_mission ASC
            LIMIT 50
        """),
        {"lat": prof_row.lat, "lng": prof_row.lng, "rayon": rayon},
    )).fetchall()

    missions = []
    for row in rows:
        m = await db.get(MissionOuvreur, row[0])
        if m:
            missions.append(MissionOuvreurRead.model_validate(m))
    return missions


# ── Stripe Connect onboarding ouvreur ─────────────────────────────────────────


@router.post("/profiles/me/connect/onboard")
async def onboard_ouvreur_connect(current_user: AuthDep, db: DbDep) -> dict:
    """Crée ou récupère le compte Stripe Connect Express de l'ouvreur."""
    row = (await db.execute(
        text("SELECT stripe_account_id FROM profiles_ouvreurs WHERE user_id = :uid"),
        {"uid": str(current_user.id)},
    )).fetchone()
    account_id = row[0] if row else None

    if not account_id:
        account = stripe.Account.create(
            type="express",
            country="CH",
            email=current_user.email,
            capabilities={"transfers": {"requested": True}},
            business_type="individual",
        )
        account_id = account.id
        await db.execute(
            text("UPDATE profiles_ouvreurs SET stripe_account_id = :aid WHERE user_id = :uid"),
            {"aid": account_id, "uid": str(current_user.id)},
        )
        await db.commit()

    link = stripe.AccountLink.create(
        account=account_id,
        refresh_url=f"{settings.ALLOWED_ORIGINS[0]}/app/marketplace?connect=refresh",
        return_url=f"{settings.ALLOWED_ORIGINS[0]}/app/marketplace?connect=success",
        type="account_onboarding",
    )
    return {"url": link.url}


# ══════════════════════════════════════════════════════════════════════════════
# Profiles ouvreurs
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/profiles", response_model=list[ProfileOuvreurRead])
async def list_profiles(
    current_user: AuthDep,
    db: DbDep,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
) -> list[ProfileOuvreurRead]:
    q = select(ProfileOuvreur).offset((page - 1) * size).limit(size)
    rows = await db.execute(q)
    return [ProfileOuvreurRead.model_validate(r) for r in rows.scalars()]


@router.post("/profiles", response_model=ProfileOuvreurRead, status_code=status.HTTP_201_CREATED)
async def create_profile(
    payload: ProfileOuvreurCreate,
    current_user: AuthDep,
    db: DbDep,
) -> ProfileOuvreurRead:
    p = ProfileOuvreur(**payload.model_dump())
    db.add(p)
    await db.flush()
    await db.refresh(p)
    return ProfileOuvreurRead.model_validate(p)


@router.get("/profiles/me", response_model=ProfileOuvreurRead)
async def get_my_profile(
    current_user: AuthDep,
    db: DbDep,
) -> ProfileOuvreurRead:
    result = await db.execute(select(ProfileOuvreur).where(ProfileOuvreur.user_id == current_user.id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Profil introuvable")
    return ProfileOuvreurRead.model_validate(p)


@router.patch("/profiles/me", response_model=ProfileOuvreurRead)
async def update_my_profile(
    payload: ProfileOuvreurUpdate,
    current_user: AuthDep,
    db: DbDep,
) -> ProfileOuvreurRead:
    result = await db.execute(select(ProfileOuvreur).where(ProfileOuvreur.user_id == current_user.id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Profil introuvable")
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(p, field, value)

    # Auto-géocode si lat/lng absents et que l'utilisateur a une adresse
    if p.lat is None or p.lng is None:
        if current_user.adresse:
            coords = await geocode(current_user.adresse)
            if coords:
                p.lat, p.lng = coords

    await db.flush()
    await db.refresh(p)
    return ProfileOuvreurRead.model_validate(p)
