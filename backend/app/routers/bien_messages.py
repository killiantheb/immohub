"""bien_messages router — messagerie interne 1:1 bailleur ↔ locataire.

Sprint Module Communication PR-1 (2026-05-12) — Phase 1.0 doctrine v6
(cf docs/4-PRODUIT.md §4.13). Resend uniquement, pas d'OAuth/WhatsApp.

Endpoints :
    POST   /api/v1/biens/{bien_id}/messages               → envoyer un message
    GET    /api/v1/biens/{bien_id}/messages               → lister le thread
    PATCH  /api/v1/biens/{bien_id}/messages/{message_id}/lu
                                                          → marquer 1 message lu
    PATCH  /api/v1/biens/{bien_id}/messages/marquer-lus   → marquer tout le thread lu
    GET    /api/v1/bien_messages/non-lus                  → count global current_user

Helper d'autorisation : `_resolve_thread_parties` retourne (bailleur_id,
locataire_user_id) si current_user est l'une des deux parties d'un bien
donné. 403 sinon. Pattern miroir de `_check_bien_ownership` dans
`biens_invitations.py` mais étendu pour autoriser aussi le locataire actif.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Annotated

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.bien_message import BienMessage
from app.models.user import User
from app.schemas.bien_message import (
    BienMessageCreate,
    BienMessageRead,
    BienMessageThreadResponse,
    MarkThreadReadResponse,
    UnreadCountResponse,
)
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

router = APIRouter()
unread_router = APIRouter()  # monté séparément sur /api/v1 (pas /api/v1/biens)

DbDep = Annotated[AsyncSession, Depends(get_db)]
AuthDep = Annotated[User, Depends(get_current_user)]


# ── Helpers ───────────────────────────────────────────────────────────────────


async def _resolve_thread_parties(
    db: AsyncSession,
    bien_id: uuid.UUID,
    current_user: User,
) -> tuple[uuid.UUID, uuid.UUID]:
    """Vérifie l'accès au thread et retourne (bailleur_id, locataire_user_id).

    Règles :
      - super_admin a accès systématique (cf §B.10 — pas de mensonge,
        on lui retourne quand même les vraies identités du thread).
      - bailleur (owner_id OU agency_id du bien) a accès.
      - locataire ACTIF du bien (locataires.statut='actif', user_id non null)
        a accès.

    Levée 404 si bien introuvable, 403 sinon. Retourne le tuple
    (bailleur_id, locataire_user_id) — utile pour valider que `recipient_user_id`
    est bien l'autre partie sur les POST.

    `locataire_user_id` peut être None si le bien n'a pas (encore) de
    locataire actif lié à un user (cas pré-invitation acceptée).
    """
    row = await db.execute(
        text("""
            SELECT
                b.id           AS bien_id,
                b.owner_id     AS owner_id,
                b.agency_id    AS agency_id,
                (
                    SELECT l.user_id
                    FROM locataires l
                    WHERE l.bien_id = b.id
                      AND l.statut = 'actif'
                      AND l.user_id IS NOT NULL
                    ORDER BY l.created_at DESC
                    LIMIT 1
                ) AS locataire_user_id
            FROM biens b
            WHERE b.id = :bid AND b.is_active = TRUE
        """),
        {"bid": str(bien_id)},
    )
    rec = row.one_or_none()
    if not rec:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bien introuvable")

    bailleur_id = rec.owner_id
    locataire_user_id = rec.locataire_user_id

    if current_user.role == "super_admin":
        return bailleur_id, locataire_user_id

    user_id_str = str(current_user.id)
    is_bailleur = (
        str(rec.owner_id) == user_id_str
        or (rec.agency_id is not None and str(rec.agency_id) == user_id_str)
    )
    is_locataire = (
        rec.locataire_user_id is not None
        and str(rec.locataire_user_id) == user_id_str
    )
    if not (is_bailleur or is_locataire):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Vous n'avez pas accès à la messagerie de ce bien",
        )

    return bailleur_id, locataire_user_id


# ── POST /biens/{bien_id}/messages ────────────────────────────────────────────


@router.post(
    "/{bien_id}/messages",
    response_model=BienMessageRead,
    status_code=status.HTTP_201_CREATED,
)
async def send_message(
    bien_id: uuid.UUID,
    payload: BienMessageCreate,
    current_user: AuthDep,
    db: DbDep,
) -> BienMessageRead:
    """Envoie un message dans le thread du bien.

    Sender = current_user, recipient = `payload.recipient_user_id`. Le
    recipient doit être l'autre partie du thread (bailleur si sender =
    locataire, locataire actif si sender = bailleur). Toute autre cible
    → 403.
    """
    bailleur_id, locataire_user_id = await _resolve_thread_parties(
        db, bien_id, current_user
    )

    sender_is_bailleur = (
        current_user.role == "super_admin"
        or str(current_user.id) == str(bailleur_id)
    )
    # Si super_admin envoie au nom de quelqu'un, on lui laisse choisir le
    # recipient librement parmi (bailleur, locataire) — mais on refuse si la
    # cible n'est aucune des deux.
    valid_recipients: set[str] = set()
    if bailleur_id:
        valid_recipients.add(str(bailleur_id))
    if locataire_user_id:
        valid_recipients.add(str(locataire_user_id))

    if str(payload.recipient_user_id) not in valid_recipients:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Le destinataire doit être l'autre partie du thread (bailleur ou locataire actif)",
        )
    if str(payload.recipient_user_id) == str(current_user.id):
        # Double-garde côté backend en plus de la CHECK constraint DB.
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Impossible d'envoyer un message à soi-même",
        )

    # Pour proprio_solo / agence : le sender ne peut être que current_user.
    # Pour locataire : idem. La RLS Postgres re-vérifie aussi
    # (insert_own_bien_messages : sender_user_id = althy_current_user_id()).
    msg = BienMessage(
        bien_id=bien_id,
        sender_user_id=current_user.id,
        recipient_user_id=payload.recipient_user_id,
        body=payload.body,
    )
    db.add(msg)
    await db.commit()  # §B.12 : commit explicite après INSERT.

    # SQLAlchemy 2.0 async + Pydantic : recharger msg avec selectinload pour
    # que sender/recipient soient déjà attachés au moment du model_validate.
    # Sans ça, Pydantic déclenche un lazy-load hors greenlet → MissingGreenlet
    # (cf hotfix 2026-05-12 bien_messages_pydantic_lazy_load).
    reloaded = await db.execute(
        select(BienMessage)
        .options(
            selectinload(BienMessage.sender),
            selectinload(BienMessage.recipient),
        )
        .where(BienMessage.id == msg.id)
    )
    msg = reloaded.scalar_one()

    _ = sender_is_bailleur  # variable conservée pour clarté audit + futur hook notif
    return BienMessageRead.model_validate(msg)


# ── GET /biens/{bien_id}/messages ─────────────────────────────────────────────


@router.get(
    "/{bien_id}/messages",
    response_model=BienMessageThreadResponse,
)
async def list_messages(
    bien_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
) -> BienMessageThreadResponse:
    """Liste les messages d'un thread (ordre chronologique ASC).

    Pagination offset/limit simple — Phase 1.0 les threads Sunimmo seront
    courts (< 100 messages). Curseur-based à reconsidérer Phase 1.1 si
    threads longs.

    NE marque PAS auto comme lus — le frontend doit appeler
    `PATCH /messages/marquer-lus` quand l'utilisateur ouvre vraiment la
    conversation (distinction « fetch en background » vs « vu »).
    """
    await _resolve_thread_parties(db, bien_id, current_user)

    base = select(BienMessage).where(BienMessage.bien_id == bien_id)

    # Count total + unread pour cet utilisateur (un seul aller-retour SQL).
    counts_row = await db.execute(
        text("""
            SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (
                    WHERE recipient_user_id = :uid AND lu = FALSE
                ) AS unread
            FROM bien_messages
            WHERE bien_id = :bid
        """),
        {"bid": str(bien_id), "uid": str(current_user.id)},
    )
    cnt = counts_row.one()
    total = int(cnt.total or 0)
    unread = int(cnt.unread or 0)

    rows = await db.execute(
        base
        .options(selectinload(BienMessage.sender), selectinload(BienMessage.recipient))
        .order_by(BienMessage.created_at.asc())
        .offset(skip)
        .limit(limit)
    )
    items = [BienMessageRead.model_validate(m) for m in rows.scalars()]

    return BienMessageThreadResponse(
        messages=items,
        total=total,
        unread_count=unread,
    )


# ── PATCH /biens/{bien_id}/messages/marquer-lus ───────────────────────────────
#
# Placé AVANT la route à path-param `/{message_id}/lu` pour que FastAPI
# matche le segment "marquer-lus" comme route littérale, pas comme UUID.


@router.patch(
    "/{bien_id}/messages/marquer-lus",
    response_model=MarkThreadReadResponse,
)
async def mark_thread_read(
    bien_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> MarkThreadReadResponse:
    """Marque tous les messages reçus non-lus de ce thread comme lus."""
    await _resolve_thread_parties(db, bien_id, current_user)

    now = datetime.now(timezone.utc)
    result = await db.execute(
        update(BienMessage)
        .where(
            BienMessage.bien_id == bien_id,
            BienMessage.recipient_user_id == current_user.id,
            BienMessage.lu.is_(False),
        )
        .values(lu=True, lu_at=now)
        .returning(BienMessage.id)
    )
    marked = len(list(result.scalars()))
    await db.commit()  # §B.12

    return MarkThreadReadResponse(marked_count=marked)


# ── PATCH /biens/{bien_id}/messages/{message_id}/lu ───────────────────────────


@router.patch(
    "/{bien_id}/messages/{message_id}/lu",
    response_model=BienMessageRead,
)
async def mark_message_read(
    bien_id: uuid.UUID,
    message_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> BienMessageRead:
    """Marque un message précis comme lu (idempotent).

    Auth : current_user doit être le recipient (sinon 403). Si déjà lu →
    200 avec le message inchangé (idempotence).
    """
    row = await db.execute(
        select(BienMessage)
        .options(
            selectinload(BienMessage.sender),
            selectinload(BienMessage.recipient),
        )
        .where(BienMessage.id == message_id, BienMessage.bien_id == bien_id)
    )
    msg = row.scalar_one_or_none()
    if msg is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Message introuvable")
    if str(msg.recipient_user_id) != str(current_user.id) and current_user.role != "super_admin":
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Seul le destinataire peut marquer un message comme lu",
        )

    if not msg.lu:
        msg.lu = True
        msg.lu_at = datetime.now(timezone.utc)
        await db.commit()  # §B.12

        # Recharge avec selectinload : db.refresh() peut expirer les relations
        # déjà chargées via le SELECT initial → MissingGreenlet au model_validate.
        # Pattern miroir POST /messages (cf hotfix 2026-05-12).
        reloaded = await db.execute(
            select(BienMessage)
            .options(
                selectinload(BienMessage.sender),
                selectinload(BienMessage.recipient),
            )
            .where(BienMessage.id == msg.id)
        )
        msg = reloaded.scalar_one()

    return BienMessageRead.model_validate(msg)


# ── GET /bien_messages/non-lus (router séparé, prefix /api/v1) ────────────────


@unread_router.get(
    "/bien_messages/non-lus",
    response_model=UnreadCountResponse,
)
async def unread_count(
    current_user: AuthDep,
    db: DbDep,
) -> UnreadCountResponse:
    """Count des messages non-lus toutes biens confondus pour current_user.

    Use case : badge sidebar dashboard (PR-5 future rebrnachera le polling
    sur cet endpoint au lieu de l'ancien `/messagerie/non-lus` qui pointait
    vers `email_cache` — code Phase 2 dormant cf CLAUDE.md §B.15).
    """
    row = await db.execute(
        select(func.count())
        .select_from(BienMessage)
        .where(
            BienMessage.recipient_user_id == current_user.id,
            BienMessage.lu.is_(False),
        )
    )
    return UnreadCountResponse(count=int(row.scalar_one()))
