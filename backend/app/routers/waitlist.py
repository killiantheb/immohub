"""Waitlist — collecte les emails depuis /bientot/[role].

Endpoints publics :
  POST /api/v1/waitlist                   — inscription d'un email
Endpoints admin (super_admin) :
  GET  /api/v1/waitlist                   — liste paginée
  GET  /api/v1/waitlist/stats             — count par rôle
  POST /api/v1/waitlist/{id}/notify       — envoi notification d'ouverture
"""

import html as _html
import logging
import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.rate_limit import limiter
from app.core.security import require_roles
from app.services.resend_service import (
    add_contact_to_audience,
    get_or_create_audience_for_role,
    send_transactional,
)

logger = logging.getLogger("althy.waitlist")
router = APIRouter()

DbDep = Annotated[AsyncSession, Depends(get_db)]
SuperAdmin = require_roles("super_admin")

Role = Literal[
    "artisan", "ouvreur", "expert", "hunter",
    "acheteur_premium", "agence", "portail_proprio", "other",
]

_ROLE_LABELS: dict[str, str] = {
    "artisan":          "Artisan / Professionnel",
    "ouvreur":          "Ouvreur",
    "expert":           "Expert immobilier",
    "hunter":           "Hunter",
    "acheteur_premium": "Acheteur Premium",
    "agence":           "Agence",
    "portail_proprio":  "Portail Proprio",
    "other":            "Autre",
}


# ── Schemas ────────────────────────────────────────────────────────────────────


class WaitlistJoin(BaseModel):
    email: EmailStr
    role: Role
    source: str = Field(default="bientot_page", max_length=64)
    metadata: dict = Field(default_factory=dict)


class WaitlistItem(BaseModel):
    id: str
    email: str
    role: str
    source: str | None
    created_at: str
    notified_at: str | None
    converted_user_id: str | None


class WaitlistPage(BaseModel):
    items: list[WaitlistItem]
    total: int
    page: int
    size: int


class WaitlistStats(BaseModel):
    total: int
    by_role: dict[str, int]
    pending_notification: int


class NotifyBody(BaseModel):
    subject: str = Field(min_length=3, max_length=120)
    html: str = Field(min_length=10, max_length=20_000)


# ── POST /waitlist (public) ────────────────────────────────────────────────────


@router.post("/waitlist")
@limiter.limit("10/minute")
async def join_waitlist(request: Request, body: WaitlistJoin, db: DbDep):
    """Inscription à la waitlist. Public, rate-limited 10/min/IP."""
    email_norm = body.email.lower().strip()

    # Insert idempotent — l'index unique (lower(email), role) évite les doublons
    row = (await db.execute(
        text("""
            insert into waitlist (email, role, source, metadata)
            values (:email, :role, :source, cast(:metadata as jsonb))
            on conflict (lower(email), role) do update
              set metadata = waitlist.metadata || excluded.metadata
            returning id, created_at
        """),
        {
            "email": email_norm,
            "role": body.role,
            "source": body.source,
            "metadata": _json_dumps(body.metadata),
        },
    )).one()
    await db.commit()

    entry_id = str(row.id)
    logger.info("waitlist.joined id=%s role=%s email=%s", entry_id, body.role, email_norm)

    # Best-effort : Resend audience + email de confirmation
    # Les erreurs réseau n'échouent pas la requête (l'entrée est déjà en DB).
    try:
        audience_id = await get_or_create_audience_for_role(body.role)
        if audience_id:
            await add_contact_to_audience(email_norm, audience_id)
    except Exception as exc:  # noqa: BLE001
        logger.warning("waitlist.resend_audience_error: %s", exc)

    try:
        await _send_confirmation(email_norm, body.role)
    except Exception as exc:  # noqa: BLE001
        logger.warning("waitlist.resend_confirm_error: %s", exc)

    return {"ok": True, "id": entry_id}


# ── GET /waitlist/stats (admin) ────────────────────────────────────────────────


@router.get("/waitlist/stats", response_model=WaitlistStats)
async def waitlist_stats(db: DbDep, _user=Depends(SuperAdmin)):
    rows = (await db.execute(text("""
        select role, count(*)::int as n,
               sum(case when notified_at is null then 1 else 0 end)::int as pending
        from waitlist
        group by role
    """))).all()

    by_role: dict[str, int] = {}
    total = 0
    pending = 0
    for r in rows:
        by_role[r.role] = r.n
        total += r.n
        pending += r.pending or 0

    return WaitlistStats(total=total, by_role=by_role, pending_notification=pending)


# ── GET /waitlist (admin, paginated) ───────────────────────────────────────────


@router.get("/waitlist", response_model=WaitlistPage)
async def list_waitlist(
    db: DbDep,
    _user=Depends(SuperAdmin),
    role: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=50, ge=1, le=500),
):
    offset = (page - 1) * size
    params: dict = {"limit": size, "offset": offset}
    where = ""
    if role:
        where = "where role = :role"
        params["role"] = role

    total = (await db.execute(
        text(f"select count(*)::int as n from waitlist {where}"),
        params,
    )).scalar_one()

    rows = (await db.execute(
        text(f"""
            select id, email, role, source, created_at, notified_at, converted_user_id
            from waitlist
            {where}
            order by created_at desc
            limit :limit offset :offset
        """),
        params,
    )).all()

    items = [
        WaitlistItem(
            id=str(r.id),
            email=r.email,
            role=r.role,
            source=r.source,
            created_at=r.created_at.isoformat() if r.created_at else "",
            notified_at=r.notified_at.isoformat() if r.notified_at else None,
            converted_user_id=str(r.converted_user_id) if r.converted_user_id else None,
        )
        for r in rows
    ]
    return WaitlistPage(items=items, total=total, page=page, size=size)


# ── POST /waitlist/{id}/notify (admin) ─────────────────────────────────────────


@router.post("/waitlist/{entry_id}/notify")
async def notify_entry(
    entry_id: str,
    body: NotifyBody,
    db: DbDep,
    _user=Depends(SuperAdmin),
):
    try:
        eid = uuid.UUID(entry_id)
    except ValueError:
        raise HTTPException(400, "id invalide") from None

    row = (await db.execute(
        text("select email, role, notified_at from waitlist where id = :id"),
        {"id": str(eid)},
    )).one_or_none()
    if not row:
        raise HTTPException(404, "Entrée introuvable")

    msg_id = await send_transactional(to=row.email, subject=body.subject, html=body.html)
    if msg_id is None:
        raise HTTPException(502, "Envoi email échoué (Resend indisponible ou clé manquante)")

    await db.execute(
        text("update waitlist set notified_at = now() where id = :id"),
        {"id": str(eid)},
    )
    await db.commit()
    return {"ok": True, "message_id": msg_id}


# ── Helpers ────────────────────────────────────────────────────────────────────


async def _send_confirmation(email: str, role: str) -> None:
    """Email de confirmation post-inscription."""
    label = _ROLE_LABELS.get(role, role)
    label_esc = _html.escape(label)
    html_body = f"""
    <div style="font-family:system-ui,sans-serif;max-width:560px;padding:24px;color:#1A1208">
      <h2 style="color:#0F2E4C;margin-bottom:8px;font-weight:400">Merci — nous vous préviendrons.</h2>
      <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px">
        Vous faites désormais partie de la waitlist <strong>{label_esc}</strong> d'Althy.
      </p>
      <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px">
        Dès que cette fonctionnalité sera ouverte, vous recevrez un email à l'adresse
        <strong>{_html.escape(email)}</strong> avec un lien d'accès prioritaire.
      </p>
      <hr style="border:none;border-top:1px solid #E8E4DC;margin:24px 0">
      <p style="color:#64748B;font-size:13px;margin:0">
        En attendant, vous pouvez explorer Althy sur
        <a href="https://althy.ch" style="color:#0F2E4C">althy.ch</a>.
      </p>
    </div>
    """
    await send_transactional(
        to=email,
        subject=f"Bienvenue sur la waitlist Althy — {label}",
        html=html_body,
    )


def _json_dumps(data: dict) -> str:
    import json
    return json.dumps(data, ensure_ascii=False)
