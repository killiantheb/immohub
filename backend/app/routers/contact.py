"""Contact form — POST /api/v1/contact

Envoie un email via Resend à support@althy.ch.
Rate-limited : 5 requêtes/minute par IP pour éviter le spam.
"""

from __future__ import annotations

import html as _html

import httpx
from app.core.config import settings
from app.core.rate_limit import limiter
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, EmailStr

router = APIRouter()

_CONTACT_EMAIL = "support@althy.ch"
_ALLOWED_SUBJECTS = {
    "support", "partenariat", "facturation", "rgpd", "presse", "autre", "",
}


class ContactRequest(BaseModel):
    nom: str
    email: EmailStr
    sujet: str = ""
    message: str


@router.post("/contact")
@limiter.limit("5/minute")
async def envoyer_contact(request: Request, body: ContactRequest):
    """Formulaire de contact public — envoie un email via Resend."""

    # Validation basique
    if len(body.nom) > 100:
        raise HTTPException(400, "Nom trop long")
    if len(body.message) > 5000:
        raise HTTPException(400, "Message trop long (max 5 000 caractères)")
    if body.sujet not in _ALLOWED_SUBJECTS:
        raise HTTPException(400, "Sujet invalide")

    if not settings.RESEND_API_KEY:
        # En dev sans clé Resend : log et retourner OK
        print(f"[CONTACT] {body.email} — {body.sujet}\n{body.message[:200]}")
        return {"ok": True}

    nom_esc = _html.escape(body.nom)
    email_esc = _html.escape(str(body.email))
    sujet_esc = _html.escape(body.sujet or "Autre")
    msg_esc = _html.escape(body.message).replace("\n", "<br>")

    subject_labels = {
        "support": "Support technique",
        "partenariat": "Partenariat / agence",
        "facturation": "Facturation / abonnement",
        "rgpd": "Données personnelles",
        "presse": "Presse / médias",
        "autre": "Autre",
        "": "Non précisé",
    }

    html_body = f"""
    <div style="font-family:sans-serif;max-width:600px;padding:24px">
      <h2 style="color:#E8602C;margin-bottom:4px">Nouveau message — Althy</h2>
      <p style="color:#888;font-size:13px;margin-bottom:24px">Via le formulaire althy.ch/contact</p>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:8px 0;color:#888;font-size:13px;width:120px">Nom</td>
            <td style="padding:8px 0;color:#333">{nom_esc}</td></tr>
        <tr><td style="padding:8px 0;color:#888;font-size:13px">Email</td>
            <td style="padding:8px 0"><a href="mailto:{email_esc}" style="color:#E8602C">{email_esc}</a></td></tr>
        <tr><td style="padding:8px 0;color:#888;font-size:13px">Sujet</td>
            <td style="padding:8px 0;color:#333">{subject_labels.get(body.sujet, sujet_esc)}</td></tr>
      </table>
      <hr style="margin:20px 0;border:none;border-top:1px solid #eee">
      <p style="color:#333;line-height:1.7">{msg_esc}</p>
    </div>
    """

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": f"Althy Contact <{settings.EMAILS_FROM}>",
                    "to": [_CONTACT_EMAIL],
                    "reply_to": str(body.email),
                    "subject": f"[Contact Althy] {subject_labels.get(body.sujet, body.sujet)} — {body.nom}",
                    "html": html_body,
                },
            )
            if resp.status_code not in (200, 201):
                raise HTTPException(502, "Erreur lors de l'envoi de l'email")
    except httpx.TimeoutException:
        raise HTTPException(504, "Délai d'envoi dépassé — réessayez plus tard")

    return {"ok": True}
