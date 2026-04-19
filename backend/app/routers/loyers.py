"""Router FastAPI — /api/v1/loyers
Architecture transit Althy : le loyer transite par le compte Althy.

Endpoints :
  POST  /generer-qr        — génère une QR-facture Swiss pour un loyer mensuel
  POST  /reconcilier       — réconciliation CAMT.054 ou liste manuelle
  GET   /                  — liste des loyer_transactions du proprio
  GET   /{id}              — détail d'une loyer_transaction
  PATCH /{id}/statut       — admin: forcer un statut (reversement manuel, etc.)
"""

from __future__ import annotations

import base64
import uuid as _uuid
from datetime import datetime
from typing import Annotated

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.services.qr_facture import generate_qr_bill_pdf, generate_qr_reference
from app.services.reconciliation import parse_camt054, reconcile_payments
from app.services.storage import upload_pdf, get_signed_url
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

DbDep   = Annotated[AsyncSession, Depends(get_db)]
AuthDep = Annotated[User, Depends(get_current_user)]

_MANAGER_ROLES = {"proprio_solo", "agence", "super_admin"}
_ADMIN_ROLES   = {"super_admin"}
_VALID_STATUTS = {"en_attente", "recu", "reverse", "en_retard", "conteste"}


# ── Schémas ───────────────────────────────────────────────────────────────────

class GenererQRRequest(BaseModel):
    property_id: _uuid.UUID
    mois: str  # "YYYY-MM"


class GenererQRResponse(BaseModel):
    transaction_id: str
    qr_reference: str
    montant_total: float
    commission_montant: float
    montant_reverse: float
    pdf_base64: str
    download_url: str | None = None


class GenererQuittanceRequest(BaseModel):
    property_id: _uuid.UUID
    mois: str  # "YYYY-MM"


class GenererQuittanceResponse(BaseModel):
    pdf_base64: str
    mois: str
    montant: float
    download_url: str | None = None


class ReconcilierRequest(BaseModel):
    fichier_camt: str | None = None   # base64 du fichier CAMT.054
    transactions: list[dict] | None = None  # [{reference, montant, date}]


class ReconcilierResponse(BaseModel):
    matches: int
    non_matches: int
    details: list[dict]


class PatchStatutRequest(BaseModel):
    statut: str
    reference_virement_sortant: str | None = None
    commentaire: str | None = None


# ── POST /loyers/generer-qr ───────────────────────────────────────────────────

@router.post("/generer-qr", response_model=GenererQRResponse, status_code=status.HTTP_201_CREATED)
async def generer_qr_facture(
    payload: GenererQRRequest,
    current_user: AuthDep,
    db: DbDep,
) -> GenererQRResponse:
    """Génère une QR-facture Swiss pour un loyer mensuel."""
    if current_user.role not in _MANAGER_ROLES:
        raise HTTPException(status_code=403, detail="Accès réservé aux propriétaires et agences.")
    try:
        mois_date = datetime.strptime(payload.mois + "-01", "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Format mois invalide (attendu: YYYY-MM).")

    # ── Bien ──
    prop = (await db.execute(
        text("SELECT id, address, monthly_rent, owner_id FROM properties WHERE id = :id AND is_active = true"),
        {"id": str(payload.property_id)},
    )).one_or_none()
    if not prop:
        raise HTTPException(status_code=404, detail="Bien introuvable.")
    if str(prop.owner_id) != str(current_user.id) and current_user.role not in {"super_admin"}:
        raise HTTPException(status_code=403, detail="Ce bien ne vous appartient pas.")
    if not prop.monthly_rent or float(prop.monthly_rent) <= 0:
        raise HTTPException(status_code=400, detail="Le bien n'a pas de loyer mensuel défini.")

    # ── Locataire actif ──
    tenant = (await db.execute(
        text("SELECT id FROM locataires WHERE bien_id = :bid AND statut = 'actif' ORDER BY created_at DESC LIMIT 1"),
        {"bid": str(payload.property_id)},
    )).one_or_none()
    tenant_id = _uuid.UUID(str(tenant.id)) if tenant else None

    # ── Doublon ──
    if (await db.execute(
        text("SELECT id FROM loyer_transactions WHERE property_id = :pid AND mois_concerne = :mois LIMIT 1"),
        {"pid": str(payload.property_id), "mois": mois_date},
    )).one_or_none():
        raise HTTPException(status_code=409, detail=f"Une transaction existe déjà pour {payload.mois}.")

    # ── Calcul montants ──
    montant_total      = float(prop.monthly_rent)
    commission_pct     = settings.ALTHY_COMMISSION_PCT
    commission_montant = round(montant_total * commission_pct, 2)
    montant_reverse    = round(montant_total - commission_montant, 2)
    qr_ref             = generate_qr_reference(payload.property_id, tenant_id, payload.mois)

    # ── Insertion DB ──
    tx_id = _uuid.uuid4()
    await db.execute(
        text("""
            INSERT INTO loyer_transactions
                (id, property_id, tenant_id, owner_id,
                 montant_total, commission_pct, commission_montant, montant_reverse,
                 qr_reference, statut, mois_concerne)
            VALUES
                (:id, :pid, :tid, :oid, :total, :cpct, :cmt, :rev, :qr_ref, 'en_attente', :mois)
        """),
        {
            "id": tx_id, "pid": str(payload.property_id),
            "tid": str(tenant_id) if tenant_id else None,
            "oid": str(current_user.id), "total": montant_total,
            "cpct": commission_pct, "cmt": commission_montant,
            "rev": montant_reverse, "qr_ref": qr_ref, "mois": mois_date,
        },
    )
    await db.commit()

    # ── Nom locataire pour le PDF ──
    tenant_name = "Locataire"
    if tenant_id:
        tname = (await db.execute(
            text("SELECT email FROM auth.users WHERE id = :tid"), {"tid": str(tenant_id)},
        )).one_or_none()
        if tname:
            tenant_name = tname.email.split("@")[0].capitalize()

    mois_label = mois_date.strftime("%B %Y").capitalize()
    pdf_bytes  = generate_qr_bill_pdf(
        qr_reference=qr_ref, montant_total=montant_total,
        property_address=prop.address, tenant_name=tenant_name,
        mois_label=mois_label, commission_pct=commission_pct,
        commission_montant=commission_montant, montant_reverse=montant_reverse,
    )

    # ── Upload Supabase Storage ──
    download_url: str | None = None
    try:
        key = await upload_pdf(
            user_id=str(current_user.id),
            property_id=str(payload.property_id),
            doc_type="qr-facture",
            mois=payload.mois,
            pdf_bytes=pdf_bytes,
        )
        download_url = await get_signed_url(key)
    except Exception:
        pass  # fallback: le client utilise pdf_base64

    return GenererQRResponse(
        transaction_id=str(tx_id), qr_reference=qr_ref,
        montant_total=montant_total, commission_montant=commission_montant,
        montant_reverse=montant_reverse,
        pdf_base64=base64.b64encode(pdf_bytes).decode("utf-8"),
        download_url=download_url,
    )


# ── POST /loyers/quittance ────────────────────────────────────────────────────

@router.post("/quittance", response_model=GenererQuittanceResponse)
async def generer_quittance(
    payload: GenererQuittanceRequest,
    current_user: AuthDep,
    db: DbDep,
) -> GenererQuittanceResponse:
    """Génère une quittance de loyer PDF (art. 88 CO)."""
    if current_user.role not in _MANAGER_ROLES:
        raise HTTPException(status_code=403, detail="Accès réservé aux propriétaires et agences.")
    try:
        mois_date = datetime.strptime(payload.mois + "-01", "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Format mois invalide (attendu: YYYY-MM).")

    # ── Bien ──
    prop = (await db.execute(
        text("SELECT id, address, monthly_rent, charges, owner_id FROM properties WHERE id = :id AND is_active = true"),
        {"id": str(payload.property_id)},
    )).one_or_none()
    if not prop:
        raise HTTPException(status_code=404, detail="Bien introuvable.")
    if str(prop.owner_id) != str(current_user.id) and current_user.role not in {"super_admin"}:
        raise HTTPException(status_code=403, detail="Ce bien ne vous appartient pas.")

    montant = float(prop.monthly_rent or 0)
    if montant <= 0:
        raise HTTPException(status_code=400, detail="Le bien n'a pas de loyer mensuel défini.")
    charges = float(getattr(prop, "charges", 0) or 0)

    # ── Locataire actif ──
    tenant_row = (await db.execute(
        text("""
            SELECT l.id, l.note_interne
            FROM locataires l
            WHERE l.bien_id = :bid AND l.statut = 'actif'
            ORDER BY l.created_at DESC LIMIT 1
        """),
        {"bid": str(payload.property_id)},
    )).one_or_none()
    tenant_name = "Locataire"
    if tenant_row and tenant_row.note_interne:
        first_line = tenant_row.note_interne.split("\n")[0].strip()
        if first_line:
            tenant_name = first_line

    # ── Proprio ──
    proprio_name = current_user.first_name or ""
    if current_user.last_name:
        proprio_name = f"{proprio_name} {current_user.last_name}".strip()
    if not proprio_name:
        proprio_name = current_user.email.split("@")[0].capitalize()

    # Adresse du proprio (profil)
    proprio_addr_row = (await db.execute(
        text("SELECT address FROM profiles WHERE user_id = :uid"),
        {"uid": str(current_user.id)},
    )).one_or_none()
    proprio_address = proprio_addr_row.address if proprio_addr_row and proprio_addr_row.address else ""

    mois_label = mois_date.strftime("%B %Y").capitalize()

    # ── PDF ──
    from app.services.quittance import generate_quittance_pdf
    pdf_bytes = generate_quittance_pdf(
        proprio_name=proprio_name,
        proprio_address=proprio_address,
        tenant_name=tenant_name,
        property_address=prop.address,
        mois_label=mois_label,
        montant=montant,
        charges=charges,
    )

    # ── Upload Supabase Storage ──
    download_url: str | None = None
    try:
        key = await upload_pdf(
            user_id=str(current_user.id),
            property_id=str(payload.property_id),
            doc_type="quittance",
            mois=payload.mois,
            pdf_bytes=pdf_bytes,
        )
        download_url = await get_signed_url(key)
    except Exception:
        pass  # fallback: le client utilise pdf_base64

    return GenererQuittanceResponse(
        pdf_base64=base64.b64encode(pdf_bytes).decode("utf-8"),
        mois=payload.mois,
        montant=montant,
        download_url=download_url,
    )


# ── POST /loyers/reconcilier ──────────────────────────────────────────────────

@router.post("/reconcilier", response_model=ReconcilierResponse)
async def reconcilier(
    payload: ReconcilierRequest,
    current_user: AuthDep,
    db: DbDep,
) -> ReconcilierResponse:
    """Réconciliation CAMT.054 ou liste manuelle. Admin uniquement."""
    if current_user.role not in _ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs.")

    incoming: list[dict] = []
    if payload.fichier_camt:
        try:
            incoming = parse_camt054(base64.b64decode(payload.fichier_camt))
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Fichier CAMT.054 invalide : {exc}")
    if payload.transactions:
        incoming.extend(payload.transactions)
    if not incoming:
        raise HTTPException(status_code=400, detail="Aucune transaction à reconcilier.")

    result = await reconcile_payments(incoming, db)
    return ReconcilierResponse(**result)


# ── GET /loyers ───────────────────────────────────────────────────────────────

@router.get("", response_model=list[dict])
async def list_loyer_transactions(
    current_user: AuthDep,
    db: DbDep,
    statut: str | None = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
) -> list[dict]:
    q = """
        SELECT lt.*, p.address AS property_address
        FROM loyer_transactions lt
        LEFT JOIN properties p ON p.id = lt.property_id
        WHERE lt.owner_id = :oid
    """
    params: dict = {"oid": str(current_user.id)}
    if statut:
        q += " AND lt.statut = :statut"
        params["statut"] = statut
    q += " ORDER BY lt.mois_concerne DESC, lt.created_at DESC"
    q += f" LIMIT {size} OFFSET {(page - 1) * size}"
    rows = (await db.execute(text(q), params)).mappings().all()
    return [dict(r) for r in rows]


# ── GET /loyers/{id} ──────────────────────────────────────────────────────────

@router.get("/{tx_id}", response_model=dict)
async def get_loyer_transaction(
    tx_id: _uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> dict:
    row = (await db.execute(
        text("""
            SELECT lt.*, p.address AS property_address
            FROM loyer_transactions lt
            LEFT JOIN properties p ON p.id = lt.property_id
            WHERE lt.id = :id
        """),
        {"id": str(tx_id)},
    )).mappings().one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Transaction introuvable.")
    r = dict(row)
    if str(r.get("owner_id")) != str(current_user.id) and current_user.role not in _ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Accès interdit.")
    return r


# ── PATCH /loyers/{id}/statut ─────────────────────────────────────────────────

@router.patch("/{tx_id}/statut", response_model=dict)
async def patch_loyer_statut(
    tx_id: _uuid.UUID,
    payload: PatchStatutRequest,
    current_user: AuthDep,
    db: DbDep,
) -> dict:
    """Admin uniquement — force un statut (ex: marquer 'reverse' après virement manuel)."""
    if current_user.role not in _ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs.")
    if payload.statut not in _VALID_STATUTS:
        raise HTTPException(status_code=400, detail=f"Statut invalide. Valeurs : {_VALID_STATUTS}")

    updates = ["statut = :statut", "updated_at = now()"]
    params: dict = {"id": str(tx_id), "statut": payload.statut}
    if payload.statut == "reverse":
        updates.append("date_reversement = now()")
        if payload.reference_virement_sortant:
            updates.append("reference_virement_sortant = :ref_v")
            params["ref_v"] = payload.reference_virement_sortant

    await db.execute(
        text(f"UPDATE loyer_transactions SET {', '.join(updates)} WHERE id = :id"),
        params,
    )
    await db.commit()

    if payload.statut == "reverse":
        from app.tasks.rent_tasks import _notify_proprio_reversement
        _notify_proprio_reversement.delay(str(tx_id))

    row = (await db.execute(
        text("SELECT * FROM loyer_transactions WHERE id = :id"), {"id": str(tx_id)},
    )).mappings().one_or_none()
    return dict(row) if row else {}
