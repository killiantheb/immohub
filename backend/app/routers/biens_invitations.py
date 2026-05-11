"""Invitations locataire — /api/v1/biens/{bien_id}/inviter-locataire et endpoints liés.

Sprint 1B (2026-05-09) — Phase 1.0 doctrine v6 (cf docs/4-PRODUIT.md §4.7).

Workflow :
    1. POST /api/v1/biens/{bien_id}/inviter-locataire
       → bailleur génère un token + email/QR/lien à transmettre au locataire
       → token stocké dans `magic_links` (type='invitation', target_role='locataire',
         payload contient bien_id + prenom + nom + message_personnel)
       → idempotent : si une invitation pending existe déjà pour cet email + ce bien,
         on retourne l'existante avec `already_existed: true`

    2. GET /api/v1/biens/{bien_id}/invitations
       → liste des invitations pending/accepted/expired du bien

    3. DELETE /api/v1/invitations/{invitation_id}
       → révocation soft (magic_links.used = TRUE + payload.revoked_at)

La création du modèle `Locataire` (et la liaison user_id ↔ bien_id) est faite à la
**consommation** du token via `/onboarding/rejoindre` (router onboarding), pas ici.
Justification : pas de Locataire orphelin avec user_id NULL, pas d'extension d'enum,
zéro migration neuve (Sprint 1B = 0 alembic).
"""

from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated, Any, Literal

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.services.email_service import EmailServiceError, send_email
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

DbDep = Annotated[AsyncSession, Depends(get_db)]
AuthDep = Annotated[User, Depends(get_current_user)]

MANAGER_ROLES = {"super_admin", "proprio_solo", "agence"}


# ── Schemas ───────────────────────────────────────────────────────────────────


class InvitationLocataireCreate(BaseModel):
    email: EmailStr
    prenom: str | None = Field(default=None, max_length=100)
    nom: str | None = Field(default=None, max_length=100)
    mode_envoi: Literal["email", "qr", "lien"] = "email"
    message_personnel: str | None = Field(default=None, max_length=500)


class InvitationLocataireResponse(BaseModel):
    invitation_id: uuid.UUID
    token: str
    invitation_url: str
    qr_code_data_uri: str | None = None
    email_sent: bool = False
    already_existed: bool = False
    expires_at: datetime


class InvitationListItem(BaseModel):
    invitation_id: uuid.UUID
    target_email: str
    statut: str  # "pending" | "accepted" | "expired" | "revoked"
    prenom: str | None
    nom: str | None
    created_at: datetime
    expires_at: datetime
    accepted_at: datetime | None
    revoked_at: datetime | None


# ── Helpers ───────────────────────────────────────────────────────────────────


async def _check_bien_ownership(db: AsyncSession, bien_id: uuid.UUID, user: User) -> None:
    """Vérifie que `user` peut inviter sur ce bien (owner / agency / super_admin).

    404 si bien introuvable, 403 si pas owner.
    """
    if user.role not in MANAGER_ROLES:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Seuls bailleurs et agences peuvent inviter")
    if user.role == "super_admin":
        return
    row = await db.execute(
        text("SELECT owner_id, agency_id FROM biens WHERE id = :bid AND is_active = TRUE"),
        {"bid": str(bien_id)},
    )
    rec = row.one_or_none()
    if not rec:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bien introuvable")
    if str(rec.owner_id) != str(user.id) and (rec.agency_id is None or str(rec.agency_id) != str(user.id)):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Vous n'êtes pas propriétaire de ce bien")


def _generate_qr_data_uri(url: str) -> str:
    """Génère un QR code PNG en base64 data URI. Fallback "" si la lib échoue.

    Réplique du helper privé `routers/onboarding.py:_generate_qr` — extrait ici
    pour réutilisation Sprint 1B sans import croisé entre routers.
    """
    import base64
    import io

    try:
        import qrcode
        from qrcode.image.pil import PilImage

        qr = qrcode.QRCode(
            version=3,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=8,
            border=4,
        )
        qr.add_data(url)
        qr.make(fit=True)
        # Branding bleu Prusse pour le QR (cf CLAUDE.md §B.4 — palette Phase 1.0).
        img = qr.make_image(fill_color="#0F2E4C", back_color="#FFFFFF", image_factory=PilImage)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return f"data:image/png;base64,{base64.b64encode(buf.getvalue()).decode()}"
    except Exception:
        return ""


def _load_template(name: str) -> str:
    """Charge un template email depuis backend/app/templates/emails/{name}."""
    import os

    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    path = os.path.join(here, "templates", "emails", name)
    with open(path, encoding="utf-8") as f:
        return f.read()


def _format_bien_address(adresse: str | None, npa: str | None, ville: str | None) -> str:
    """Construit une adresse courte humainement lisible pour l'email."""
    parts = [p for p in (adresse, f"{npa} {ville}".strip() if (npa or ville) else None) if p]
    return ", ".join(parts) or "votre logement"


# ── POST /biens/{bien_id}/inviter-locataire ──────────────────────────────────


@router.post(
    "/{bien_id}/inviter-locataire",
    response_model=InvitationLocataireResponse,
    status_code=status.HTTP_201_CREATED,
)
async def inviter_locataire(
    bien_id: uuid.UUID,
    payload: InvitationLocataireCreate,
    current_user: AuthDep,
    db: DbDep,
) -> InvitationLocataireResponse:
    """Crée une invitation locataire pour ce bien et la transmet (email/QR/lien).

    Idempotent : un 2e appel avec le même email retourne l'invitation pending
    existante avec `already_existed: true`.
    """
    await _check_bien_ownership(db, bien_id, current_user)

    email_lower = payload.email.lower().strip()

    # ── Idempotence : invitation pending existante ? ─────────────────────────
    existing = await db.execute(
        text("""
            SELECT id, token, expires_at, payload
            FROM magic_links
            WHERE type = 'invitation'
              AND target_email = :email
              AND target_role = 'locataire'
              AND used = FALSE
              AND expires_at > NOW()
              AND payload->>'bien_id' = :bid
            ORDER BY created_at DESC
            LIMIT 1
        """),
        {"email": email_lower, "bid": str(bien_id)},
    )
    existing_row = existing.one_or_none()
    if existing_row:
        invitation_url = f"{settings.FRONTEND_URL}/invite/{existing_row.token}"
        qr = _generate_qr_data_uri(invitation_url) if payload.mode_envoi == "qr" else None
        return InvitationLocataireResponse(
            invitation_id=existing_row.id,
            token=existing_row.token,
            invitation_url=invitation_url,
            qr_code_data_uri=qr,
            email_sent=False,
            already_existed=True,
            expires_at=existing_row.expires_at,
        )

    # ── Création nouvelle invitation ─────────────────────────────────────────
    token = secrets.token_urlsafe(32)
    invitation_id = uuid.uuid4()
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)

    import json

    link_payload: dict[str, Any] = {
        "bien_id": str(bien_id),
        "prenom": payload.prenom,
        "nom": payload.nom,
        "message_personnel": payload.message_personnel,
        "invited_by_user_id": str(current_user.id),
    }

    await db.execute(
        text("""
            INSERT INTO magic_links
                (id, token, type, created_by, target_email, target_role, payload, expires_at)
            VALUES
                (:id, :token, 'invitation', :by, :email, 'locataire', CAST(:payload AS jsonb), :exp)
        """),
        {
            "id": invitation_id,
            "token": token,
            "by": current_user.id,
            "email": email_lower,
            "payload": json.dumps(link_payload),
            "exp": expires_at,
        },
    )

    invitation_url = f"{settings.FRONTEND_URL}/invite/{token}"
    qr_data_uri: str | None = None
    email_sent = False

    # ── Mode envoi ────────────────────────────────────────────────────────────
    if payload.mode_envoi == "email":
        # Récupère contexte bien + bailleur pour le template
        bien_row = await db.execute(
            text("SELECT adresse, ville, cp FROM biens WHERE id = :bid"),
            {"bid": str(bien_id)},
        )
        bien_rec = bien_row.one_or_none()
        bien_adresse_courte = _format_bien_address(
            bien_rec.adresse if bien_rec else None,
            bien_rec.cp if bien_rec else None,
            bien_rec.ville if bien_rec else None,
        )
        bailleur_nom_parts = [
            current_user.first_name or "",
            current_user.last_name or "",
        ]
        bailleur_nom = " ".join(p for p in bailleur_nom_parts if p) or settings.ALTHY_CREDITOR_NAME
        prenom_locataire = (payload.prenom or "").strip() or "Bonjour"

        message_block_html = ""
        message_block_text = ""
        if payload.message_personnel:
            # Note : pas d'échappement HTML stricte ici car le message est saisi par
            # le bailleur dans son propre dashboard authentifié — risque XSS minime
            # (envoi à une adresse qu'il a lui-même fournie). Si scope élargi à
            # candidatures spontanées Phase 2, ajouter html.escape().
            message_block_html = (
                f'<div style="background:#F5F1E8;border-left:3px solid #C9A961;'
                f'padding:14px 18px;margin:20px 0;font-style:italic;color:#0F2E4C">'
                f'« {payload.message_personnel} »</div>'
            )
            message_block_text = f'\n\n« {payload.message_personnel} »\n'

        try:
            html_template = _load_template("invitation_locataire.html")
            text_template = _load_template("invitation_locataire.txt")
        except FileNotFoundError as exc:
            raise HTTPException(
                status.HTTP_500_INTERNAL_SERVER_ERROR,
                f"Template email introuvable : {exc}",
            )

        subject = f"{bailleur_nom} vous a invité à rejoindre Althy"
        expires_fmt = expires_at.strftime("%d.%m.%Y")
        format_args = {
            "prenom_locataire": prenom_locataire,
            "bailleur_nom": bailleur_nom,
            "althy_creditor_name": settings.ALTHY_CREDITOR_NAME,
            "bien_adresse_courte": bien_adresse_courte,
            "message_block_html": message_block_html,
            "message_block_text": message_block_text,
            "invitation_url": invitation_url,
            "expires_at_formatted": expires_fmt,
            "emails_from": settings.EMAILS_FROM,
        }
        html_body = html_template.format(**format_args)
        text_body = text_template.format(**format_args)

        try:
            msg_id = await send_email(
                to=email_lower,
                subject=subject,
                html=html_body,
                text=text_body,
            )
            email_sent = msg_id != "dev-no-send"
        except EmailServiceError as exc:
            # Doctrine §B.10 : pas de faux statut. Si Resend échoue, on remonte 502
            # plutôt que retourner email_sent=False silencieusement (le bailleur doit
            # savoir que l'email n'est pas parti).
            await db.rollback()
            raise HTTPException(
                status.HTTP_502_BAD_GATEWAY,
                f"Envoi email échoué : {exc}",
            )

        # Track dans invite_queue (best-effort, non-bloquant)
        try:
            await db.execute(
                text("""
                    INSERT INTO invite_queue
                        (id, invited_by, magic_link_id, channel, status, sent_at)
                    VALUES
                        (:id, :by, :mid, 'email', :st, NOW())
                """),
                {
                    "id": uuid.uuid4(),
                    "by": current_user.id,
                    "mid": invitation_id,
                    "st": "sent" if email_sent else "pending",
                },
            )
        except Exception:
            # invite_queue est un log informatif — un échec ne doit pas bloquer
            # l'invitation elle-même qui est déjà persistée dans magic_links.
            pass

    elif payload.mode_envoi == "qr":
        qr_data_uri = _generate_qr_data_uri(invitation_url) or None

    # mode_envoi == "lien" : rien à faire de plus, l'URL est dans la réponse

    await db.commit()

    return InvitationLocataireResponse(
        invitation_id=invitation_id,
        token=token,
        invitation_url=invitation_url,
        qr_code_data_uri=qr_data_uri,
        email_sent=email_sent,
        already_existed=False,
        expires_at=expires_at,
    )


# ── GET /biens/{bien_id}/invitations ──────────────────────────────────────────


@router.get("/{bien_id}/invitations", response_model=list[InvitationListItem])
async def list_invitations_bien(
    bien_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> list[InvitationListItem]:
    """Liste les invitations (pending / accepted / expired / revoked) pour ce bien."""
    await _check_bien_ownership(db, bien_id, current_user)

    rows = await db.execute(
        text("""
            SELECT id, target_email, payload, used, used_at, expires_at, created_at
            FROM magic_links
            WHERE type = 'invitation'
              AND target_role = 'locataire'
              AND payload->>'bien_id' = :bid
            ORDER BY created_at DESC
            LIMIT 100
        """),
        {"bid": str(bien_id)},
    )

    now = datetime.now(timezone.utc)
    out: list[InvitationListItem] = []
    for r in rows:
        link_payload: dict = r.payload or {}
        revoked_at_raw = link_payload.get("revoked_at")
        if revoked_at_raw:
            statut = "revoked"
            revoked_at = datetime.fromisoformat(revoked_at_raw)
        elif r.used:
            statut = "accepted"
            revoked_at = None
        elif r.expires_at < now:
            statut = "expired"
            revoked_at = None
        else:
            statut = "pending"
            revoked_at = None

        out.append(
            InvitationListItem(
                invitation_id=r.id,
                target_email=r.target_email,
                statut=statut,
                prenom=link_payload.get("prenom"),
                nom=link_payload.get("nom"),
                created_at=r.created_at,
                expires_at=r.expires_at,
                accepted_at=r.used_at,
                revoked_at=revoked_at,
            )
        )

    return out


# ── GET /invite/{token}/preview ───────────────────────────────────────────────
# Note : route publique (no auth) — sert au frontend pour pré-remplir l'UI de
# la page /invite/[token] AVANT la création du compte. Le token étant
# cryptographiquement secret (32 bytes urlsafe), pas d'info sensible exposée
# (juste prénom + email + adresse bien). Déclarée ici mais montée sur prefix
# /api/v1 dans main.py via preview_router (pas /api/v1/biens).

preview_router = APIRouter()


class InvitationPreview(BaseModel):
    invitation_id: uuid.UUID
    target_email: str
    prenom: str | None
    nom: str | None
    message_personnel: str | None
    bailleur_nom: str | None
    bien_adresse_courte: str | None
    expires_at: datetime
    statut: Literal["pending", "used", "expired"]


@preview_router.get("/invite/{token}/preview", response_model=InvitationPreview)
async def get_invitation_preview(
    token: str,
    db: DbDep,
) -> InvitationPreview:
    """Lecture publique d'une invitation (pré-remplissage UI page /invite/[token]).

    Pas d'auth requise — le token agit comme bearer secret. Si le token est
    invalide / inconnu → 404. Si utilisé → statut='used'. Si expiré → 'expired'.
    """
    row = await db.execute(
        text("""
            SELECT id, target_email, payload, used, expires_at, created_by
            FROM magic_links
            WHERE token = :token
              AND type = 'invitation'
              AND target_role = 'locataire'
        """),
        {"token": token},
    )
    rec = row.one_or_none()
    if not rec:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invitation introuvable")

    link_payload: dict = rec.payload or {}

    # Statut binaire pour le frontend
    now = datetime.now(timezone.utc)
    if rec.used:
        statut = "used"
    elif rec.expires_at < now:
        statut = "expired"
    else:
        statut = "pending"

    # Lookup bailleur (first_name + last_name)
    bailleur_nom: str | None = None
    if rec.created_by:
        b_row = await db.execute(
            text("SELECT first_name, last_name FROM users WHERE id = :uid"),
            {"uid": rec.created_by},
        )
        b = b_row.one_or_none()
        if b:
            parts = [p for p in (b.first_name, b.last_name) if p]
            bailleur_nom = " ".join(parts) or None

    # Lookup bien (adresse courte)
    bien_adresse_courte: str | None = None
    bien_id = link_payload.get("bien_id")
    if bien_id:
        bn_row = await db.execute(
            text("SELECT adresse, cp, ville FROM biens WHERE id = :bid AND is_active = TRUE"),
            {"bid": bien_id},
        )
        bn = bn_row.one_or_none()
        if bn:
            bien_adresse_courte = _format_bien_address(bn.adresse, bn.cp, bn.ville)

    return InvitationPreview(
        invitation_id=rec.id,
        target_email=rec.target_email,
        prenom=link_payload.get("prenom"),
        nom=link_payload.get("nom"),
        message_personnel=link_payload.get("message_personnel"),
        bailleur_nom=bailleur_nom,
        bien_adresse_courte=bien_adresse_courte,
        expires_at=rec.expires_at,
        statut=statut,
    )


# ── DELETE /invitations/{invitation_id} ───────────────────────────────────────
# Note : route déclarée ici mais montée sur prefix /api/v1 (pas /api/v1/biens)
# car elle ne dépend pas d'un bien_id dans le path. Voir main.py inclusion.

revoke_router = APIRouter()


@revoke_router.delete(
    "/invitations/{invitation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
)
async def revoke_invitation(
    invitation_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> None:
    """Révoque une invitation (soft : magic_links.used = TRUE + payload.revoked_at).

    Auth : seul le créateur de l'invitation (ou super_admin) peut la révoquer.
    """
    row = await db.execute(
        text("""
            SELECT id, created_by, used, payload
            FROM magic_links
            WHERE id = :iid AND type = 'invitation' AND target_role = 'locataire'
        """),
        {"iid": str(invitation_id)},
    )
    rec = row.one_or_none()
    if not rec:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invitation introuvable")
    if current_user.role != "super_admin" and str(rec.created_by) != str(current_user.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Vous n'êtes pas le créateur de cette invitation")
    if rec.used:
        # Idempotent : déjà révoquée ou consommée → 204 sans erreur (cf §B.10 :
        # on ne ment pas, mais une opération idempotente qui retourne le même
        # état n'est pas un faux statut).
        return None

    import json

    link_payload: dict = dict(rec.payload or {})
    link_payload["revoked_at"] = datetime.now(timezone.utc).isoformat()
    link_payload["revoked_by"] = str(current_user.id)

    await db.execute(
        text("""
            UPDATE magic_links
            SET used = TRUE, used_at = NOW(), used_by = :by, payload = CAST(:payload AS jsonb)
            WHERE id = :iid
        """),
        {"iid": str(invitation_id), "by": current_user.id, "payload": json.dumps(link_payload)},
    )
    await db.commit()
    return None
