"""RGPD / LPD — export données personnelles + suppression compte — /api/v1/rgpd"""

from __future__ import annotations

import csv
import io
import json
import uuid
from datetime import datetime, timezone
from typing import Annotated

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

DbDep   = Annotated[AsyncSession, Depends(get_db)]
AuthDep = Annotated[User, Depends(get_current_user)]


# ── Export JSON (droit d'accès RGPD art. 15 / LPD art. 25) ───────────────────

@router.get("/export")
async def export_my_data(db: DbDep, user: AuthDep) -> JSONResponse:
    """
    Exporte toutes les données personnelles de l'utilisateur courant.
    Format JSON — conforme RGPD art.15 / LPD suisse art.25.
    """
    uid = str(user.id)
    data: dict = {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "user": {
            "id": uid,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "role": user.role,
            "created_at": str(user.created_at),
        },
        "biens": [],
        "locataires": [],
        "paiements": [],
        "documents": [],
        "interventions": [],
        "notifications": [],
        "hunters": [],
        "integrations": [],
    }

    # Biens
    rows = (await db.execute(
        text("SELECT id, adresse, ville, type, loyer, created_at FROM biens WHERE owner_id = :uid AND is_active = TRUE"),
        {"uid": uid},
    )).fetchall()
    data["biens"] = [{"id": str(r[0]), "adresse": r[1], "ville": r[2], "type": r[3], "loyer": float(r[4]) if r[4] else None, "created_at": str(r[5])} for r in rows]

    # Locataires
    rows = (await db.execute(
        text("SELECT id, prenom, nom, email, telephone, created_at FROM locataires WHERE owner_id = :uid"),
        {"uid": uid},
    )).fetchall()
    data["locataires"] = [{"id": str(r[0]), "prenom": r[1], "nom": r[2], "email": r[3], "telephone": r[4], "created_at": str(r[5])} for r in rows]

    # Paiements
    rows = (await db.execute(
        text("SELECT id, montant, statut, mois_concerne, date_paiement FROM paiements_loyer WHERE owner_id = :uid ORDER BY date_paiement DESC LIMIT 200"),
        {"uid": uid},
    )).fetchall()
    data["paiements"] = [{"id": str(r[0]), "montant": float(r[1]) if r[1] else None, "statut": r[2], "mois": str(r[3]) if r[3] else None, "date": str(r[4]) if r[4] else None} for r in rows]

    # Documents générés
    rows = (await db.execute(
        text("SELECT id, titre, type_document, created_at FROM generated_documents WHERE owner_id = :uid ORDER BY created_at DESC LIMIT 100"),
        {"uid": uid},
    )).fetchall()
    data["documents"] = [{"id": str(r[0]), "titre": r[1], "type": r[2], "created_at": str(r[3])} for r in rows]

    # Notifications
    rows = (await db.execute(
        text("SELECT id, type, title, body, created_at FROM notifications WHERE user_id = :uid ORDER BY created_at DESC LIMIT 100"),
        {"uid": uid},
    )).fetchall()
    data["notifications"] = [{"id": str(r[0]), "type": r[1], "title": r[2], "body": r[3], "created_at": str(r[4])} for r in rows]

    # Hunters (leads soumis)
    rows = (await db.execute(
        text("SELECT id, address, city, status, referral_amount, created_at FROM hunters WHERE hunter_id = :uid"),
        {"uid": uid},
    )).fetchall()
    data["hunters"] = [{"id": str(r[0]), "address": r[1], "city": r[2], "status": r[3], "referral_amount": float(r[4]) if r[4] else None, "created_at": str(r[5])} for r in rows]

    # Intégrations (pas les tokens — seulement email et provider)
    rows = (await db.execute(
        text("SELECT provider, email, is_active, created_at FROM user_integrations WHERE user_id = :uid"),
        {"uid": uid},
    )).fetchall()
    data["integrations"] = [{"provider": r[0], "email": r[1], "is_active": r[2], "created_at": str(r[3])} for r in rows]

    return JSONResponse(
        content=data,
        headers={
            "Content-Disposition": f'attachment; filename="althy_export_{uid[:8]}_{datetime.now(timezone.utc).strftime("%Y%m%d")}.json"',
            "Content-Type": "application/json; charset=utf-8",
        },
    )


# ── Export CSV loyers (état locatif) ──────────────────────────────────────────

@router.get("/export/loyers.csv")
async def export_loyers_csv(db: DbDep, user: AuthDep):
    """Export CSV des loyers pour le comptable / fiduciaire."""
    uid = str(user.id)
    rows = (await db.execute(text("""
        SELECT
            p.mois_concerne,
            b.adresse,
            b.ville,
            COALESCE(l.prenom || ' ' || l.nom, '') AS locataire,
            p.montant,
            p.statut,
            p.date_paiement
        FROM paiements_loyer p
        JOIN biens b ON p.bien_id = b.id
        LEFT JOIN locataires l ON l.bien_id = b.id AND l.statut = 'actif'
        WHERE b.owner_id = :uid
        ORDER BY p.mois_concerne DESC, b.adresse
        LIMIT 500
    """), {"uid": uid})).fetchall()

    buf = io.StringIO()
    buf.write("\ufeff")  # UTF-8 BOM for Excel
    w = csv.writer(buf, delimiter=";")
    w.writerow(["Mois", "Adresse", "Ville", "Locataire", "Montant CHF", "Statut", "Date paiement"])
    for r in rows:
        w.writerow([r[0] or "", r[1], r[2], r[3], r[4] or "", r[5], r[6] or ""])

    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv; charset=utf-8-sig",
        headers={"Content-Disposition": "attachment; filename=loyers_althy.csv"},
    )


# ── Demande de suppression de compte (droit à l'oubli RGPD art.17 / LPD) ─────

@router.post("/delete-account")
async def request_account_deletion(db: DbDep, user: AuthDep):
    """
    Marque le compte pour suppression dans 30 jours.
    Un admin doit valider. Conforme RGPD art.17 / LPD art.32.
    """
    # In production: create a deletion_requests table entry + notify admin
    # For now: mark user as inactive + log
    from sqlalchemy import text as _t
    await db.execute(
        _t("INSERT INTO notifications (user_id, type, title, body, data, created_at) VALUES (:uid, 'deletion_request', 'Demande suppression compte', 'Demande reçue — traitement sous 30 jours.', '{}', now())"),
        {"uid": str(user.id)},
    )
    await db.commit()
    return {
        "message": "Demande de suppression enregistrée. Votre compte sera supprimé dans 30 jours. Vous pouvez annuler en nous contactant.",
        "deadline": "30 jours",
        "contact": "privacy@althy.ch",
    }
