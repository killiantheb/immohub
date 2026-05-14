"""PDF Résiliation — Sprint 10 Lot 3.

Format courrier formel : en-tête expéditeur + destinataire + objet + corps +
signature + avertissement CO 266l si applicable.

Référence : Sunimmo `Courrier aux locataires/Lettre-type-resiliation-bail.docx`
+ `Formule officielle - résiliation de bail - Rohr.pdf` (la formule officielle
cantonale reste obligatoire en parallèle pour bail habitation — cf doctrine
Phase 1.0 §B.15).
"""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime, date
from typing import Any

from app.core.database import AsyncSessionLocal
from app.models.bien import Bien
from app.models.contract import Contract
from app.models.resiliation import Resiliation
from app.models.user import User
from app.services._althy_pdf_base import AlthyPdfBase, fmt_date, MUTED, INK
from app.services._pdf_utils import sanitize_for_pdf as _s
from app.services.pdf_bail_service import SUNIMMO_SENDER_ADDRESS, SUNIMMO_SENDER_NAME

logger = logging.getLogger("althy.pdf_resiliation")


_INITIATEUR_LABELS = {
    "locataire": "Locataire",
    "bailleur": "Bailleur",
    "agence_mandataire": "Agence mandataire",
}


async def generate_resiliation_pdf(resiliation_id: uuid.UUID) -> bytes:
    async with AsyncSessionLocal() as db:
        resiliation = await db.get(Resiliation, resiliation_id)
        if resiliation is None:
            return b"%PDF-1.4\n% Resiliation not found\n%%EOF\n"
        contract = await db.get(Contract, resiliation.contract_id)
        if contract is None:
            return b"%PDF-1.4\n% Contract not found\n%%EOF\n"
        bien = await db.get(Bien, contract.bien_id) if contract.bien_id else None
        tenant = await db.get(User, contract.tenant_id) if contract.tenant_id else None
        owner = await db.get(User, contract.owner_id)

        # Avertissement CO 266l si bailleur initiateur + bail habitation
        warning_co_266l = (
            resiliation.initiateur == "bailleur"
            and not contract.is_furnished
        )

        pdf = AlthyPdfBase(
            title="Résiliation de bail",
            sender_name=SUNIMMO_SENDER_NAME,
            sender_address=SUNIMMO_SENDER_ADDRESS,
            emit_disclaimer_ia=True,
        )
        pdf.alias_nb_pages()
        pdf.add_page()

        pdf.big_title("Résiliation de bail")

        # Bloc destinataire (en haut à droite — format courrier)
        pdf.section_title("Destinataire")
        if resiliation.initiateur == "locataire":
            # Destiné au bailleur
            recipient_name = (
                " ".join(p for p in (owner.first_name, owner.last_name) if p)
                if owner else "Bailleur"
            )
        else:
            # Destiné au locataire
            recipient_name = (
                " ".join(p for p in (tenant.first_name, tenant.last_name) if p)
                if tenant else "Locataire"
            )
        pdf.paragraph_b(recipient_name)
        if bien and bien.adresse:
            pdf.paragraph(bien.adresse)
            cp_ville = " ".join(p for p in (bien.cp, bien.ville) if p)
            if cp_ville:
                pdf.paragraph(f"CH – {cp_ville}")

        pdf.section_title("Bail concerné")
        pdf.field_row("Référence", contract.reference)
        pdf.field_row(
            "Date d'origine du bail",
            fmt_date(contract.start_date),
        )
        if bien:
            pdf.field_row(
                "Objet du bail",
                f"{bien.adresse or ''}, {bien.cp or ''} {bien.ville or ''}".strip(", "),
            )

        pdf.section_title("Notification de résiliation")
        initiateur_label = _INITIATEUR_LABELS.get(
            resiliation.initiateur, resiliation.initiateur
        )
        pdf.paragraph(
            f"Par la présente, le soussigné ({initiateur_label}) notifie la "
            f"résiliation du bail référencé ci-dessus, conformément aux "
            f"dispositions du Code des Obligations Suisse (CO art. 266 ss)."
        )

        pdf.field_row("Date d'envoi", fmt_date(resiliation.date_envoi))
        pdf.field_row("Date de résiliation effective", fmt_date(resiliation.date_resiliation))
        pdf.field_row(
            "Préavis respecté",
            f"Oui ({resiliation.preavis_months} mois)" if resiliation.respect_preavis
            else "Non — résiliation extraordinaire",
        )
        pdf.field_row("Initiateur", initiateur_label)
        if resiliation.motif:
            pdf.section_title("Motif")
            pdf.paragraph(resiliation.motif)

        # Avertissement CO 266l obligatoire
        if warning_co_266l:
            pdf.divider()
            pdf.set_font("Helvetica", "B", 9)
            pdf.set_text_color(122, 100, 40)  # warning gold
            pdf.cell(0, 5, _s("ATTENTION — Formule officielle CO 266l"), new_x="LMARGIN", new_y="NEXT")
            pdf.set_font("Helvetica", "", 8.5)
            pdf.set_text_color(*INK)
            pdf.multi_cell(
                0, 4.5,
                _s(
                    "Pour les baux d'habitation, l'usage de la formule officielle "
                    "cantonale de résiliation (art. 266l CO) reste obligatoire "
                    "pour le bailleur. Le présent courrier documente la décision "
                    "et la communication, mais NE remplace PAS la formule "
                    "officielle qui doit être transmise en parallèle par lettre "
                    "recommandée (art. 9 OBLF). Le non-respect de cette exigence "
                    "rend la résiliation nulle (art. 266o CO)."
                ),
                new_x="LMARGIN", new_y="NEXT",
            )
            pdf.ln(2)

        pdf.divider()

        pdf.paragraph(
            "Nous vous remercions de bien vouloir prendre acte de la présente "
            "résiliation et restons à votre disposition pour organiser les "
            "modalités de sortie (état des lieux, restitution des clés, "
            "libération de la caution)."
        )
        pdf.paragraph(
            "Veuillez agréer, Madame, Monsieur, l'expression de nos salutations "
            "distinguées."
        )

        pdf.signatures_block(
            roles=[(initiateur_label, None)],
            city=contract.signed_at_city or "Crans-Montana",
            signed_date=date.today(),
        )

        pdf.disclaimer_ia()
        return bytes(pdf.output())
