"""PDF Mandat de gestion locative Sunimmo — Sprint 10 Lot 3.

Reproduit fidèlement la structure du `Contrat de mandat de gestion locative.pdf`
Sunimmo (Articles 1 à 9, art. 394 ss CO).

§2.4.16 doctrine — commission_pct_* = donnée contractuelle pure pour le PDF.
AUCUN tracking transactionnel Althy.
"""

from __future__ import annotations

import logging
import uuid
from datetime import date
from typing import Any

from app.core.database import AsyncSessionLocal
from app.models.bien import Bien
from app.models.mandat_gestion import MandatGestion
from app.models.user import User
from app.services._althy_pdf_base import AlthyPdfBase, fmt_chf, fmt_date, fmt_int
from app.services.pdf_bail_service import SUNIMMO_SENDER_ADDRESS, SUNIMMO_SENDER_NAME

logger = logging.getLogger("althy.pdf_mandat")


# Frais facturables — Article 5 (fidèle au template Sunimmo)
MANDAT_FRAIS_CONCILIATION = 300  # CHF HT — courriers + commission conciliation
MANDAT_FRAIS_TRIBUNAL = 1200  # CHF HT — déplacement + représentation


async def generate_mandat_pdf(mandat_id: uuid.UUID) -> bytes:
    async with AsyncSessionLocal() as db:
        mandat = await db.get(MandatGestion, mandat_id)
        if mandat is None:
            return b"%PDF-1.4\n% Mandat not found\n%%EOF\n"

        mandant = await db.get(User, mandat.mandant_id)
        agence = await db.get(User, mandat.agence_id)
        bien = await db.get(Bien, mandat.bien_id) if mandat.bien_id else None

        pdf = AlthyPdfBase(
            title="Contrat de mandat de gestion locative",
            sender_name=SUNIMMO_SENDER_NAME,
            sender_address=SUNIMMO_SENDER_ADDRESS,
            emit_disclaimer_ia=True,
        )
        pdf.alias_nb_pages()
        pdf.add_page()

        pdf.big_title("Contrat de mandat de gestion locative")
        pdf.paragraph(
            "Sous couvert des articles 394 ss et suivants du Code des Obligations "
            "(CO), il est entendu ce qui suit :",
            size=9,
        )

        # Article 1 — Parties contractantes
        pdf.section_title("Article 1 — Parties contractantes")
        pdf.paragraph_b("Entre (le soussigné) :")
        if mandant:
            nom = " ".join(p for p in (mandant.first_name, mandant.last_name) if p) or "—"
            pdf.field_row("Nom · Prénom", nom)
            pdf.field_row("Adresse", mandant.adresse or "À renseigner")
            pdf.field_row("Téléphone", mandant.phone or "—")
            pdf.field_row("E-mail", mandant.email or "—")
        pdf.paragraph_b("ci-après désigné « le (la) mandant(e) », d'une part,")
        pdf.ln(2)
        pdf.paragraph_b("et (la soussignée) :")
        agence_name = SUNIMMO_SENDER_NAME
        agence_repr = None
        if agence:
            agence_repr = " ".join(
                p for p in (agence.first_name, agence.last_name) if p
            )
        pdf.field_row("Agence", agence_name)
        if agence_repr:
            pdf.field_row("Représentée par", agence_repr)
        pdf.field_row(
            "Adresse",
            SUNIMMO_SENDER_ADDRESS.split("\n")[0]
            + ", " + SUNIMMO_SENDER_ADDRESS.split("\n")[1],
        )
        pdf.paragraph_b("ci-après désignée « le courtier », d'autre part.")

        # Article 2 — Contrat
        pdf.section_title("Article 2 — Contrat")
        pdf.paragraph(
            "Le présent contrat donne au courtier le mandat de gestion locative "
            "servant d'intermédiaire entre le mandant et le client afin de louer "
            "le logement pour une durée déterminée par le biais des clients de "
            f"{agence_name} ou d'une présentation sur internet."
        )
        pdf.paragraph_b(f"{agence_name} fera :", size=9)
        pdf.bullet_list([
            "Un inventaire photos pour la constitution du dossier",
            "Une mise-en-ligne du bien sur plusieurs sites Internet",
            "Une prise de contact client",
            "La préparation du contrat de bail",
            "L'encaissement des loyers et de la caution",
            "Le versement des loyers au propriétaire",
            "Le décompte annuel",
            "Les états des lieux entrée-sortie et/ou intermédiaire en cas de vente",
            "L'organisation du nettoyage à la fin de la location (appartement, linge et draps)",
        ])

        # Article 3 — Désignation objet
        pdf.add_page()
        pdf.section_title("Article 3 — Désignation de l'objet")
        pdf.paragraph("L'objet du présent contrat est le suivant :")
        if bien:
            logement = bien.titre or bien.type or "Logement"
            pdf.field_row("Logement", logement)
            pdf.field_row(
                "Adresse",
                f"{bien.adresse or ''}, {bien.cp or ''} {bien.ville or ''}".strip(", "),
            )
            if bien.description:
                pdf.field_row("Description", bien.description)
        else:
            pdf.paragraph(
                "Le mandat couvre l'ensemble des biens du mandant gérés "
                "par l'agence, listés en annexe du présent contrat."
            )
        pdf.paragraph(
            f"{agence_name} se voit attribuer le contrat de mandat de gestion "
            "locative de ce logement."
        )

        # Article 4 — Prix de location
        pdf.section_title("Article 4 — Prix de location")
        pdf.paragraph(
            "Les prix sont fixés d'un commun accord entre les deux parties. "
            "Le propriétaire autorise l'agence à y ajouter tous frais "
            "supplémentaires (nettoyage, linge, etc.) — ceci à la charge du "
            "locataire."
        )
        pdf.paragraph_b("Les loyers seront à verser sur le compte du propriétaire suivant :")
        pdf.field_row("Banque", "À renseigner")
        pdf.field_row("Titulaire", " ".join(
            p for p in (mandant.first_name if mandant else None, mandant.last_name if mandant else None) if p
        ) or "À renseigner")
        pdf.field_row("IBAN", "À renseigner")
        pdf.field_row("BIC", "À renseigner")

        # Article 5 — Obligation de la gérance
        pdf.section_title("Article 5 — Obligation de la gérance")
        pdf.paragraph(
            "La gérance est autorisée en cas de nécessité à prendre toutes les "
            "mesures qui s'imposent pour sauvegarder les intérêts du "
            "propriétaire. Elle procède, sous sa responsabilité, à "
            "l'encaissement des loyers et prend toutes les dispositions à cet "
            "effet. Elle n'est cependant pas responsable de l'insolvabilité "
            "imprévisible des locataires ou du découvert laissé par un "
            "locataire qui n'a pas pris possession du logement."
        )
        pdf.paragraph(
            "La gérance rédigera et signera les baux puis encaissera les loyers "
            "et autres redevances. Une caution sera demandée au locataire. "
            "En aucun cas, le propriétaire ne pourra demander que la caution "
            "lui parvienne."
        )
        pdf.paragraph(
            "Avant chaque location, l'agence déclenchera un nettoyage si "
            "nécessaire. Le montant sera déduit sur un loyer."
        )
        pdf.paragraph_b(
            f"En cas de litige avec le locataire, à la demande du mandant, "
            f"l'agence peut intervenir :\n"
            f"  • Courriers rédigés par l'agence : {fmt_chf(MANDAT_FRAIS_CONCILIATION)} HT\n"
            f"  • Représentation à la commission de conciliation : "
            f"{fmt_chf(MANDAT_FRAIS_TRIBUNAL)} HT\n"
            f"Au-delà de la conciliation, il est du ressort du mandant d'engager "
            f"un avocat s'il souhaite entamer une procédure judiciaire auprès "
            f"du tribunal compétent."
        )

        # Article 6 — Obligation du propriétaire
        pdf.section_title("Article 6 — Obligation du propriétaire")
        pdf.paragraph(
            "Le propriétaire s'engage à équiper son logement de tout le "
            "nécessaire pour la satisfaction des locataires. La cuisine doit "
            "être équipée de tout l'électroménager obligatoire et en bon "
            "fonctionnement. Un aspirateur et tout le petit matériel pour "
            "faire le ménage doivent être à disposition du locataire."
        )
        pdf.paragraph(
            "En cas de location à la semaine ou à la saison, le linge de "
            "salle de bain et le linge de lit doit être fourni."
        )
        pdf.paragraph("Trois jeux de clefs de l'appartement seront fournis à l'agence.")

        # Article 7 — Commission
        pdf.add_page()
        pdf.section_title("Article 7 — Commission du courtier — TVA")
        pdf.paragraph(
            "Le taux de commission dû par le propriétaire au courtier, si la "
            "location aboutit, est de :"
        )
        pdf.bullet_list([
            f"{float(mandat.commission_pct_semaine):.0f}% HT du montant total de "
            "location pour une location à la semaine + TVA",
            f"{float(mandat.commission_pct_saison):.0f}% HT du montant total de "
            "location pour une location saison + TVA",
            f"{float(mandat.commission_pct_annee):.0f}% HT du montant total de "
            "location pour une location annuelle + TVA",
        ])
        pdf.paragraph(
            "La commission est facturée directement par le courtier au "
            "propriétaire (hors plateforme Althy). Aucun prélèvement "
            "automatique n'est effectué via la plateforme.",
            size=8,
        )

        # Article 8 — Durée
        pdf.section_title("Article 8 — Durée du contrat")
        pdf.paragraph(
            f"Le mandant accorde au courtier le contrat de mandat de gestion "
            f"locative à compter de la date de signature du dit contrat "
            f"({fmt_date(mandat.start_date)})."
        )
        if mandat.end_date:
            pdf.field_row("Date de fin", fmt_date(mandat.end_date))
        else:
            pdf.paragraph("Durée indéterminée.")
        pdf.field_row(
            "Préavis de résiliation",
            f"{mandat.notice_period_months} mois",
        )
        if mandat.notice_deadline_month_day:
            pdf.field_row(
                "Échéance annuelle (mois-jour)",
                mandat.notice_deadline_month_day,
            )
        pdf.paragraph(
            "Le propriétaire peut résilier le contrat de mandat de gestion "
            "locative par courrier conformément à l'article 404 CO s'il n'y a "
            "pas de bail signé. Si l'objet est loué par l'agence, il ne sera "
            "pas possible de mettre fin au dit contrat avant l'expiration du "
            "bail. Si la révocation a lieu en temps inopportun pour une des "
            "parties, l'art. 404 al. 2 CO prévoit qu'une indemnisation du "
            "dommage causé par la révocation devra être payée par la partie "
            "qui résilie le contrat."
        )

        # Article 9 — Droit applicable
        pdf.section_title("Article 9 — Droit applicable")
        for_juridique = mandat.for_juridique or "Sierre"
        pdf.paragraph(
            f"Pour tous les conflits qui pourraient naître de l'application "
            f"du présent contrat, toutes les parties font élection de "
            f"domicile et de for à {for_juridique}."
        )
        pdf.paragraph(
            "La compétence du Tribunal de District ou du Tribunal Cantonal "
            "compétent est ainsi donnée en fonction de la valeur litigieuse, "
            "sous réserve du recours au Tribunal Fédéral."
        )
        pdf.paragraph_b("Le Droit Suisse est seul applicable.")

        if mandat.notes:
            pdf.section_title("Notes complémentaires")
            pdf.paragraph(mandat.notes)

        pdf.divider()
        pdf.signatures_block(
            roles=[
                (
                    "Mandant",
                    " ".join(p for p in (mandant.first_name, mandant.last_name) if p)
                    if mandant else None,
                ),
                (agence_name, None),
            ],
            city="Crans-Montana",
            signed_date=date.today(),
        )

        pdf.disclaimer_ia()
        return bytes(pdf.output())
