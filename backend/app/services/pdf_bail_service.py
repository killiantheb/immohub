"""PDF Bail Sunimmo — 4 variantes (annee, saison, nuitees, vaud) — Sprint 10 Lot 3.

Reproduit fidèlement la structure du bail Sunimmo Riviera :
  Page 1 : Représentant bailleur / Locataire / Objet bail / Durée / Résiliation
           & Reconduction / Loyer mensuel / Compte bancaire encaissement
  Page 2 : IMPORTANT (frais, rappels, intérêts) / Caution / Obligations
  Page 3 : Dispositions générales / Art 82 LP / Signatures / Clauses particulières
  Pages 4-5 : Clauses particulières détaillées + restitution + règlement

Source de vérité textes :
  docs/sunimmo-templates/Location Templates/Bail/{Bail à l'année.pdf,
                                                  Location saison FR.pdf,
                                                  Location nuitées FR.docx,
                                                  Template Bail année Vaud.pdf}

Variantes :
  - sunimmo_annee     : bail année reconductible (préavis 3 mois + 10j)
  - sunimmo_saison    : bail saison meublé durée déterminée (taxe séjour)
  - sunimmo_nuitees   : bail courte durée (frais annulation paliers)
  - sunimmo_vaud      : bail année Vaud (RULV + annexes formules officielles)
  - sunimmo_commercial: bail commercial (Phase 1.1 — placeholder Phase 1.0)
  - sunimmo_parc      : place de parc (durée déterminée, plus court)
"""

from __future__ import annotations

import logging
import uuid
from datetime import date
from decimal import Decimal
from typing import Any

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.bien import Bien
from app.models.contract import Contract
from app.models.locataire import Locataire
from app.models.user import User
from app.services._althy_pdf_base import (
    AlthyPdfBase,
    fmt_chf,
    fmt_date,
    fmt_int,
)
from sqlalchemy import select, text

logger = logging.getLogger("althy.pdf_bail")


# ── Sunimmo defaults (figés depuis le template officiel) ─────────────────────

SUNIMMO_BANK_NAME = "BCV"
SUNIMMO_BANK_HOLDER = (
    "Sunimmo Riviera, Rue Louis-Antille 5, 3963 Crans-Montana"
)
SUNIMMO_BANK_IBAN = "CH32 0076 7000 T546 0720 9"
SUNIMMO_BANK_BIC = "BCVLCH2LXXX"
SUNIMMO_NETTOYAGE_HOURLY = 42  # CHF / h (annee) — 38 pour saison
SUNIMMO_REMINDER_FEE = 35  # CHF
SUNIMMO_EARLY_TERMINATION_FEE = 270  # CHF HT
SUNIMMO_LATE_INTEREST_RATE = 6.0  # % annuel
SUNIMMO_RESILIATION_NOTICE_MONTHS = 3  # mois
SUNIMMO_RESILIATION_NOTICE_POSTAL_DAYS = 10  # jours postaux

SUNIMMO_SENDER_NAME = "SUNIMMO Riviera"
SUNIMMO_SENDER_ADDRESS = (
    "Rue Louis-Antille 5\n"
    "CH – 3963 Crans-Montana\n"
    "Tél : +41 (0) 78 649 66 20\n"
    "contact@sunimmo-riviera.ch"
)


# ── Clauses particulières standard Sunimmo (extraites du PDF source) ─────────


CLAUSES_PARTICULIERES_STD = [
    (
        "Logement non-fumeur",
        "Le logement est non-fumeur. En cas de non-respect, le locataire est "
        "responsable du nettoyage supplémentaire et des dégâts éventuels "
        "occasionnés, dans le cas où l'assurance RC ne le prendrait pas en charge.",
    ),
    (
        "Animaux",
        "Si l'agence accepte les animaux dans le logement, le locataire est "
        "responsable des dégâts éventuels occasionnés par ses animaux, dans le "
        "cas où l'assurance RC ne les prendrait pas en charge, ainsi que le "
        "nettoyage supplémentaire dû aux poils et aux odeurs.",
    ),
    (
        "Signature par correspondance",
        "Lorsque le contrat est signé par correspondance ou sans visite préalable, "
        "le locataire s'engage à l'avance à accepter le logement tel que décrit "
        "dans l'offre. Sans réclamation dans un délai de 24 heures dès l'entrée "
        "en possession des locaux, le locataire est réputé les avoir reçus en "
        "bon état et conforme à l'inventaire.",
    ),
    (
        "Électricité",
        "Il est rappelé aux locataires étrangers que les prises étrangères ne "
        "sont pas compatibles avec les prises suisses. Merci d'utiliser un "
        "adaptateur. Si la plaque est cassée, le locataire prendra à sa charge "
        "son remplacement.",
    ),
    (
        "Clés",
        "Le locataire doit contacter le courtier au moins 48h avant son arrivée "
        "afin de fixer un rendez-vous pour la remise des clefs. Lors de la "
        "remise des clefs, le courtier et le locataire effectueront un état des "
        "lieux et/ou inventaire du logement. En cas de perte de clé donnant "
        "accès aux locaux communs en passe, le locataire assume les frais de "
        "changement du cylindre approprié.",
    ),
    (
        "Plaques – adresses et boîtes aux lettres",
        "Les plaques-adresses de sonnettes, boîtes aux lettres ou interphones, "
        "selon modèle et couleur déterminés par le bailleur, sont obligatoires "
        "et à la charge du locataire. La pose d'autocollants sur les boîtes "
        "aux lettres est strictement interdite.",
    ),
    (
        "Paliers",
        "Les paliers doivent être libres de tout objet quel qu'il soit "
        "(chaussures, vélos, poussettes, etc.).",
    ),
    (
        "Ordures ménagères",
        "Les ordures ménagères doivent être déposées dans les containers prévus. "
        "La taxe au sac est obligatoire. Attention à ne pas déposer les "
        "emballages, bouteilles et autres objets en dehors des sacs sous peine "
        "d'amende.",
    ),
    (
        "Règlement d'immeuble",
        "Le locataire s'engage à respecter le règlement d'ordre intérieur de "
        "l'immeuble. Aucune fête ne sera admise dans le logement, ni aucune "
        "nuisance dès 22h. Le bâtiment et ses environs doivent être silencieux "
        "de 22h à 7h (weekend inclus). Les espaces communs doivent être tenus "
        "propres.",
    ),
    (
        "Restitution des locaux",
        "À sa sortie, le locataire est tenu de rendre les locaux propres : "
        "vitres, bouches de ventilation, intérieur et extérieur des armoires, "
        "évier, lavabos, baignoires, miroirs, robinetterie, stores métalliques "
        "doivent être lavés. Les sols, moquettes ou parquet doivent être "
        "nettoyés. Cette liste n'est pas exhaustive. Les nettoyages mal "
        "exécutés seront facturés lors de l'état des lieux. Le locataire "
        "prendra ses dispositions pour remplacer tout objet endommagé "
        "(art. 267 CO).",
    ),
]


CLAUSES_NUITEES_ANNULATION = (
    "Frais d'annulation paliers :\n"
    "  • Plus de 43 jours avant l'arrivée : 10 % du montant total\n"
    "  • Entre 42 et 29 jours : 50 % du montant total\n"
    "  • Entre 28 et 2 jours : 80 % du montant total\n"
    "  • 1 jour ou no-show : 100 % du montant total"
)


# ── Helpers ──────────────────────────────────────────────────────────────────


def _bien_summary(bien: Bien) -> tuple[str, str, str]:
    """Retourne (logement_label, adresse_complete, description) depuis un Bien."""
    logement = bien.titre or bien.type or "Logement"
    adresse_lines: list[str] = []
    if bien.adresse:
        adresse_lines.append(bien.adresse)
    cp_ville = " ".join(
        p for p in (bien.cp, bien.ville) if p
    )
    if cp_ville:
        adresse_lines.append(f"CH – {cp_ville}")
    adresse = ", ".join(adresse_lines) or "—"
    description = (bien.description or "—").strip()
    return logement, adresse, description


def _resiliation_block_annee(end_date: date | None) -> str:
    """Bloc résiliation & reconduction pour bail à l'année."""
    months = SUNIMMO_RESILIATION_NOTICE_MONTHS
    days = SUNIMMO_RESILIATION_NOTICE_POSTAL_DAYS
    extra = ""
    if end_date:
        # Date butoir = end_date - 3 mois - 10 jours
        try:
            from datetime import timedelta
            butoir = end_date.replace(month=end_date.month - months) if end_date.month > months else end_date.replace(year=end_date.year - 1, month=end_date.month + 12 - months)
            butoir = butoir - timedelta(days=days)
            extra = f", soit avant le {fmt_date(butoir)}"
        except Exception:
            extra = ""
    return (
        f"Une résiliation anticipée est conditionnée au fait que le locataire "
        f"doit retrouver un nouveau locataire solvable et prêt à reprendre le "
        f"bail aux mêmes conditions. L'agence est chargée de valider la "
        f"candidature. Dans ce cas, des frais de dossier de "
        f"{fmt_chf(SUNIMMO_EARLY_TERMINATION_FEE)} HT seront facturés aux locataires. "
        f"En cas de départ anticipé, le locataire est responsable du loyer "
        f"jusqu'à la fin du présent contrat ou jusqu'à la reprise du bail par "
        f"un nouveau locataire.\n\n"
        f"Le contrat se renouvellera aux mêmes conditions pour une année sauf "
        f"avis de résiliation de l'une ou l'autre des parties, donné et reçu "
        f"au moins {months} mois et {days} jours de délais postaux avant la "
        f"date d'échéance{extra}."
    )


# ── PDF builder ──────────────────────────────────────────────────────────────


class _BailPDF(AlthyPdfBase):
    pass


def _build_bail_pdf(
    contract: Contract,
    bien: Bien,
    tenant: User | None,
    locataire: Locataire | None,
    template_type: str,
) -> bytes:
    """Construit le PDF du bail selon `template_type`."""
    is_meuble = template_type in ("sunimmo_saison", "sunimmo_nuitees", "sunimmo_parc")
    is_vaud = template_type == "sunimmo_vaud"
    is_nuitees = template_type == "sunimmo_nuitees"

    pdf = _BailPDF(
        title="Bail à loyer",
        subtitle="Location meublée" if is_meuble else None,
        sender_name=SUNIMMO_SENDER_NAME,
        sender_address=SUNIMMO_SENDER_ADDRESS,
        emit_disclaimer_ia=True,
    )
    pdf.alias_nb_pages()
    pdf.add_page()

    # Titre principal
    pdf.big_title("Bail à loyer" if not is_meuble else "Bail à loyer – Location meublée")

    # Représentant bailleur
    pdf.section_title("Représentant du bailleur")
    pdf.paragraph(
        f"{SUNIMMO_SENDER_NAME}, Rue Louis-Antille 5, 3963 Crans-Montana. "
        "Est mandaté pour conclure un bail au nom et pour le compte d'un représenté."
    )

    # Locataire
    pdf.section_title("Locataire")
    if tenant:
        nom = " ".join(p for p in (tenant.first_name, tenant.last_name) if p) or "—"
        pdf.field_row("Nom · Prénom", nom)
        pdf.field_row("E-mail", tenant.email or "—")
        if tenant.phone:
            pdf.field_row("Téléphone", tenant.phone)
    else:
        pdf.field_row("Nom · Prénom", "À renseigner")
        pdf.field_row("E-mail", "À renseigner")
    if contract.tenant_nationality:
        pdf.field_row("Nationalité", contract.tenant_nationality)
    if contract.occupants_count is not None:
        pdf.field_row("Nombre d'occupants", fmt_int(contract.occupants_count))

    # Cosignataires (depuis Locataire.cosignataires JSONB)
    if locataire and locataire.cosignataires:
        cosig_names = [
            " ".join(p for p in (c.get("prenom"), c.get("nom")) if p)
            for c in locataire.cosignataires
        ]
        if cosig_names:
            pdf.field_row("Cosignataires", ", ".join(cosig_names))
    pdf.paragraph(
        "S'il y a plusieurs signataires sur le bail, alors s'exerce la notion "
        "de co-solidarité en droit et en devoir."
    )

    # Objet du bail
    pdf.section_title("Objet du bail")
    logement, adresse, description = _bien_summary(bien)
    pdf.paragraph_b(logement)
    pdf.paragraph(f"Adresse : {adresse}")
    if description and description != "—":
        pdf.paragraph(f"Description : {description}")

    # Durée du contrat
    pdf.section_title("Durée du contrat")
    if contract.end_date:
        pdf.paragraph(
            f"Contrat à durée déterminée du {fmt_date(contract.start_date)} "
            f"au {fmt_date(contract.end_date)}."
        )
    else:
        pdf.paragraph(
            f"Contrat à durée indéterminée à compter du "
            f"{fmt_date(contract.start_date)}."
        )
    pdf.paragraph(
        "Lors des entrées ou des sorties, tous les protagonistes qui ont signé "
        "le contrat doivent être présents. Si tel n'est pas le cas, la/les "
        "personne(s) présente(s) est/sont responsable(s) des documents signés "
        "pour toutes les personnes nommées dans ce contrat."
    )

    # Résiliation & Reconduction
    pdf.section_title("Résiliation & reconduction")
    if is_nuitees:
        pdf.paragraph(CLAUSES_NUITEES_ANNULATION)
    elif is_meuble:
        pdf.paragraph(
            f"Une résiliation anticipée est conditionnée au fait que le "
            f"locataire doit retrouver un nouveau locataire solvable et prêt "
            f"à reprendre le bail aux mêmes conditions. Des frais de dossier "
            f"de {fmt_chf(SUNIMMO_EARLY_TERMINATION_FEE)} HT seront facturés. "
            f"Une prolongation est possible sous réserve d'un accord préalable "
            f"avec l'agence."
        )
    else:
        pdf.paragraph(_resiliation_block_annee(
            contract.end_date.date() if contract.end_date and hasattr(contract.end_date, "date") else None
        ))

    # Loyer mensuel
    pdf.section_title("Loyer mensuel" if not is_nuitees else "Loyer")
    if contract.monthly_rent:
        suffix = " charges comprises sauf l'électricité, TV et Internet" if not is_meuble else " charges comprises"
        pdf.paragraph_b(
            f"Loyer : {fmt_chf(contract.monthly_rent)} par mois{suffix}"
        )
    if contract.charges and not is_meuble:
        pdf.paragraph(f"Charges : {fmt_chf(contract.charges)}")
    if is_meuble:
        if contract.tourist_tax_amount:
            pdf.paragraph(f"Taxe de séjour : {fmt_chf(contract.tourist_tax_amount)}")
        pdf.paragraph("Assurance RC obligatoire.")

    payment_day = contract.payment_day or 5
    pdf.paragraph(
        f"Le loyer est à verser au plus tard le {payment_day} de chaque mois "
        f"sur le compte suivant :"
    )
    pdf.field_row("Banque", contract.bank_name or SUNIMMO_BANK_NAME)
    pdf.field_row(
        "Titulaire",
        contract.bank_name and "À renseigner" or SUNIMMO_BANK_HOLDER,
    )
    pdf.field_row("IBAN", contract.bank_iban or SUNIMMO_BANK_IBAN)
    pdf.field_row("BIC", contract.bank_bic or SUNIMMO_BANK_BIC)
    if contract.payment_communication:
        pdf.field_row("Communication", contract.payment_communication)
    pdf.paragraph(
        "Pour éviter toutes confusions, merci de respecter les communications "
        "indiquées ci-dessus.",
        size=8,
    )

    # ── Page 2 : IMPORTANT + Caution + Obligations ───────────────────────────
    pdf.add_page()
    pdf.section_title("Important")
    interest_rate = contract.late_interest_rate or SUNIMMO_LATE_INTEREST_RATE
    if is_nuitees:
        interest_rate = 8.0  # Sunimmo nuitées = 8% vs 6% annee/saison
    pdf.bullet_list([
        "Tous les frais bancaires sont à la charge du locataire.",
        f"Tous les frais de rappel ({fmt_chf(contract.reminder_fee or SUNIMMO_REMINDER_FEE)}) "
        "et les frais de poursuites sont à la charge du locataire.",
        "Le loyer est dû de plein droit.",
        f"Un intérêt de {interest_rate:.0f}% l'an, sur toutes les sommes restées "
        "en souffrance et découlant du présent bail, pourra être appliqué en "
        "guise de pénalités de retard.",
    ])
    if contract.mortgage_rate_ref:
        pdf.field_row(
            "Taux hypothécaire de référence",
            f"{float(contract.mortgage_rate_ref):.3f}%",
        )
    if contract.cpi_index_ref:
        pdf.field_row(
            "Indice suisse des prix à la consommation",
            f"{float(contract.cpi_index_ref):.1f}",
        )

    # Caution
    pdf.section_title("Caution (art. 2 RULV)")
    if contract.deposit:
        pdf.paragraph_b(
            f"Le montant de la caution (3 mois maximum) est fixé à "
            f"{fmt_chf(contract.deposit)}."
        )
    pdf.paragraph(
        "Elle est destinée à couvrir les dégâts éventuels et les charges "
        "non-payées. Le locataire ne peut pas utiliser cette caution pour le "
        "dernier loyer. La totalité ou le solde de cette caution sera libéré "
        "après le décompte final des frais."
    )
    deposit_type = contract.deposit_type or "gocaution"
    type_label = {
        "gocaution": "Garantie de loyer auprès d'un organisme (Gocaution, SwissCaution, etc.)",
        "caution_bancaire": "Caution bancaire",
        "compte_epargne": "Compte épargne garantie de loyer",
        "especes": "Versement en espèces sur le compte de l'agence",
    }.get(deposit_type, deposit_type)
    pdf.paragraph(f"Modalité retenue : {type_label}")
    if deposit_type == "compte_epargne" and contract.deposit_iban:
        pdf.field_row("IBAN compte épargne", contract.deposit_iban)
        if contract.deposit_bank_name:
            pdf.field_row("Banque", contract.deposit_bank_name)
    pdf.paragraph(
        "Par sa signature sur le présent contrat, le locataire déclare "
        "accepter expressément que les frais de nettoyage et de remise en état "
        "du logement, ainsi que les charges ou loyers impayés au jour de la "
        "restitution, soient déduits de la caution. Le locataire renonce au "
        "droit d'avoir des intérêts sur cette caution.",
        size=8,
    )

    # Obligations
    pdf.section_title("Obligations")
    pdf.paragraph(
        "Le bailleur veille au bon fonctionnement de l'objet et s'engage à "
        "intervenir en cas de nécessité."
    )
    cleaning_fee = contract.cleaning_fee_hourly or SUNIMMO_NETTOYAGE_HOURLY
    obligations_locataire = [
        f"Nettoyage final effectué par une femme de ménage professionnelle "
        f"mandatée par l'agence ({fmt_chf(cleaning_fee)}/h, 1h minimum facturée). "
        "Le règlement sera prélevé sur la caution ou réglé directement à l'agence.",
        "Le logement est non-fumeur. En cas de non-respect, le locataire est "
        "responsable du nettoyage supplémentaire et des dégâts éventuels.",
    ]
    if not contract.subletting_allowed:
        obligations_locataire.append("La sous-location n'est pas autorisée.")
    obligations_locataire.append(
        "Les parties extérieures privatives doivent être entretenues "
        "régulièrement par les locataires."
    )
    obligations_locataire.append(
        "Taxes de séjour selon inscription à l'office de la population."
    )
    if contract.linen_fee_included:
        obligations_locataire.append(
            "Si du linge est mis à disposition, le nettoyage final du linge "
            "sera facturé."
        )
    pdf.bullet_list(obligations_locataire)

    # Reserve de hausse (si motif renseigné)
    if contract.reserve_hausse_motif:
        pdf.section_title("Réserve de hausse")
        pdf.paragraph(contract.reserve_hausse_motif)
        if contract.reserve_hausse_montant:
            pdf.field_row("Montant", fmt_chf(contract.reserve_hausse_montant))

    # ── Page 3 : Dispositions générales + signatures ─────────────────────────
    pdf.add_page()
    pdf.section_title("Dispositions générales")
    pdf.paragraph(
        "Le présent bail est régi par le Code des Obligations Suisse et les "
        "autres dispositions légales en la matière, ainsi que par les clauses "
        "particulières mentionnées ci-après, qui font partie intégrante du bail "
        "et dont les parties ont pris connaissance."
    )
    pdf.paragraph(
        "Les autorités de conciliation et les tribunaux au for de la situation "
        "de l'immeuble sont seuls compétents dans le cadre des litiges et "
        "contentieux entre le locataire et le bailleur et/ou son représentant "
        f"(en l'occurrence {SUNIMMO_SENDER_NAME})."
    )
    pdf.paragraph_b(
        "Le présent contrat vaut reconnaissance de dette au sens de l'article 82 "
        "LP (Loi Fédérale Poursuites Dettes et Faillites) pour le montant de la "
        "location et pour toutes sommes dues par le locataire en vertu des "
        "dispositions qu'il contient."
    )

    # Conditions particulières spécifiques au bail courant
    if contract.conditions_particulieres:
        pdf.section_title("Conditions particulières (au présent bail)")
        pdf.paragraph(contract.conditions_particulieres)

    pdf.divider()

    # Signatures
    pdf.signatures_block(
        roles=[
            ("Locataire", " ".join(p for p in (tenant.first_name, tenant.last_name) if p) if tenant else None),
            (SUNIMMO_SENDER_NAME, None),
        ],
        city=contract.signed_at_city or "Crans-Montana",
        signed_date=date.today(),
    )

    # ── Page 4-5 : Clauses particulières standard Sunimmo ────────────────────
    pdf.add_page()
    pdf.section_title("Clauses particulières faisant partie intégrante du contrat")
    for title, body in CLAUSES_PARTICULIERES_STD:
        pdf.set_font("Helvetica", "B", 8.5)
        from app.services._althy_pdf_base import PRUSSIAN
        pdf.set_text_color(*PRUSSIAN)
        from app.services._pdf_utils import sanitize_for_pdf as _s
        pdf.cell(0, 5, _s(title), new_x="LMARGIN", new_y="NEXT")
        pdf.paragraph(body, size=8)

    # Vaud — annexes
    if is_vaud:
        pdf.section_title("Annexes (Vaud — RULV)")
        pdf.paragraph(
            "Le présent bail est complété par la formule officielle de "
            "notification de loyer lors de la conclusion d'un nouveau bail "
            "(LFOCL — annexe 1) ainsi que les dispositions paritaires romandes "
            "RULV (annexe 2), conformément aux exigences du Canton de Vaud.",
            size=8,
        )

    # Résiliation du bailleur
    pdf.section_title("Résiliation du bailleur")
    pdf.paragraph(
        "En cas d'inobservation de l'une des clauses du bail, notamment "
        "non-paiement du loyer ou comportement contraire aux égards dus aux "
        "autres habitants, le présent bail peut être résilié par le bailleur "
        "avant son expiration selon les termes légaux en vigueur (résiliations "
        "ordinaires et extraordinaires)."
    )

    pdf.disclaimer_ia()

    return bytes(pdf.output())


# ── Public entry-point ───────────────────────────────────────────────────────


async def generate_bail_pdf(
    contract_id: uuid.UUID, template_type: str | None = None
) -> bytes:
    """Génère le PDF du bail. template_type override Contract.template_type.

    Si pas de template_type fourni, utilise Contract.template_type (champ
    migration 0051). Fallback `sunimmo_annee`.
    """
    async with AsyncSessionLocal() as db:
        contract = await db.get(Contract, contract_id)
        if contract is None:
            logger.warning("generate_bail_pdf: contract %s introuvable", contract_id)
            return b"%PDF-1.4\n% Contract not found\n%%EOF\n"

        bien = await db.get(Bien, contract.bien_id) if contract.bien_id else None
        if bien is None:
            logger.warning("generate_bail_pdf: bien introuvable pour contract %s", contract_id)
            return b"%PDF-1.4\n% Bien not found\n%%EOF\n"

        tenant = None
        if contract.tenant_id:
            tenant = await db.get(User, contract.tenant_id)

        locataire = None
        if contract.tenant_id and contract.bien_id:
            locataire = (
                await db.execute(
                    select(Locataire).where(
                        Locataire.bien_id == contract.bien_id,
                        Locataire.user_id == contract.tenant_id,
                    )
                )
            ).scalar_one_or_none()

        effective_type = template_type or contract.template_type or "sunimmo_annee"
        try:
            return _build_bail_pdf(contract, bien, tenant, locataire, effective_type)
        except Exception:
            logger.exception("generate_bail_pdf failed for contract %s", contract_id)
            raise
