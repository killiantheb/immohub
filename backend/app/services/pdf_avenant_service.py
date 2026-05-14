"""PDF Avenant au bail — 9 types — Sprint 10 Lot 3.

Reproduit la structure des templates Sunimmo `Avenants au bail/*.docx` :
header rappel bail original + bloc parties + objet typé + clause "autres
dispositions inchangées" + signatures.

Types couverts (cf migration 0051 §E CHECK constraint) :
  animaux, modification_loyer, modification_date, prolongation,
  resiliation_anticipee, changement_proprietaire, changement_locataire,
  charge_electrique, accord_specifique
"""

from __future__ import annotations

import logging
import uuid
from datetime import date
from typing import Any

from app.core.database import AsyncSessionLocal
from app.models.avenant import Avenant
from app.models.bien import Bien
from app.models.contract import Contract
from app.models.user import User
from app.services._althy_pdf_base import AlthyPdfBase, fmt_chf, fmt_date
from app.services.pdf_bail_service import SUNIMMO_SENDER_ADDRESS, SUNIMMO_SENDER_NAME

logger = logging.getLogger("althy.pdf_avenant")


_AVENANT_TYPE_LABELS = {
    "animaux": "Autorisation d'animaux",
    "modification_loyer": "Modification du loyer",
    "modification_date": "Modification de la date de fin",
    "prolongation": "Prolongation du bail",
    "resiliation_anticipee": "Résiliation anticipée",
    "changement_proprietaire": "Changement de propriétaire",
    "changement_locataire": "Changement de locataire",
    "charge_electrique": "Charge électrique",
    "accord_specifique": "Accord spécifique",
}


def _typed_body(avenant: Avenant) -> list[str]:
    """Retourne les paragraphes du corps spécifique au type d'avenant.

    Pour chaque type on combine un texte standard + les data JSONB.
    """
    data: dict[str, Any] = avenant.data or {}
    t = avenant.avenant_type
    out: list[str] = []

    if t == "animaux":
        animal = data.get("animal_type") or "un animal de compagnie"
        out.append(
            f"Le bailleur autorise le locataire à détenir {animal} dans le "
            "logement objet du bail."
        )
        out.append(
            "Le locataire est responsable des dégâts éventuels occasionnés par "
            "ses animaux, dans le cas où l'assurance RC ne les prendrait pas en "
            "charge, ainsi que du nettoyage supplémentaire dû aux poils et aux "
            "odeurs. Le logement doit être restitué dans un état équivalent à "
            "celui d'un logement sans animal."
        )

    elif t == "modification_loyer":
        nouveau = data.get("nouveau_loyer")
        ancien = data.get("ancien_loyer")
        motif = data.get("motif") or "indexation IPC / variation taux hypothécaire"
        out.append(
            f"Les parties conviennent de modifier le montant du loyer mensuel "
            f"du bail référencé ci-dessus."
        )
        if ancien is not None and nouveau is not None:
            out.append(
                f"Ancien loyer mensuel : {fmt_chf(ancien)}\n"
                f"Nouveau loyer mensuel : {fmt_chf(nouveau)}"
            )
        out.append(
            f"Effective le {fmt_date(avenant.effective_date)}.\n"
            f"Motif : {motif}."
        )

    elif t == "modification_date":
        nouvelle_date = data.get("nouvelle_date_fin")
        out.append(
            f"Les parties conviennent de modifier la date de fin du bail "
            f"référencé ci-dessus."
        )
        out.append(f"Nouvelle date de fin : {fmt_date(nouvelle_date)}.")

    elif t == "prolongation":
        nouvelle_date = data.get("nouvelle_date_fin")
        out.append(
            "Les parties conviennent de prolonger le bail référencé ci-dessus "
            "aux mêmes conditions."
        )
        out.append(f"Nouvelle date d'échéance : {fmt_date(nouvelle_date)}.")

    elif t == "resiliation_anticipee":
        date_sortie = data.get("date_sortie")
        nouveau_locataire = data.get("nouveau_locataire_nom")
        out.append(
            "Les parties conviennent d'une résiliation anticipée du bail "
            "référencé ci-dessus, conformément à l'article 264 CO."
        )
        if date_sortie:
            out.append(f"Date de sortie effective : {fmt_date(date_sortie)}.")
        if nouveau_locataire:
            out.append(
                f"Locataire de reprise présenté et accepté par l'agence : "
                f"{nouveau_locataire}."
            )

    elif t == "changement_proprietaire":
        nouveau = data.get("nouveau_proprietaire") or "à renseigner"
        date_effet = data.get("date_effet")
        out.append(
            "Les parties prennent acte du changement de propriétaire du bien "
            "objet du bail. Le bail se poursuit aux conditions inchangées avec "
            "le nouveau propriétaire (art. 261 CO)."
        )
        out.append(f"Nouveau propriétaire : {nouveau}.")
        if date_effet:
            out.append(f"Date d'effet : {fmt_date(date_effet)}.")

    elif t == "changement_locataire":
        ancien = data.get("ancien_locataire") or "à renseigner"
        nouveau = data.get("nouveau_locataire") or "à renseigner"
        date_effet = data.get("date_effet")
        out.append(
            "Les parties conviennent d'un changement de locataire sur le bail "
            "référencé ci-dessus, avec reprise des conditions inchangées."
        )
        out.append(f"Locataire sortant : {ancien}\nLocataire entrant : {nouveau}")
        if date_effet:
            out.append(f"Date d'effet : {fmt_date(date_effet)}.")

    elif t == "charge_electrique":
        montant = data.get("montant_mensuel")
        out.append(
            "Les parties conviennent d'intégrer une participation aux frais "
            "d'électricité au bail référencé ci-dessus."
        )
        if montant is not None:
            out.append(f"Montant mensuel : {fmt_chf(montant)}.")

    elif t == "accord_specifique":
        out.append(avenant.body_text or "Accord spécifique entre les parties.")

    else:
        out.append(avenant.objet or "Avenant au bail.")

    return out


async def generate_avenant_pdf(avenant_id: uuid.UUID) -> bytes:
    async with AsyncSessionLocal() as db:
        avenant = await db.get(Avenant, avenant_id)
        if avenant is None:
            return b"%PDF-1.4\n% Avenant not found\n%%EOF\n"
        contract = await db.get(Contract, avenant.contract_id)
        if contract is None:
            return b"%PDF-1.4\n% Contract not found\n%%EOF\n"
        bien = await db.get(Bien, contract.bien_id) if contract.bien_id else None
        tenant = await db.get(User, contract.tenant_id) if contract.tenant_id else None

        pdf = AlthyPdfBase(
            title="Avenant au bail",
            sender_name=SUNIMMO_SENDER_NAME,
            sender_address=SUNIMMO_SENDER_ADDRESS,
            emit_disclaimer_ia=True,
        )
        pdf.alias_nb_pages()
        pdf.add_page()

        type_label = _AVENANT_TYPE_LABELS.get(avenant.avenant_type, avenant.avenant_type)
        pdf.big_title(f"Avenant au bail — {type_label}")

        pdf.section_title("Bail concerné")
        pdf.field_row("Référence du bail", contract.reference)
        pdf.field_row("Date d'origine", fmt_date(contract.start_date))
        if bien:
            adr = bien.adresse or "—"
            cp_ville = " ".join(p for p in (bien.cp, bien.ville) if p)
            pdf.field_row("Objet (bien)", f"{adr}, {cp_ville}".strip(", "))
        pdf.field_row("Référence avenant", avenant.reference)
        pdf.field_row(
            "Date d'effet",
            fmt_date(avenant.effective_date) if avenant.effective_date else "à compléter",
        )

        pdf.section_title("Locataire")
        if tenant:
            nom = " ".join(p for p in (tenant.first_name, tenant.last_name) if p) or "—"
            pdf.field_row("Nom · Prénom", nom)
            pdf.field_row("E-mail", tenant.email or "—")

        pdf.section_title(f"Objet de l'avenant — {type_label}")
        for body in _typed_body(avenant):
            pdf.paragraph(body)

        if avenant.body_text and avenant.avenant_type != "accord_specifique":
            pdf.section_title("Précisions complémentaires")
            pdf.paragraph(avenant.body_text)

        pdf.divider()
        pdf.paragraph_b(
            "Les autres dispositions du contrat de bail demeurent inchangées."
        )

        pdf.signatures_block(
            roles=[
                (
                    "Locataire",
                    " ".join(p for p in (tenant.first_name, tenant.last_name) if p)
                    if tenant else None,
                ),
                (SUNIMMO_SENDER_NAME, None),
            ],
            city=contract.signed_at_city or "Crans-Montana",
            signed_date=date.today(),
        )

        pdf.disclaimer_ia()
        return bytes(pdf.output())
