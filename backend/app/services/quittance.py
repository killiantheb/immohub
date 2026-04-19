"""Génération de quittance de loyer PDF (art. 88 CO suisse).

Utilise fpdf2 (déjà installé pour les QR-factures).
"""
from __future__ import annotations

from datetime import date

from fpdf import FPDF


def generate_quittance_pdf(
    *,
    proprio_name: str,
    proprio_address: str = "",
    tenant_name: str,
    property_address: str,
    mois_label: str,
    montant: float,
    charges: float = 0,
) -> bytes:
    """Génère un PDF de quittance de loyer au format A4 (art. 88 CO)."""

    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_margins(25, 20, 25)
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=25)

    # ── En-tête Althy ────────────────────────────────────────────────────────
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(120, 120, 120)
    pdf.cell(0, 5, "Althy — althy.ch", ln=True, align="R")
    pdf.set_text_color(0, 0, 0)
    pdf.ln(4)

    pdf.set_font("Helvetica", "B", 18)
    pdf.cell(0, 10, "Quittance de loyer", ln=True, align="C")
    pdf.set_draw_color(232, 96, 44)
    pdf.set_line_width(0.6)
    pdf.line(25, pdf.get_y() + 2, 185, pdf.get_y() + 2)
    pdf.ln(10)

    # ── Gérance (propriétaire) ───────────────────────────────────────────────
    if proprio_address:
        pdf.set_font("Helvetica", "B", 9)
        pdf.cell(0, 5, "Gérance", ln=True)
        pdf.set_font("Helvetica", "", 9)
        pdf.cell(0, 5, f"{proprio_name} — {proprio_address}", ln=True)
        pdf.ln(6)

    # ── Infos ────────────────────────────────────────────────────────────────
    pdf.set_font("Helvetica", "", 11)

    rows = [
        ("Propriétaire / Bailleur", proprio_name),
        ("Locataire", tenant_name),
        ("Bien concerné", property_address),
        ("Période", mois_label),
    ]
    for label, val in rows:
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(55, 7, label, ln=False)
        pdf.set_font("Helvetica", "", 10)
        pdf.cell(0, 7, val, ln=True)

    pdf.ln(6)

    # ── Montants ─────────────────────────────────────────────────────────────
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(55, 7, "Loyer mensuel", ln=False)
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 7, f"CHF {montant:,.2f}", ln=True)

    if charges > 0:
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(55, 7, "Charges", ln=False)
        pdf.set_font("Helvetica", "", 10)
        pdf.cell(0, 7, f"CHF {charges:,.2f}", ln=True)

        total = montant + charges
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(55, 7, "Total", ln=False)
        pdf.set_font("Helvetica", "B", 12)
        pdf.cell(0, 7, f"CHF {total:,.2f}", ln=True)

    pdf.ln(10)

    # ── Texte légal ──────────────────────────────────────────────────────────
    total_text = f"CHF {montant + charges:,.2f}" if charges > 0 else f"CHF {montant:,.2f}"
    body = (
        f"Je soussigné(e) {proprio_name} reconnais avoir reçu de {tenant_name} "
        f"la somme de {total_text} au titre du loyer du mois de {mois_label} "
        f"pour le bien sis à {property_address}."
    )
    pdf.set_font("Helvetica", "", 10)
    pdf.multi_cell(0, 6, body)
    pdf.ln(6)
    pdf.multi_cell(0, 6, "Cette quittance est délivrée conformément à l'article 88 du Code des obligations suisse.")

    pdf.ln(20)

    # ── Date et signature ────────────────────────────────────────────────────
    today = date.today().strftime("%d.%m.%Y")
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 6, f"Fait le {today}", ln=True)
    pdf.ln(16)
    pdf.cell(80, 6, "Signature du bailleur :", ln=False)
    pdf.cell(0, 6, "", ln=True)
    pdf.ln(2)
    pdf.set_draw_color(180, 180, 180)
    pdf.set_line_width(0.3)
    pdf.line(25, pdf.get_y(), 95, pdf.get_y())

    # ── Footer ───────────────────────────────────────────────────────────────
    pdf.set_y(-20)
    pdf.set_font("Helvetica", "I", 7)
    pdf.set_text_color(120, 120, 120)
    pdf.cell(0, 4, "Document généré automatiquement par Killian Thébaud — Althy · Genève · althy.ch", ln=True, align="C")

    return pdf.output()
