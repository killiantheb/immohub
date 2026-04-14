"""QR-facture Swiss (SPC 2.0) — génération de références et PDFs.

Spécification SIX Group :
https://www.six-group.com/en/products-services/banking-services/payment-standardization/standards/qr-bill.html
"""
from __future__ import annotations

import io
import uuid as _uuid
from datetime import datetime

import qrcode
from app.core.config import settings
from fpdf import FPDF


# ── Mod10 récursif (SIX Swiss QR-Referenz) ────────────────────────────────────

_MOD10_TABLE = [0, 9, 4, 6, 8, 2, 7, 1, 3, 5]


def _mod10_check(digits: str) -> int:
    """Chiffre de contrôle Mod10 récursif (standard SIX)."""
    carry = 0
    for d in digits:
        carry = _MOD10_TABLE[(carry + int(d)) % 10]
    return (10 - carry) % 10


def _uuid_to_digits(uid: _uuid.UUID, length: int) -> str:
    """Transforme un UUID en séquence numérique de longueur donnée."""
    n = int(uid.hex, 16) % (10 ** length)
    return str(n).zfill(length)


def generate_qr_reference(
    property_id: _uuid.UUID,
    tenant_id: _uuid.UUID | None,
    mois: str,
) -> str:
    """
    Génère une référence QR-Referenz conforme SIX (27 chiffres).
    Format (26 chiffres) : {bien_8}{000}{tenant_7_ou_0000000}{YYMM}{zeroPad}
    Digit 27 = chiffre de contrôle Mod10 récursif.
    """
    yymm        = datetime.strptime(mois + "-01", "%Y-%m-%d").strftime("%y%m")
    bien_part   = _uuid_to_digits(property_id, 8)
    tenant_part = _uuid_to_digits(tenant_id, 7) if tenant_id else "0000000"
    raw = f"{bien_part}000{tenant_part}{yymm}"  # 8+3+7+4 = 22 chiffres
    raw = raw.ljust(26, "0")[:26]               # complète à 26
    return raw + str(_mod10_check(raw))          # 27 chiffres


# ── Swiss QR bill payload (SPC 2.0) ───────────────────────────────────────────

def build_spc_payload(
    qr_iban: str,
    reference: str,
    amount: float,
    debtor_name: str,
    additional_info: str,
) -> str:
    """Construit le payload textuel du QR suisse (SPC 2.0)."""
    cp, *ville_parts = settings.ALTHY_CREDITOR_CITY.split(" ")
    ville = " ".join(ville_parts)
    lines = [
        "SPC", "0200", "1",
        qr_iban,
        # Créancier structuré
        "S",
        settings.ALTHY_CREDITOR_NAME,
        settings.ALTHY_CREDITOR_STREET,
        "",
        cp,
        ville,
        settings.ALTHY_CREDITOR_COUNTRY,
        # Créancier final (vide)
        "", "", "", "", "", "", "",
        # Montant / devise
        f"{amount:.2f}", "CHF",
        # Débiteur
        "S", debtor_name, "", "", "", "", "CH",
        # Référence
        "QRR", reference,
        additional_info,
        "EPD",
    ]
    return "\n".join(lines)


# ── Génération PDF QR-facture (format A4) ─────────────────────────────────────

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
    et un récapitulatif destiné au propriétaire.
    """
    qr_iban = settings.ALTHY_QR_IBAN or "CH0000000000000000000"

    spc = build_spc_payload(
        qr_iban=qr_iban,
        reference=qr_reference,
        amount=montant_total,
        debtor_name=tenant_name,
        additional_info=f"Loyer {mois_label} — {property_address[:50]}",
    )

    # Image QR (46 mm × 46 mm à 300 dpi → ~543 px)
    qr_img = qrcode.make(spc, box_size=6, border=1)
    qr_buf = io.BytesIO()
    qr_img.save(qr_buf, format="PNG")
    qr_buf.seek(0)

    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_margins(20, 15, 20)
    pdf.add_page()
    pdf.set_auto_page_break(auto=False)

    # ── En-tête ──────────────────────────────────────────────────────────────
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 8, "Althy — QR-Facture Loyer", ln=True)
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(0, 5, f"{settings.ALTHY_BANK_NAME} · {qr_iban}", ln=True)
    pdf.ln(4)

    # ── Récapitulatif propriétaire ────────────────────────────────────────────
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(0, 7, "Récapitulatif pour le propriétaire", ln=True)
    pdf.set_draw_color(232, 96, 44)
    pdf.set_line_width(0.5)
    pdf.line(20, pdf.get_y(), 190, pdf.get_y())
    pdf.ln(3)

    recap_rows = [
        ("Bien",                                        property_address),
        ("Locataire",                                   tenant_name),
        ("Période",                                     mois_label),
        ("Loyer total demandé",                         f"CHF {montant_total:,.2f}"),
        (f"Commission Althy ({commission_pct*100:.0f}%)", f"- CHF {commission_montant:,.2f}"),
        ("Montant reversé au proprio",                  f"CHF {montant_reverse:,.2f}"),
    ]
    for label, val in recap_rows:
        pdf.set_font("Helvetica", "", 10)
        pdf.cell(90, 6, label, ln=False)
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(0, 6, val, ln=True)

    # ── Ligne de perforation ──────────────────────────────────────────────────
    pdf.ln(6)
    pdf.set_draw_color(180, 180, 180)
    pdf.set_line_width(0.3)
    pdf.set_dash_pattern(dash=2, gap=2)
    pdf.line(20, pdf.get_y(), 190, pdf.get_y())
    pdf.set_dash_pattern()

    # ── Section QR-facture (spec SIX — bas de page A5) ───────────────────────
    y_qr = 170
    pdf.set_y(y_qr)
    pdf.set_font("Helvetica", "B", 8)
    pdf.cell(0, 5, "Section de paiement", ln=True)
    pdf.set_font("Helvetica", "", 7)
    pdf.ln(1)

    with pdf.local_context():
        pdf.image(qr_buf, x=20, y=y_qr + 8, w=46, h=46)

    # Informations à droite du QR code
    pdf.set_xy(72, y_qr + 8)
    pdf.set_font("Helvetica", "B", 7)
    pdf.cell(0, 4, "Compte / Payable à", ln=True)
    for line in [qr_iban, settings.ALTHY_CREDITOR_NAME, settings.ALTHY_CREDITOR_STREET, settings.ALTHY_CREDITOR_CITY]:
        pdf.set_x(72)
        pdf.set_font("Helvetica", "", 7)
        pdf.cell(0, 4, line, ln=True)

    pdf.set_x(72)
    pdf.ln(4)
    pdf.set_x(72)
    pdf.set_font("Helvetica", "B", 7)
    pdf.cell(0, 4, "Référence", ln=True)
    pdf.set_x(72)
    pdf.set_font("Courier", "", 8)
    ref_fmt = " ".join(qr_reference[i:i + 5] for i in range(0, 27, 5))
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
