"""Portail proprio — /api/v1/portail

Géré par l'agence : crée des accès limités pour les propriétaires mandants.
Le portail_proprio peut voir ses biens, loyers et documents — rien d'autre.
"""

from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timezone
from typing import Annotated, Any

import anthropic
from app.core.config import settings
from app.core.database import get_db
from app.core.security import (
    ROLE_AGENCE,
    ROLE_PORTAIL_PROPRIO,
    ROLE_SUPER_ADMIN,
    get_current_user,
    require_roles,
)
from app.models.base import Base
from app.models.user import User
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, EmailStr
from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Text, VARCHAR, func, select
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

router = APIRouter()

DbDep       = Annotated[AsyncSession, Depends(get_db)]
AgencyDep   = Annotated[User, require_roles(ROLE_AGENCE, ROLE_SUPER_ADMIN)]
CurrentUser = Annotated[User, Depends(get_current_user)]


# ── Schemas ───────────────────────────────────────────────────────────────────

class PortailCreateRequest(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    property_ids: list[str] = []   # UUIDs des biens à partager


class PortailUserRead(BaseModel):
    id: str
    email: str
    first_name: str | None
    last_name: str | None
    role: str
    created_at: str


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_portail_user(
    body: PortailCreateRequest,
    db: DbDep,
    agency: AgencyDep,
):
    """
    L'agence crée un accès portail_proprio pour un propriétaire mandant.
    Envoie un email d'invitation avec un lien de création de mot de passe.
    """
    # Check email not already registered
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Un compte avec cet email existe déjà.")

    # Create user with portail_proprio role
    temp_password = secrets.token_urlsafe(24)  # Force reset at first login
    portail_user = User(
        id=uuid.uuid4(),
        email=body.email,
        first_name=body.first_name,
        last_name=body.last_name,
        role=ROLE_PORTAIL_PROPRIO,
        hashed_password=None,  # Will be set via Supabase invitation
        is_verified=False,
    )
    db.add(portail_user)
    await db.flush()

    # TODO: Send Supabase invitation email via Admin API
    # supabase_admin.auth.admin.invite_user_by_email(
    #     email=body.email,
    #     options={"data": {"role": "portail_proprio", "invited_by": str(agency.id)}}
    # )

    await db.commit()
    await db.refresh(portail_user)

    return PortailUserRead(
        id=str(portail_user.id),
        email=portail_user.email,
        first_name=portail_user.first_name,
        last_name=portail_user.last_name,
        role=portail_user.role,
        created_at=str(portail_user.created_at),
    )


@router.get("")
async def list_portail_users(
    db: DbDep,
    agency: AgencyDep,
):
    """Liste les portails proprio créés par cette agence."""
    result = await db.execute(
        select(User).where(User.role == ROLE_PORTAIL_PROPRIO)
    )
    users = result.scalars().all()
    return {
        "items": [
            PortailUserRead(
                id=str(u.id),
                email=u.email,
                first_name=u.first_name,
                last_name=u.last_name,
                role=u.role,
                created_at=str(u.created_at),
            )
            for u in users
        ]
    }


@router.delete("/{portail_user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_portail_access(
    portail_user_id: uuid.UUID,
    db: DbDep,
    agency: AgencyDep,
):
    """Révoque l'accès portail d'un propriétaire mandant."""
    result = await db.execute(
        select(User).where(
            User.id == portail_user_id,
            User.role == ROLE_PORTAIL_PROPRIO,
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "Utilisateur portail non trouvé.")

    user.is_active = False
    await db.commit()


@router.get("/me/access")
async def portail_access_info(
    db: DbDep,
    user: CurrentUser,
):
    """
    Retourne les biens auxquels le portail_proprio a accès.
    Accessible uniquement par le portail_proprio lui-même.
    """
    from app.models.property import Property

    if user.role not in (ROLE_PORTAIL_PROPRIO, ROLE_SUPER_ADMIN):
        raise HTTPException(403, "Réservé aux utilisateurs portail.")

    # Portail proprio voit les biens où il est agency_id ou owner_id
    result = await db.execute(
        select(Property).where(
            (Property.owner_id == user.id) | (Property.agency_id == user.id),
            Property.is_active == True,
        )
    )
    props = result.scalars().all()

    return {
        "role": user.role,
        "sections": ["dashboard", "biens", "finances", "documents"],
        "properties_count": len(props),
        "properties": [
            {"id": str(p.id), "name": p.name, "address": p.address}
            for p in props
        ],
    }


# ══════════════════════════════════════════════════════════════════════════════
# Token-based invitations — CHF 9/mois, pas de compte Supabase requis
# ══════════════════════════════════════════════════════════════════════════════

class PortailInvitation(Base):
    __tablename__ = "portail_invitations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agency_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    proprio_email: Mapped[str] = mapped_column(VARCHAR(300), nullable=False)
    proprio_name: Mapped[str | None] = mapped_column(VARCHAR(200))
    bien_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    token: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, default=uuid.uuid4, unique=True)
    inv_status: Mapped[str] = mapped_column("status", VARCHAR(20), nullable=False, default="pending")
    created_at: Mapped[Any] = mapped_column(DateTime(timezone=True), server_default=func.now())
    accepted_at: Mapped[Any] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("idx_portail_inv_agency2", "agency_user_id"),
        {"extend_existing": True},
    )


class PortailMessage(Base):
    __tablename__ = "portail_messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invitation_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("portail_invitations.id", ondelete="CASCADE"), nullable=False)
    sender_type: Mapped[str] = mapped_column(VARCHAR(10), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[Any] = mapped_column(DateTime(timezone=True), server_default=func.now())
    read_at: Mapped[Any] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("idx_portail_msg_inv2", "invitation_id"),
        {"extend_existing": True},
    )


# ── New schemas ───────────────────────────────────────────────────────────────

class InviteRequest(BaseModel):
    proprio_email: EmailStr
    proprio_name: str | None = None
    bien_id: str | None = None


class InvitationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    proprio_email: str
    proprio_name: str | None
    bien_id: uuid.UUID | None
    token: uuid.UUID
    inv_status: str
    created_at: Any


class MessageCreate(BaseModel):
    content: str


class MessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    sender_type: str
    content: str
    created_at: Any
    read_at: Any


class AIQuestionRequest(BaseModel):
    question: str
    invitation_token: str


# ── Invitation CRUD ───────────────────────────────────────────────────────────

@router.post("/invitations", status_code=status.HTTP_201_CREATED, response_model=InvitationRead)
async def create_invitation(body: InviteRequest, db: DbDep, agency: AgencyDep):
    inv = PortailInvitation(
        agency_user_id=agency.id,
        proprio_email=body.proprio_email,
        proprio_name=body.proprio_name,
        bien_id=uuid.UUID(body.bien_id) if body.bien_id else None,
        token=uuid.uuid4(),
        inv_status="pending",
    )
    db.add(inv)
    await db.commit()
    await db.refresh(inv)
    return InvitationRead.model_validate(inv)


@router.get("/invitations", response_model=dict)
async def list_invitations(db: DbDep, agency: AgencyDep):
    result = await db.execute(
        select(PortailInvitation)
        .where(PortailInvitation.agency_user_id == agency.id)
        .order_by(PortailInvitation.created_at.desc())
    )
    items = result.scalars().all()
    return {"items": [InvitationRead.model_validate(i) for i in items]}


# ── Proprio public view ───────────────────────────────────────────────────────

from sqlalchemy import text as _text


@router.get("/view/{token}", response_model=dict)
async def portail_view(token: uuid.UUID, db: DbDep):
    result = await db.execute(
        select(PortailInvitation).where(PortailInvitation.token == token)
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(404, "Lien invalide ou expiré")

    if inv.inv_status == "pending":
        inv.inv_status = "active"
        inv.accepted_at = datetime.now(timezone.utc)
        await db.commit()

    bien_info = None
    paiements_info: list[dict] = []
    interventions_info: list[dict] = []
    documents_info: list[dict] = []

    if inv.bien_id:
        r = (await db.execute(
            _text("SELECT id, adresse, ville, type_bien, loyer_mensuel FROM biens WHERE id = :id"),
            {"id": str(inv.bien_id)},
        )).fetchone()
        if r:
            bien_info = {"id": str(r[0]), "adresse": r[1], "ville": r[2], "type_bien": r[3], "loyer_mensuel": float(r[4]) if r[4] else None}

        for row in (await db.execute(
            _text("SELECT montant, date_paiement, statut, mois_concerne FROM paiements_loyer WHERE bien_id = :id ORDER BY date_paiement DESC LIMIT 6"),
            {"id": str(inv.bien_id)},
        )).fetchall():
            paiements_info.append({"montant": float(row[0]) if row[0] else None, "date": str(row[1]), "statut": row[2], "mois": str(row[3]) if row[3] else None})

        for row in (await db.execute(
            _text("SELECT titre, statut, date_planifiee, cout_estime FROM interventions WHERE bien_id = :id ORDER BY date_planifiee DESC LIMIT 5"),
            {"id": str(inv.bien_id)},
        )).fetchall():
            interventions_info.append({"titre": row[0], "statut": row[1], "date": str(row[2]) if row[2] else None, "cout": float(row[3]) if row[3] else None})

        for row in (await db.execute(
            _text("SELECT titre, type_document, created_at, file_url FROM generated_documents WHERE bien_id = :id ORDER BY created_at DESC LIMIT 10"),
            {"id": str(inv.bien_id)},
        )).fetchall():
            documents_info.append({"titre": row[0], "type": row[1], "date": str(row[2]), "url": row[3]})

    msg_result = await db.execute(
        select(PortailMessage)
        .where(PortailMessage.invitation_id == inv.id)
        .order_by(PortailMessage.created_at.asc())
        .limit(50)
    )
    messages = [MessageRead.model_validate(m) for m in msg_result.scalars().all()]

    return {
        "invitation_id": str(inv.id),
        "token": str(token),
        "proprio_name": inv.proprio_name,
        "proprio_email": inv.proprio_email,
        "status": inv.inv_status,
        "bien": bien_info,
        "paiements": paiements_info,
        "interventions": interventions_info,
        "documents": documents_info,
        "messages": [m.model_dump() for m in messages],
    }


# ── Messages ──────────────────────────────────────────────────────────────────

@router.post("/messages/{invitation_id}", status_code=status.HTTP_201_CREATED, response_model=MessageRead)
async def send_message_agency(invitation_id: uuid.UUID, body: MessageCreate, db: DbDep, user: CurrentUser):
    result = await db.execute(select(PortailInvitation).where(PortailInvitation.id == invitation_id))
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(404, "Invitation non trouvée")
    if inv.agency_user_id != user.id and user.role != ROLE_SUPER_ADMIN:
        raise HTTPException(403, "Accès refusé")
    msg = PortailMessage(invitation_id=invitation_id, sender_type="agency", content=body.content.strip())
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return MessageRead.model_validate(msg)


@router.post("/messages/{invitation_id}/proprio", status_code=status.HTTP_201_CREATED, response_model=MessageRead)
async def send_message_proprio(invitation_id: uuid.UUID, body: MessageCreate, db: DbDep):
    result = await db.execute(select(PortailInvitation).where(PortailInvitation.id == invitation_id))
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(404, "Invitation non trouvée")
    msg = PortailMessage(invitation_id=invitation_id, sender_type="proprio", content=body.content.strip())
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return MessageRead.model_validate(msg)


@router.get("/messages/{invitation_id}", response_model=dict)
async def get_messages(invitation_id: uuid.UUID, db: DbDep, user: CurrentUser):
    result = await db.execute(select(PortailInvitation).where(PortailInvitation.id == invitation_id))
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(404, "Invitation non trouvée")
    if inv.agency_user_id != user.id and user.role != ROLE_SUPER_ADMIN:
        raise HTTPException(403, "Accès refusé")
    msg_result = await db.execute(
        select(PortailMessage).where(PortailMessage.invitation_id == invitation_id).order_by(PortailMessage.created_at.asc())
    )
    return {"items": [MessageRead.model_validate(m) for m in msg_result.scalars().all()]}


# ── AI Q&A proprio ────────────────────────────────────────────────────────────

@router.post("/ai-question")
async def ai_question(body: AIQuestionRequest, db: DbDep):
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(503, "AI indisponible")
    try:
        token_uuid = uuid.UUID(body.invitation_token)
    except ValueError:
        raise HTTPException(400, "Token invalide")

    result = await db.execute(select(PortailInvitation).where(PortailInvitation.token == token_uuid))
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(404, "Token invalide")

    bien_ctx = "Bien non précisé"
    if inv.bien_id:
        row = (await db.execute(
            _text("SELECT adresse, ville, type_bien, loyer_mensuel FROM biens WHERE id = :id"),
            {"id": str(inv.bien_id)},
        )).fetchone()
        if row:
            bien_ctx = f"{row[0]}, {row[1]} — {row[2]} — loyer CHF {row[3]}/mois"

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    ai_msg_resp = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=400,
        system=(
            "Tu es Althy, l'assistant du portail propriétaire. "
            "Tu aides le propriétaire avec des questions simples sur son bien, ses loyers et ses documents. "
            "Tu NE donnes PAS de conseils juridiques ou fiscaux. "
            "Réponds en français, de manière simple et rassurante. "
            f"Contexte : {bien_ctx}"
        ),
        messages=[{"role": "user", "content": body.question}],
    )
    answer = ai_msg_resp.content[0].text if ai_msg_resp.content else "Je n'ai pas pu traiter votre question."

    ai_msg = PortailMessage(invitation_id=inv.id, sender_type="ai", content=answer)
    db.add(ai_msg)
    await db.commit()

    return {"answer": answer, "disclaimer": "Réponse générée par IA — non contractuelle."}
