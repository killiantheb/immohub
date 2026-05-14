"""PDF Convention de sortie — Sprint 10 Lot 3.

Reproduit `Convention de sortie - Template.docx` Sunimmo :
  - Identification immeuble + locataire sortant + nouvelle adresse
  - Tableau dynamique "Description du défaut | Estimation prix (CHF)"
  - Tableau inventaire des clés
  - Mode indemnisation (forfait / travaux / autorisation gérance)
  - Reconnaissance de dette art. 82 LP avec montant total

Source de vérité données : `changements_locataire.convention_sortie` JSONB
(migration 0051 §G). Structure attendue :
  {
    "description_defauts": [{description, estimation_chf}],
    "inventaire_cles": {type_cle: count},
    "total_estimation_chf": number,
    "mode_indemnisation": "forfait"|"travaux"|"autorisation_gerance",
    "nouvelle_adresse_locataire": str,
    "signed_at_locataire": iso,
    "signed_at_agence": iso,
  }
"""

from __future__ import annotations

import logging
import uuid
from datetime import date
from typing import Any

from app.core.database import AsyncSessionLocal
from app.services._althy_pdf_base import (
    AlthyPdfBase,
    GOLD,
    INK,
    LINE,
    MUTED,
    PARCHMENT,
    PRUSSIAN,
    fmt_chf,
    fmt_date,
)
from app.services._pdf_utils import sanitize_for_pdf as _s
from app.services.pdf_bail_service import SUNIMMO_SENDER_ADDRESS, SUNIMMO_SENDER_NAME
from sqlalchemy import text

logger = logging.getLogger("althy.pdf_convention_sortie")


_MODES_LABELS = {
    "forfait": "Indemnité forfaitaire",
    "travaux": "Travaux exécutés par l'agence",
    "autorisation_gerance": "Autorisation donnée à la gérance",
}


async def generate_convention_sortie_pdf(changement_id: uuid.UUID) -> bytes:
    async with AsyncSessionLocal() as db:
        row = (
            await db.execute(
                text("""
                    SELECT cl.id, cl.convention_sortie, cl.date_checkout,
                           b.adresse, b.cp, b.ville, b.type,
                           l.id AS locataire_id, l.user_id,
                           u.first_name, u.last_name
                    FROM changements_locataire cl
                    JOIN biens b ON b.id = cl.bien_id
                    LEFT JOIN locataires l ON l.bien_id = b.id
                    LEFT JOIN users u ON u.id = l.user_id
                    WHERE cl.id = :cid
                    LIMIT 1
                """),
                {"cid": str(changement_id)},
            )
        ).fetchone()

        if row is None:
            return b"%PDF-1.4\n% Changement not found\n%%EOF\n"

        convention: dict[str, Any] = row.convention_sortie or {}

        pdf = AlthyPdfBase(
            title="Convention de sortie",
            sender_name=SUNIMMO_SENDER_NAME,
            sender_address=SUNIMMO_SENDER_ADDRESS,
            emit_disclaimer_ia=True,
        )
        pdf.alias_nb_pages()
        pdf.add_page()

        pdf.big_title("Convention de sortie")

        # Identification
        pdf.section_title("Immeuble & locataire sortant")
        pdf.field_row(
            "Adresse du bien",
            f"{row.adresse or ''}, {row.cp or ''} {row.ville or ''}".strip(", "),
        )
        if row.type:
            pdf.field_row("Type", row.type)
        pdf.field_row(
            "Date de sortie effective",
            fmt_date(row.date_checkout),
        )
        tenant_name = " ".join(p for p in (row.first_name, row.last_name) if p) or "—"
        pdf.field_row("Locataire sortant", tenant_name)
        nouvelle_adresse = convention.get("nouvelle_adresse_locataire")
        if nouvelle_adresse:
            pdf.field_row("Nouvelle adresse", nouvelle_adresse)

        # Tableau défauts
        pdf.section_title("Description des défauts et estimations")
        defauts: list[dict[str, Any]] = convention.get("description_defauts") or []
        if not defauts:
            pdf.paragraph(
                "Aucun défaut constaté lors de l'état des lieux de sortie. "
                "Le logement est rendu en bon état général.",
                size=9,
                color=MUTED,
            )
        else:
            # Header tableau
            pdf.set_font("Helvetica", "B", 9)
            pdf.set_fill_color(*PARCHMENT)
            pdf.set_draw_color(*LINE)
            pdf.set_text_color(*PRUSSIAN)
            pdf.cell(125, 7, _s("Description du défaut"), border=1, fill=True)
            pdf.cell(45, 7, _s("Estimation (CHF)"), border=1, align="R", fill=True, new_x="LMARGIN", new_y="NEXT")

            # Rows
            pdf.set_font("Helvetica", "", 9)
            pdf.set_text_color(*INK)
            total = 0.0
            for idx, d in enumerate(defauts):
                description = str(d.get("description") or "—")[:200]
                estim = d.get("estimation_chf")
                try:
                    total += float(estim or 0)
                except (TypeError, ValueError):
                    pass
                fill = idx % 2 == 1
                if fill:
                    pdf.set_fill_color(*PARCHMENT)
                # Calcul hauteur multi-cell
                start_y = pdf.get_y()
                pdf.multi_cell(125, 5.5, _s(description), border=1, fill=fill)
                end_y = pdf.get_y()
                row_h = end_y - start_y
                pdf.set_xy(20 + 125, start_y)
                pdf.cell(
                    45, row_h, _s(fmt_chf(estim)),
                    border=1, align="R", fill=fill,
                    new_x="LMARGIN", new_y="NEXT",
                )

            # Total
            pdf.set_font("Helvetica", "B", 10)
            pdf.set_text_color(*PRUSSIAN)
            pdf.cell(125, 8, _s("TOTAL"), border=1)
            pdf.cell(
                45, 8,
                _s(fmt_chf(convention.get("total_estimation_chf", total))),
                border=1, align="R", new_x="LMARGIN", new_y="NEXT",
            )

        # Inventaire des clés
        pdf.section_title("Inventaire des clés")
        inventaire = convention.get("inventaire_cles") or {}
        if not inventaire:
            pdf.paragraph("Aucune clé restituée enregistrée.", size=9, color=MUTED)
        else:
            for type_cle, count in inventaire.items():
                pdf.field_row(str(type_cle).capitalize(), f"{count}")

        # Mode indemnisation
        pdf.section_title("Mode d'indemnisation retenu")
        mode = convention.get("mode_indemnisation") or "forfait"
        pdf.paragraph_b(_MODES_LABELS.get(mode, mode))
        if mode == "forfait":
            pdf.paragraph(
                "Le locataire sortant accepte de régler le montant total ci-dessus "
                "comme indemnité forfaitaire couvrant tous les défauts constatés. "
                "Cette indemnité est prélevée sur la caution ou versée directement "
                "à l'agence."
            )
        elif mode == "travaux":
            pdf.paragraph(
                "Le locataire sortant accepte que l'agence fasse exécuter les "
                "travaux nécessaires pour remettre le logement en état. Les "
                "factures effectives seront déduites de la caution."
            )
        elif mode == "autorisation_gerance":
            pdf.paragraph(
                "Le locataire sortant autorise la gérance à effectuer les "
                "démarches nécessaires (devis, choix des prestataires, travaux) "
                "pour la remise en état du logement, le montant final pouvant "
                "être supérieur ou inférieur à l'estimation initiale."
            )

        # Reconnaissance de dette art. 82 LP
        total_dette = convention.get("total_estimation_chf", 0)
        if total_dette:
            pdf.section_title("Reconnaissance de dette (art. 82 LP)")
            pdf.paragraph_b(
                f"Le soussigné {tenant_name} reconnaît devoir à "
                f"{SUNIMMO_SENDER_NAME} la somme de {fmt_chf(total_dette)} "
                "(quittance valable comme reconnaissance de dette au sens de "
                "l'art. 82 de la Loi Fédérale sur la Poursuite pour Dettes et "
                "la Faillite)."
            )

        pdf.divider()
        pdf.signatures_block(
            roles=[("Locataire sortant", tenant_name), (SUNIMMO_SENDER_NAME, None)],
            city="Crans-Montana",
            signed_date=date.today(),
        )

        pdf.disclaimer_ia()
        return bytes(pdf.output())
