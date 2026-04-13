"""Router FastAPI — /api/v1/loyers
Architecture transit Airbnb : le loyer transite par le compte Althy.

Endpoints :
  POST /generer-qr       — génère une QR-facture Swiss pour un loyer mensuel
  POST /reconcilier      — réconciliation CAMT.054 ou liste manuelle
  GET  /                 — liste des loyer_transactions du proprio
  GET  /{id}             — détail d'une loyer_transaction
  PATCH /{id}/statut     — admin: forcer un statut (reverse manuel, conteste…)
"""

from __future__ import annotations

import base64
import io
import uuid as _uuid
import xml.etree.ElementTree as ET
from datetime import UTC, date, datetime
from typing import Annotated

import qrcode
from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from fpdf import FPDF
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

DbDep   = Annotated[AsyncSession, Depends(get_db)]
AuthDep = Annotated[User, Depends(get_current_user)]

# ── Rôles autorisés à créer des QR-factures ────────────────────────────────────
_MANAGER_ROLES = {"proprio_solo", "agence", "super_admin"}
_ADMIN_ROLES   = {"super_admin"}


# ══════════════════════════════════════════════════════════════════════════════
# Helpers
# ══════════════════════════════════════════════════════════════════════════════

# Table Mod10 récursif (ESR / QR-Referenz suisse, SIX standard)
_MOD10_TABLE = [0, 9, 4, 6, 8, 2, 7, 1, 3, 5]


def _mod10_check(digits: str) -> int:
    """Calcule le chiffre de contrôle Mod10 récursif (SIX, Swiss QR-Referenz)."""
    carry = 0
    for d in digits:
        carry = _MOD10_TABLE[(carry + int(d)) % 10]
    return (10 - carry) % 10


def _uuid_to_digits(uid: _uuid.UUID, length: int) -> str:
    """Transforme un UUID en séquence numérique de longueur donnée."""
    n = int(uid.hex, 16) % (10 ** length)
    return str(n).zfill(length)


def generate_qr_reference(property_id: _uuid.UUID, tenant_id: _uuid.UUID | None, mois: str) -> str:
    """
    Génère une référence QR-Referenz conforme SIX (27 chiffres).
    Format (26 chiffres) : {bien_8}{000}{tenant_7_ou_0000000}{YYMM}{zeroPad}
    Digit 27 = chiffre de contrôle Mod10 récursif.
    """
    yymm = datetime.strptime(mois + "-01", "%Y-%m-%d").strftime("%y%m")
    bien_part   = _uuid_to_digits(property_id, 8)
    tenant_part = _uuid_to_digits(tenant_id, 7) if tenant_id else "0000000"
    raw = f"{bien_part}000{tenant_part}{yymm}"   # 8+3+7+4 = 22 chiffres
    raw = raw.ljust(26, "0")[:26]                 # complète à 26 chiffres
    check = _mod10_check(raw)
    return raw + str(check)                        # 27 chiffres


# ── Swiss QR bill payload (SPC 2.0) ───────────────────────────────────────────

def build_spc_payload(
    qr_iban: str,
    reference: str,
    amount: float,
    debtor_name: str,
    additional_info: str,
) -> str:
    """
    Construit le payload textuel du QR suisse (SPC 2.0).
    Spécification SIX : https://www.six-group.com/en/products-services/banking-services/payment-standardization/standards/qr-bill.html
    """
    lines = [
        "SPC",           # Header
        "0200",          # Version
        "1",             # Coding type (UTF-8)
        qr_iban,         # IBAN/QR-IBAN du créancier
        # Créancier
        "S",             # Address type (structured)
        settings.ALTHY_CREDITOR_NAME,
        settings.ALTHY_CREDITOR_STREET,
        "",              # Building number (vide si dans street)
        settings.ALTHY_CREDITOR_CITY.split(" ")[0],   # CP
        " ".join(settings.ALTHY_CREDITOR_CITY.split(" ")[1:]),  # Ville
        settings.ALTHY_CREDITOR_COUNTRY,
        # Créancier final (facultatif — vide)
        "", "", "", "", "", "", "",
        # Montant et devise
        f"{amount:.2f}",
        "CHF",
        # Débiteur (peut rester vide si non connu)
        "S",
        debtor_name,
        "", "", "", "", "CH",
        # Référence
        "QRR",           # QR-Referenz type
        reference,
        # Message additionnel
        additional_info,
        "EPD",           # End Payment Data
    ]
    return "\n".join(lines)


# ── Génération du PDF QR-facture (format A4) ──────────────────────────────────

def generate_qr_bill_pdf(
    *,
    qr_reference: str,
    montant_total: float,
    property_address: str,
    tenant_name: str,
    mois_label: str,
    commission_pct: float,
    commission_montant: float,
    montant_reverse: float,
) -> bytes:
    """
    Génère un PDF A4 contenant la QR-facture suisse (section paiement A5 bas de page)
    et un récapitulatif destiné au proprio (section haute).
    """
    qr_iban = settings.ALTHY_QR_IBAN or "CH0000000000000000000"  # fallback pour dev

    # Payload QR
    spc = build_spc_payload(
        qr_iban=qr_iban,
        reference=qr_reference,
        amount=montant_total,
        debtor_name=tenant_name,
        additional_info=f"Loyer {mois_label} — {property_address[:50]}",
    )

    # Génère l'image QR (46mm × 46mm à 300dpi → ~543px)
    qr_img = qrcode.make(spc, box_size=6, border=1)
    qr_buf = io.BytesIO()
    qr_img.save(qr_buf, format="PNG")
    qr_buf.seek(0)

    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_margins(20, 15, 20)
    pdf.add_page()
    pdf.set_auto_page_break(auto=False)

    # ── En-tête ──
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 8, "Althy — QR-Facture Loyer", ln=True)
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(0, 5, f"{settings.ALTHY_BANK_NAME} · {qr_iban}", ln=True)
    pdf.ln(4)

    # ── Récapitulatif (section proprio) ──
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(0, 7, "Récapitulatif pour le propriétaire", ln=True)
    pdf.set_draw_color(232, 96, 44)
    pdf.set_line_width(0.5)
    pdf.line(20, pdf.get_y(), 190, pdf.get_y())
    pdf.ln(3)

    pdf.set_font("Helvetica", "", 10)
    rows = [
        ("Bien",              property_address),
        ("Locataire",         tenant_name),
        ("Période",           mois_label),
        ("Loyer total demandé",    f"CHF {montant_total:,.2f}"),
        (f"Commission Althy ({commission_pct*100:.0f}%)", f"- CHF {commission_montant:,.2f}"),
        ("Montant reversé au proprio", f"CHF {montant_reverse:,.2f}"),
    ]
    for label, val in rows:
        pdf.set_font("Helvetica", "", 10)
        pdf.cell(90, 6, label, ln=False)
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(0, 6, val, ln=True)

    # ── Ligne de séparation (perforation) ──
    pdf.ln(6)
    pdf.set_draw_color(180, 180, 180)
    pdf.set_line_width(0.3)
    pdf.set_dash_pattern(dash=2, gap=2)
    pdf.line(20, pdf.get_y(), 190, pdf.get_y())
    pdf.set_dash_pattern()

    # ── Section QR-facture (spec SIX — bas de page A5) ──
    y_qr_section = 170  # à 170mm du haut
    pdf.set_y(y_qr_section)

    # Titre section
    pdf.set_font("Helvetica", "B", 8)
    pdf.cell(0, 5, "Section de paiement", ln=True)
    pdf.set_font("Helvetica", "", 7)
    pdf.ln(1)

    # QR code (46mm × 46mm)
    with pdf.local_context():
        pdf.image(qr_buf, x=20, y=y_qr_section + 8, w=46, h=46)

    # Informations à droite du QR
    pdf.set_xy(72, y_qr_section + 8)
    pdf.set_font("Helvetica", "B", 7)
    pdf.cell(0, 4, "Compte / Payable à", ln=True)
    pdf.set_x(72)
    pdf.set_font("Helvetica", "", 7)
    pdf.cell(0, 4, qr_iban, ln=True)
    pdf.set_x(72)
    pdf.cell(0, 4, settings.ALTHY_CREDITOR_NAME, ln=True)
    pdf.set_x(72)
    pdf.cell(0, 4, settings.ALTHY_CREDITOR_STREET, ln=True)
    pdf.set_x(72)
    pdf.cell(0, 4, settings.ALTHY_CREDITOR_CITY, ln=True)

    pdf.set_x(72)
    pdf.ln(4)
    pdf.set_x(72)
    pdf.set_font("Helvetica", "B", 7)
    pdf.cell(0, 4, "Référence", ln=True)
    pdf.set_x(72)
    pdf.set_font("Courier", "", 8)
    ref_fmt = " ".join(qr_reference[i:i+5] for i in range(0, 27, 5))
    pdf.cell(0, 4, ref_fmt, ln=True)

    pdf.set_x(72)
    pdf.set_font("Helvetica", "B", 7)
    pdf.cell(0, 4, "Montant", ln=True)
    pdf.set_x(72)
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(0, 5, f"CHF  {montant_total:,.2f}", ln=True)

    # Note bas de page
    pdf.set_y(-20)
    pdf.set_font("Helvetica", "I", 7)
    pdf.set_text_color(120, 120, 120)
    pdf.cell(0, 4, "Document généré automatiquement par Althy SA — www.althy.ch", ln=True, align="C")

    return pdf.output()


# ══════════════════════════════════════════════════════════════════════════════
# Schémas
# ══════════════════════════════════════════════════════════════════════════════

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


class ReconcilierRequest(BaseModel):
    fichier_camt: str | None = None   # base64 du fichier CAMT.054
    transactions: list[dict] | None = None  # [{"reference": str, "montant": float, "date": str}]


class ReconcilierResponse(BaseModel):
    matches: int
    non_matches: int
    details: list[dict]


class PatchStatutRequest(BaseModel):
    statut: str
    reference_virement_sortant: str | None = None
    commentaire: str | None = None


# ══════════════════════════════════════════════════════════════════════════════
# POST /loyers/generer-qr
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/generer-qr", response_model=GenererQRResponse, status_code=status.HTTP_201_CREATED)
async def generer_qr_facture(
    payload: GenererQRRequest,
    current_user: AuthDep,
    db: DbDep,
) -> GenererQRResponse:
    """
    Génère une QR-facture Swiss pour un loyer mensuel.
    Crée un enregistrement loyer_transactions en statut 'en_attente'.
    Retourne le PDF en base64.
    """
    if current_user.role not in _MANAGER_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès réservé aux propriétaires et agences.")

    # ── Valider le mois ──
    try:
        mois_date = datetime.strptime(payload.mois + "-01", "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Format mois invalide (attendu: YYYY-MM).")

    # ── Récupérer le bien ──
    prop_row = await db.execute(
        text("SELECT id, address, monthly_rent, owner_id FROM properties WHERE id = :id AND is_active = true"),
        {"id": str(payload.property_id)},
    )
    prop = prop_row.one_or_none()
    if not prop:
        raise HTTPException(status_code=404, detail="Bien introuvable.")
    if str(prop.owner_id) != str(current_user.id) and current_user.role not in {"super_admin"}:
        # Les agences peuvent gérer les biens de leurs clients — on vérifie l'agence dans les proprios liés
        raise HTTPException(status_code=403, detail="Ce bien ne vous appartient pas.")

    if not prop.monthly_rent or float(prop.monthly_rent) <= 0:
        raise HTTPException(status_code=400, detail="Le bien n'a pas de loyer mensuel défini.")

    montant_total = float(prop.monthly_rent)

    # ── Récupérer le locataire actif ──
    tenant_row = await db.execute(
        text("""
            SELECT id FROM locataires
            WHERE bien_id = :bid AND statut = 'actif'
            ORDER BY created_at DESC LIMIT 1
        """),
        {"bid": str(payload.property_id)},
    )
    tenant = tenant_row.one_or_none()
    tenant_id = _uuid.UUID(str(tenant.id)) if tenant else None

    # ── Vérifier qu'on n'a pas déjà une transaction pour ce mois ──
    existing = await db.execute(
        text("""
            SELECT id FROM loyer_transactions
            WHERE property_id = :pid AND mois_concerne = :mois
            LIMIT 1
        """),
        {"pid": str(payload.property_id), "mois": mois_date},
    )
    if existing.one_or_none():
        raise HTTPException(status_code=409, detail=f"Une transaction existe déjà pour {payload.mois}.")

    # ── Calculer la commission et le montant reversé ──
    commission_pct     = settings.ALTHY_COMMISSION_PCT
    commission_montant = round(montant_total * commission_pct, 2)
    montant_reverse    = round(montant_total - commission_montant, 2)

    # ── Générer la référence QR ──
    qr_ref = generate_qr_reference(payload.property_id, tenant_id, payload.mois)

    # ── Insérer en DB ──
    tx_id = _uuid.uuid4()
    await db.execute(
        text("""
            INSERT INTO loyer_transactions
                (id, property_id, tenant_id, owner_id,
                 montant_total, commission_pct, commission_montant, montant_reverse,
                 qr_reference, statut, mois_concerne)
            VALUES
                (:id, :pid, :tid, :oid,
                 :total, :cpct, :cmt, :rev,
                 :qr_ref, 'en_attente', :mois)
        """),
        {
            "id":    tx_id,
            "pid":   str(payload.property_id),
            "tid":   str(tenant_id) if tenant_id else None,
            "oid":   str(current_user.id),
            "total": montant_total,
            "cpct":  commission_pct,
            "cmt":   commission_montant,
            "rev":   montant_reverse,
            "qr_ref": qr_ref,
            "mois":  mois_date,
        },
    )
    await db.commit()

    # ── Récupérer nom locataire pour le PDF ──
    tenant_name = "Locataire"
    if tenant_id:
        tname_row = await db.execute(
            text("SELECT email FROM auth.users WHERE id = :tid"),
            {"tid": str(tenant_id)},
        )
        tname = tname_row.one_or_none()
        if tname:
            tenant_name = tname.email.split("@")[0].capitalize()

    mois_label = mois_date.strftime("%B %Y").capitalize()

    # ── Générer le PDF ──
    pdf_bytes = generate_qr_bill_pdf(
        qr_reference=qr_ref,
        montant_total=montant_total,
        property_address=prop.address,
        tenant_name=tenant_name,
        mois_label=mois_label,
        commission_pct=commission_pct,
        commission_montant=commission_montant,
        montant_reverse=montant_reverse,
    )

    return GenererQRResponse(
        transaction_id=str(tx_id),
        qr_reference=qr_ref,
        montant_total=montant_total,
        commission_montant=commission_montant,
        montant_reverse=montant_reverse,
        pdf_base64=base64.b64encode(pdf_bytes).decode("utf-8"),
    )


# ══════════════════════════════════════════════════════════════════════════════
# POST /loyers/reconcilier
# ══════════════════════════════════════════════════════════════════════════════

def _parse_camt054(xml_bytes: bytes) -> list[dict]:
    """
    Parse un fichier CAMT.054 (Swiss banking standard, SIX Group).
    Retourne une liste de {reference, montant, date}.
    """
    ns = {
        "camt": "urn:iso:std:iso:20022:tech:xsd:camt.054.001.04",
        "camt8": "urn:iso:std:iso:20022:tech:xsd:camt.054.001.08",
    }
    root = ET.fromstring(xml_bytes)

    # Essaie les deux namespaces courants (V04 et V08)
    entries = []
    for ns_uri in ns.values():
        nsp = {"n": ns_uri}
        for ntry in root.findall(f".//n:Ntry", nsp):
            amt_el  = ntry.find(f"n:Amt", nsp)
            date_el = ntry.find(f"n:BookgDt/n:Dt", nsp) or ntry.find(f"n:ValDt/n:Dt", nsp)
            ref_el  = ntry.find(f".//n:RmtInf/n:Strd/n:CdtrRefInf/n:Ref", nsp)

            if amt_el is None or ref_el is None:
                continue

            ref  = ref_el.text.strip().replace(" ", "")
            try:
                amt = float(amt_el.text.strip())
            except (ValueError, AttributeError):
                continue
            dt   = date_el.text.strip() if date_el is not None else datetime.utcnow().date().isoformat()
            entries.append({"reference": ref, "montant": amt, "date": dt})

    return entries


@router.post("/reconcilier", response_model=ReconcilierResponse)
async def reconcilier(
    payload: ReconcilierRequest,
    current_user: AuthDep,
    db: DbDep,
) -> ReconcilierResponse:
    """
    Réconciliation des paiements reçus sur le compte Althy.
    Accepte soit un fichier CAMT.054 en base64, soit une liste manuelle.
    Déclenche automatiquement la task de reversement pour les transactions matchées.
    """
    if current_user.role not in _ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs.")

    # ── Collecter les transactions entrantes ──
    incoming: list[dict] = []

    if payload.fichier_camt:
        try:
            xml_bytes = base64.b64decode(payload.fichier_camt)
            incoming = _parse_camt054(xml_bytes)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Fichier CAMT.054 invalide : {exc}")

    if payload.transactions:
        incoming.extend(payload.transactions)

    if not incoming:
        raise HTTPException(status_code=400, detail="Aucune transaction à reconcilier.")

    matches    = 0
    non_matches = 0
    details: list[dict] = []

    for entry in incoming:
        ref    = str(entry.get("reference", "")).strip().replace(" ", "")
        montant = float(entry.get("montant", 0))
        dt_str  = str(entry.get("date", ""))

        if not ref or len(ref) != 27:
            non_matches += 1
            details.append({"reference": ref, "statut": "ignoré", "raison": "référence invalide (longueur)"})
            continue

        # Recherche dans loyer_transactions
        row = (await db.execute(
            text("""
                SELECT id, montant_total, owner_id, statut
                FROM loyer_transactions
                WHERE qr_reference = :ref AND statut = 'en_attente'
                LIMIT 1
            """),
            {"ref": ref},
        )).one_or_none()

        if not row:
            non_matches += 1
            details.append({"reference": ref, "statut": "non_matché", "montant": montant})
            continue

        # Vérification de montant (tolérance ±0.05 CHF pour arrondis bancaires)
        if abs(float(row.montant_total) - montant) > 0.05:
            details.append({
                "reference": ref, "statut": "montant_incorrect",
                "attendu": float(row.montant_total), "recu": montant,
            })
            non_matches += 1
            continue

        # ── Mise à jour en 'recu' ──
        try:
            reception_dt = datetime.fromisoformat(dt_str) if dt_str else datetime.now(UTC)
        except ValueError:
            reception_dt = datetime.now(UTC)

        await db.execute(
            text("""
                UPDATE loyer_transactions
                SET statut = 'recu', date_reception = :dt, updated_at = now()
                WHERE id = :id
            """),
            {"dt": reception_dt, "id": str(row.id)},
        )
        matches += 1
        details.append({"reference": ref, "statut": "recu", "transaction_id": str(row.id)})

    await db.commit()

    # ── Déclencher la task de reversement ──
    if matches > 0:
        from app.tasks.rent_tasks import reverse_loyers
        reverse_loyers.delay()

    return ReconcilierResponse(matches=matches, non_matches=non_matches, details=details)


# ══════════════════════════════════════════════════════════════════════════════
# GET /loyers  — liste du proprio
# ══════════════════════════════════════════════════════════════════════════════

@router.get("", response_model=list[dict])
async def list_loyer_transactions(
    current_user: AuthDep,
    db: DbDep,
    statut: str | None = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
) -> list[dict]:
    q = """
        SELECT lt.*, p.address as property_address
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


# ══════════════════════════════════════════════════════════════════════════════
# GET /loyers/{id}  — détail
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/{tx_id}", response_model=dict)
async def get_loyer_transaction(
    tx_id: _uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> dict:
    row = (await db.execute(
        text("""
            SELECT lt.*, p.address as property_address
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


# ══════════════════════════════════════════════════════════════════════════════
# PATCH /loyers/{id}/statut  — admin: forcer un statut (reversement manuel, etc.)
# ══════════════════════════════════════════════════════════════════════════════

_VALID_STATUTS = {"en_attente", "recu", "reverse", "en_retard", "conteste"}


@router.patch("/{tx_id}/statut", response_model=dict)
async def patch_loyer_statut(
    tx_id: _uuid.UUID,
    payload: PatchStatutRequest,
    current_user: AuthDep,
    db: DbDep,
) -> dict:
    """Admin uniquement — force un statut (ex: marquer 'reverse' après virement manuel e-banking)."""
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

    # Notifier le proprio si passage en 'reverse'
    if payload.statut == "reverse":
        from app.tasks.rent_tasks import _notify_proprio_reversement
        _notify_proprio_reversement.delay(str(tx_id))

    row = (await db.execute(
        text("SELECT * FROM loyer_transactions WHERE id = :id"), {"id": str(tx_id)},
    )).mappings().one_or_none()
    return dict(row) if row else {}
