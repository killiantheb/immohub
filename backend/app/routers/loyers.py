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
from app.models.locataire import Locataire
from app.models.user import User
from app.services.iban_resolver import get_effective_iban
from app.services.qr_facture import generate_qr_bill_pdf, generate_qr_reference
from app.services.reconciliation import parse_camt054, reconcile_payments
from app.services.storage import get_signed_url, upload_pdf
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

DbDep   = Annotated[AsyncSession, Depends(get_db)]
AuthDep = Annotated[User, Depends(get_current_user)]

_MANAGER_ROLES = {"proprio_solo", "agence", "super_admin"}
_ADMIN_ROLES   = {"super_admin"}
_VALID_STATUTS = {"en_attente", "recu", "reverse", "en_retard", "conteste"}


# ── Schémas ───────────────────────────────────────────────────────────────────

class GenererQRRequest(BaseModel):
    bien_id: _uuid.UUID
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
    bien_id: _uuid.UUID
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


class GenererAnneeRequest(BaseModel):
    """Génération batch des 12 mois d'une année (Sprint 8 Lot B)."""
    bien_id: _uuid.UUID
    annee: int  # ex. 2026


class GenererAnneeResponse(BaseModel):
    bien_id: _uuid.UUID
    annee: int
    created_count: int
    skipped_count: int
    created_months: list[str]
    skipped_months: list[str]


class ImportCamtResponse(BaseModel):
    """Résultat d'un import CAMT.054 (Sprint 8 Lot B)."""
    matched_count: int
    unmatched_count: int
    matched_details: list[dict]
    unmatched_details: list[dict]


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
    bien = (await db.execute(
        text("SELECT id, adresse, loyer, owner_id FROM biens WHERE id = :id AND is_active = true"),
        {"id": str(payload.bien_id)},
    )).one_or_none()
    if not bien:
        raise HTTPException(status_code=404, detail="Bien introuvable.")
    if str(bien.owner_id) != str(current_user.id) and current_user.role not in {"super_admin"}:
        raise HTTPException(status_code=403, detail="Ce bien ne vous appartient pas.")
    if not bien.loyer or float(bien.loyer) <= 0:
        raise HTTPException(status_code=400, detail="Le bien n'a pas de loyer défini.")

    # ── Locataire actif ──
    tenant = (await db.execute(
        text("SELECT id FROM locataires WHERE bien_id = :bid AND statut = 'actif' ORDER BY created_at DESC LIMIT 1"),
        {"bid": str(payload.bien_id)},
    )).one_or_none()
    tenant_id = _uuid.UUID(str(tenant.id)) if tenant else None

    # ── Doublon ──
    if (await db.execute(
        text("SELECT id FROM loyer_transactions WHERE bien_id = :bid AND mois_concerne = :mois LIMIT 1"),
        {"bid": str(payload.bien_id), "mois": mois_date},
    )).one_or_none():
        raise HTTPException(status_code=409, detail=f"Une transaction existe déjà pour {payload.mois}.")

    # ── Calcul montants ──
    montant_total      = float(bien.loyer)
    commission_pct     = settings.ALTHY_COMMISSION_PCT
    commission_montant = round(montant_total * commission_pct, 2)
    montant_reverse    = round(montant_total - commission_montant, 2)
    qr_ref             = generate_qr_reference(payload.bien_id, tenant_id, payload.mois)

    # ── Insertion DB ──
    tx_id = _uuid.uuid4()
    await db.execute(
        text("""
            INSERT INTO loyer_transactions
                (id, bien_id, tenant_id, owner_id,
                 montant_total, commission_pct, commission_montant, montant_reverse,
                 qr_reference, statut, mois_concerne)
            VALUES
                (:id, :bid, :tid, :oid, :total, :cpct, :cmt, :rev, :qr_ref, 'en_attente', :mois)
        """),
        {
            "id": tx_id, "bid": str(payload.bien_id),
            "tid": str(tenant_id) if tenant_id else None,
            "oid": str(current_user.id), "total": montant_total,
            "cpct": commission_pct, "cmt": commission_montant,
            "rev": montant_reverse, "qr_ref": qr_ref, "mois": mois_date,
        },
    )
    await db.commit()

    # ── Nom locataire pour le PDF ──
    # Sprint 7 A1 fix : le code historique faisait `SELECT email FROM
    # auth.users WHERE id = :tid` avec `tid = locataires.id` (UUID interne
    # locataire) — la table `auth.users` (Supabase) est indexée par UUID
    # Supabase, pas par UUID locataire → la requête retournait toujours
    # NULL et le PDF affichait "Locataire" au lieu du nom réel.
    # Source de vérité Sprint 6 K1 : `Locataire.user` (relation
    # lazy="selectin"). On résout proprement first_name + last_name +
    # email comme fallback (cohérent avec frontend formatLocataireName).
    tenant_name = "Locataire"
    if tenant_id:
        loc_with_user = await db.scalar(
            select(Locataire).where(Locataire.id == tenant_id)
        )
        if loc_with_user and loc_with_user.user is not None:
            u = loc_with_user.user
            full_name = f"{u.first_name or ''} {u.last_name or ''}".strip()
            if full_name:
                tenant_name = full_name
            elif u.email:
                tenant_name = u.email.split("@")[0].capitalize()

    mois_label = mois_date.strftime("%B %Y").capitalize()

    # ── Résolution IBAN canonique (Sprint 9 Lot A) ────────────────────────────
    # Cascade : Bien.iban_compte_id → bank_accounts(est_principal) → None.
    # Si None → fallback `settings.ALTHY_QR_IBAN` côté `generate_qr_bill_pdf`
    # (Phase 1 MVP : Althy intermédiaire la collecte, cf docs/4-PRODUIT.md §4.13).
    effective_ba = await get_effective_iban(db, payload.bien_id)
    qr_iban_override = effective_ba.iban if effective_ba else None

    pdf_bytes  = generate_qr_bill_pdf(
        qr_reference=qr_ref, montant_total=montant_total,
        bien_adresse=bien.adresse, tenant_name=tenant_name,
        mois_label=mois_label, commission_pct=commission_pct,
        commission_montant=commission_montant, montant_reverse=montant_reverse,
        qr_iban_override=qr_iban_override,
    )

    # ── Upload Supabase Storage ──
    download_url: str | None = None
    try:
        key = await upload_pdf(
            user_id=str(current_user.id),
            bien_id=str(payload.bien_id),
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
    bien = (await db.execute(
        text("SELECT id, adresse, loyer, charges, owner_id FROM biens WHERE id = :id AND is_active = true"),
        {"id": str(payload.bien_id)},
    )).one_or_none()
    if not bien:
        raise HTTPException(status_code=404, detail="Bien introuvable.")
    if str(bien.owner_id) != str(current_user.id) and current_user.role not in {"super_admin"}:
        raise HTTPException(status_code=403, detail="Ce bien ne vous appartient pas.")

    montant = float(bien.loyer or 0)
    if montant <= 0:
        raise HTTPException(status_code=400, detail="Le bien n'a pas de loyer défini.")
    charges = float(getattr(bien, "charges", 0) or 0)

    # ── Locataire actif ──
    tenant_row = (await db.execute(
        text("""
            SELECT l.id, l.note_interne
            FROM locataires l
            WHERE l.bien_id = :bid AND l.statut = 'actif'
            ORDER BY l.created_at DESC LIMIT 1
        """),
        {"bid": str(payload.bien_id)},
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
        bien_adresse=bien.adresse,
        mois_label=mois_label,
        montant=montant,
        charges=charges,
    )

    # ── Upload Supabase Storage ──
    download_url: str | None = None
    try:
        key = await upload_pdf(
            user_id=str(current_user.id),
            bien_id=str(payload.bien_id),
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
        SELECT lt.*, b.adresse AS bien_adresse
        FROM loyer_transactions lt
        LEFT JOIN biens b ON b.id = lt.bien_id
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
            SELECT lt.*, b.adresse AS bien_adresse
            FROM loyer_transactions lt
            LEFT JOIN biens b ON b.id = lt.bien_id
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
    """Modifie le statut d'un loyer.

    Sprint 6 K4 (2026-05-13) : ouvre l'endpoint au proprio_solo (était
    admin-only). Le bailleur Sunimmo doit pouvoir marquer un loyer
    « recu » / « en_retard » sur SES propres biens sans passer par le
    support. Les statuts purement opérationnels Althy (« reverse » =
    virement sortant) restent réservés à super_admin.
    """
    if payload.statut not in _VALID_STATUTS:
        raise HTTPException(status_code=400, detail=f"Statut invalide. Valeurs : {_VALID_STATUTS}")

    # Récupérer le owner_id pour autorisation (le proprio du bien lié au loyer).
    row = (await db.execute(
        text("SELECT owner_id FROM loyer_transactions WHERE id = :id"),
        {"id": str(tx_id)},
    )).mappings().one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Transaction introuvable.")

    is_admin = current_user.role in _ADMIN_ROLES
    is_owner = str(row["owner_id"]) == str(current_user.id)

    if not (is_admin or is_owner):
        raise HTTPException(
            status_code=403,
            detail="Vous n'êtes pas propriétaire de ce loyer.",
        )

    # Le statut "reverse" implique un virement sortant côté Althy : réservé
    # admin. Le proprio_solo peut marquer recu / en_attente / en_retard /
    # conteste sur SES propres loyers.
    if payload.statut == "reverse" and not is_admin:
        raise HTTPException(
            status_code=403,
            detail="Le statut 'reverse' (virement Althy → propriétaire) est réservé à l'équipe Althy.",
        )

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


# ── POST /loyers/generer-annee ────────────────────────────────────────────────

@router.post(
    "/generer-annee",
    response_model=GenererAnneeResponse,
    status_code=status.HTTP_201_CREATED,
)
async def generer_loyers_annee(
    payload: GenererAnneeRequest,
    current_user: AuthDep,
    db: DbDep,
) -> GenererAnneeResponse:
    """Génère les 12 loyer_transactions d'une année pour un bien.

    Phase 1.0 §B.15 : pas de commission Stripe Connect (commission_pct=0).
    Idempotent : skip les mois déjà créés (clé bien_id + tenant_id + mois_concerne).
    Le PDF QR-facture et l'email locataire sont générés mensuellement par la
    cron `generate_monthly_rents` quand le mois courant arrive.
    """
    if current_user.role not in _MANAGER_ROLES:
        raise HTTPException(status_code=403, detail="Accès réservé aux propriétaires et agences.")
    if not (2024 <= payload.annee <= 2030):
        raise HTTPException(status_code=400, detail="Année hors bornes (2024-2030).")

    # ── Bien ──
    bien = (await db.execute(
        text("SELECT id, adresse, loyer, owner_id FROM biens WHERE id = :id AND is_active = true"),
        {"id": str(payload.bien_id)},
    )).one_or_none()
    if not bien:
        raise HTTPException(status_code=404, detail="Bien introuvable.")
    if str(bien.owner_id) != str(current_user.id) and current_user.role not in _ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Ce bien ne vous appartient pas.")
    if not bien.loyer or float(bien.loyer) <= 0:
        raise HTTPException(status_code=400, detail="Le bien n'a pas de loyer défini.")

    # ── Locataire actif ──
    tenant = (await db.execute(
        text(
            "SELECT id, loyer FROM locataires "
            "WHERE bien_id = :bid AND statut = 'actif' "
            "ORDER BY created_at DESC LIMIT 1"
        ),
        {"bid": str(payload.bien_id)},
    )).one_or_none()
    if not tenant:
        raise HTTPException(
            status_code=400,
            detail="Aucun locataire actif sur ce bien.",
        )

    tenant_id = _uuid.UUID(str(tenant.id))
    # Priorité loyer négocié locataire > loyer par défaut bien.
    raw_loyer = tenant.loyer if tenant.loyer is not None else bien.loyer
    montant_total = float(raw_loyer)
    if montant_total <= 0:
        raise HTTPException(status_code=400, detail="Loyer non défini.")

    # Phase 1.0 §B.15 : commission = 0 (Stripe Connect gelé Phase 2).
    commission_pct = 0.0
    commission_montant = 0.0
    montant_reverse = montant_total

    created: list[str] = []
    skipped: list[str] = []

    for month in range(1, 13):
        from datetime import date as _date
        mois_concerne = _date(payload.annee, month, 1)
        mois_str = mois_concerne.strftime("%Y-%m")

        existing = (await db.execute(
            text(
                "SELECT id FROM loyer_transactions "
                "WHERE bien_id = :bid AND tenant_id = :tid AND mois_concerne = :mois LIMIT 1"
            ),
            {
                "bid": str(payload.bien_id),
                "tid": str(tenant_id),
                "mois": mois_concerne,
            },
        )).one_or_none()
        if existing:
            skipped.append(mois_str)
            continue

        qr_ref = generate_qr_reference(payload.bien_id, tenant_id, mois_str)
        tx_id = _uuid.uuid4()
        await db.execute(
            text("""
                INSERT INTO loyer_transactions
                    (id, bien_id, tenant_id, owner_id,
                     montant_total, commission_pct, commission_montant, montant_reverse,
                     qr_reference, statut, mois_concerne)
                VALUES
                    (:id, :bid, :tid, :oid, :total, :cpct, :cmt, :rev,
                     :qr_ref, 'en_attente', :mois)
            """),
            {
                "id": tx_id,
                "bid": str(payload.bien_id),
                "tid": str(tenant_id),
                "oid": str(bien.owner_id),
                "total": montant_total,
                "cpct": commission_pct,
                "cmt": commission_montant,
                "rev": montant_reverse,
                "qr_ref": qr_ref,
                "mois": mois_concerne,
            },
        )
        created.append(mois_str)

    await db.commit()

    return GenererAnneeResponse(
        bien_id=payload.bien_id,
        annee=payload.annee,
        created_count=len(created),
        skipped_count=len(skipped),
        created_months=created,
        skipped_months=skipped,
    )


# ── POST /loyers/import-camt054 ───────────────────────────────────────────────

@router.post("/import-camt054", response_model=ImportCamtResponse)
async def import_camt054(
    current_user: AuthDep,
    db: DbDep,
    file: UploadFile = File(...),
) -> ImportCamtResponse:
    """Import CAMT.054 multipart pour réconciliation automatique des loyers.

    Différences avec /reconcilier (base64 + admin-only) :
      - Upload multipart : pratique depuis l'UI bailleur.
      - Ouvert à proprio_solo + agence : chaque proprio peut importer son
        propre CAMT.054 reçu de sa banque. Le filtrage par owner_id garantit
        qu'un bailleur ne peut pas matcher les loyers d'un autre.
      - Admin : pas de filtrage (vue globale Althy).
    """
    if current_user.role not in _MANAGER_ROLES:
        raise HTTPException(status_code=403, detail="Accès réservé aux propriétaires et agences.")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Fichier vide.")

    try:
        entries = parse_camt054(content)
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Fichier CAMT.054 invalide : {exc}",
        )

    is_admin = current_user.role in _ADMIN_ROLES
    matched_details: list[dict] = []
    unmatched_details: list[dict] = []

    for entry in entries:
        ref = str(entry.get("reference", "")).strip().replace(" ", "")
        if not ref or len(ref) != 27:
            unmatched_details.append({**entry, "raison": "reference_invalide"})
            continue

        row = (await db.execute(
            text(
                "SELECT id, owner_id, montant_total "
                "FROM loyer_transactions "
                "WHERE qr_reference = :ref AND statut = 'en_attente' "
                "LIMIT 1"
            ),
            {"ref": ref},
        )).one_or_none()

        if not row:
            unmatched_details.append({**entry, "raison": "qr_reference_inconnu"})
            continue

        # Filtrage ownership pour non-admin (un bailleur ne match que SES loyers).
        if not is_admin and str(row.owner_id) != str(current_user.id):
            unmatched_details.append({**entry, "raison": "non_proprietaire"})
            continue

        # Tolérance ±0.05 CHF (arrondis bancaires).
        montant_recu = float(entry.get("montant", 0))
        if abs(float(row.montant_total) - montant_recu) > 0.05:
            unmatched_details.append({
                **entry,
                "raison": "montant_incorrect",
                "attendu": float(row.montant_total),
            })
            continue

        # Date de réception
        dt_str = str(entry.get("date", ""))
        try:
            reception_dt = datetime.fromisoformat(dt_str) if dt_str else datetime.now()
        except ValueError:
            reception_dt = datetime.now()

        await db.execute(
            text(
                "UPDATE loyer_transactions "
                "SET statut = 'recu', date_reception = :dt, updated_at = now() "
                "WHERE id = :id"
            ),
            {"dt": reception_dt, "id": str(row.id)},
        )
        matched_details.append({
            "reference": ref,
            "transaction_id": str(row.id),
            "montant": montant_recu,
        })

    await db.commit()

    return ImportCamtResponse(
        matched_count=len(matched_details),
        unmatched_count=len(unmatched_details),
        matched_details=matched_details,
        unmatched_details=unmatched_details[:50],  # tronqué pour limiter la payload
    )
