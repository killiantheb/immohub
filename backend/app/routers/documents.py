"""Document generation — baux, mandats, fiches, demandes de pièces."""

from __future__ import annotations

import uuid as uuid_lib
from datetime import datetime
from typing import Annotated, Any

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.contract import Contract
from app.models.bien import Bien
from app.models.document import DocumentTemplate, GeneratedDocument
from app.models.user import User
from fastapi import APIRouter, Depends, HTTPException, Query, status
from jinja2 import BaseLoader, Environment
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

DbDep = Annotated[AsyncSession, Depends(get_db)]
AuthDep = Annotated[User, Depends(get_current_user)]

DISCLAIMER_FR = """
<div style="margin-top:2rem;padding:0.8rem 1rem;background:#fff8f0;border-left:3px solid #D4601A;font-size:11px;color:#666;line-height:1.5;">
  <strong>Avis important :</strong> Ce document est généré automatiquement à titre indicatif et d'aide à la rédaction.
  La responsabilité du contenu et des effets juridiques du présent document incombe exclusivement au bailleur, au locataire
  ou à l'agence signataire. La plateforme Althy décline toute responsabilité quant aux conséquences juridiques
  découlant de l'utilisation de ce document. Il est recommandé de faire vérifier tout contrat par un professionnel
  du droit avant signature.
</div>
"""

# ─── Jinja2 env ──────────────────────────────────────────────────────────────

_jinja = Environment(loader=BaseLoader(), autoescape=False)

SWISS_MONTHS_FR = [
    "", "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
]


def _fmt_date_long(dt: datetime | None) -> str:
    if not dt:
        return "…"
    return f"{dt.day} {SWISS_MONTHS_FR[dt.month]} {dt.year}"


def _fmt_chf(val: float | None) -> str:
    if val is None:
        return "…"
    return f"{val:,.0f}".replace(",", "'")


# ─── Base HTML wrapper ────────────────────────────────────────────────────────

def _wrap_html(body: str, agency: dict, title: str) -> str:
    logo_html = (
        f'<img src="{agency["logo_url"]}" style="height:48px;object-fit:contain;" />'
        if agency.get("logo_url")
        else f'<div style="font-size:22px;font-weight:700;color:#D4601A;letter-spacing:1px;">{agency["name"]}</div>'
    )
    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<title>{title}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500&family=Inter:wght@300;400;500;600&display=swap');
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif; font-size: 11.5px; color: #1C0F06; background: #fff; }}
  .page {{ max-width: 760px; margin: 0 auto; padding: 0 40px 36px; }}
  /* Top accent bar */
  .top-bar {{ height: 3px; background: #D4601A; margin: 0 -40px 32px; }}
  /* Header */
  .header {{ display: flex; align-items: flex-start; justify-content: space-between; padding-bottom: 20px; margin-bottom: 28px; border-bottom: 0.5px solid rgba(212,96,26,0.25); }}
  .agency-info {{ font-size: 10px; color: #8C6E5A; text-align: right; line-height: 1.8; }}
  /* Title */
  h1 {{ font-family: 'Cormorant Garamond', 'Times New Roman', serif; font-size: 20px; font-weight: 400; text-align: center; color: #1C0F06; margin: 18px 0 4px; letter-spacing: 1.5px; text-transform: uppercase; }}
  .doc-ref {{ text-align: center; font-size: 9.5px; color: #8C6E5A; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 24px; }}
  /* Section headers */
  h2 {{ font-size: 8.5px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: #D4601A; padding: 0; margin: 20px 0 2px; }}
  h2::after {{ content: ''; display: block; width: 40px; height: 1px; background: #D4601A; margin-top: 4px; margin-bottom: 8px; }}
  h3 {{ font-size: 10px; font-weight: 600; color: #1C0F06; margin: 10px 0 4px; }}
  /* Info tables */
  table.info {{ width: 100%; border-collapse: collapse; margin: 4px 0 10px; }}
  table.info tr:nth-child(odd) td {{ background: #FAF5EB; }}
  table.info td {{ padding: 5px 8px; vertical-align: top; font-size: 10.5px; border: none; }}
  table.info td:first-child {{ font-weight: 500; color: #8C6E5A; width: 150px; white-space: nowrap; }}
  table.info td:last-child {{ color: #1C0F06; font-weight: 500; }}
  /* Bank/financial tables */
  table.bank {{ width: 100%; border-collapse: collapse; margin: 8px 0; border: 0.5px solid rgba(212,96,26,0.2); border-radius: 8px; overflow: hidden; }}
  table.bank td {{ padding: 5px 10px; font-size: 10.5px; border: 0.5px solid rgba(212,96,26,0.12); }}
  table.bank td:first-child {{ background: #FAF5EB; font-weight: 500; color: #8C6E5A; width: 150px; }}
  /* Lists */
  ul.clauses {{ margin: 6px 0 8px 16px; }}
  ul.clauses li {{ margin-bottom: 4px; font-size: 10.5px; line-height: 1.6; color: #3A2010; }}
  /* Paragraphs */
  p {{ margin: 6px 0; line-height: 1.7; font-size: 10.5px; color: #3A2010; }}
  .important {{ font-weight: 600; color: #D4601A; font-size: 11px; margin: 10px 0 5px; }}
  /* Signature */
  .signature-block {{ display: flex; justify-content: space-between; margin-top: 32px; gap: 24px; }}
  .signature-line {{ flex: 1; border-top: 0.5px solid #8C6E5A; padding-top: 6px; font-size: 10px; color: #8C6E5A; }}
  /* Footer */
  .footer {{ margin-top: 28px; padding-top: 10px; border-top: 0.5px solid rgba(212,96,26,0.2); font-size: 9px; color: #8C6E5A; text-align: center; letter-spacing: 0.3px; }}
  @media print {{ body {{ print-color-adjust: exact; -webkit-print-color-adjust: exact; }} }}
</style>
</head>
<body>
<div class="page">
  <div class="top-bar"></div>
  <div class="header">
    {logo_html}
    <div class="agency-info">
      {agency['address']}<br/>
      {agency['city']}<br/>
      {agency.get('phone','')}<br/>
      {agency.get('email','')}
    </div>
  </div>
  {body}
  {DISCLAIMER_FR}
  <div class="footer">
    Document généré le {datetime.now().strftime('%d.%m.%Y')}&nbsp;&nbsp;·&nbsp;&nbsp;{agency['name']}&nbsp;&nbsp;·&nbsp;&nbsp;{agency.get('website', 'althy.ch')}
  </div>
</div>
</body>
</html>"""


# ─── Template builders ────────────────────────────────────────────────────────

def _build_bail_annee(ctx: dict, with_sale_clause: bool = False) -> str:
    agency = ctx["agency"]
    tenant = ctx["tenant"]
    prop = ctx["property"]
    contract = ctx["contract"]

    sale_block = ""
    if with_sale_clause:
        sale_block = f"""
<h2>IMPORTANT</h2>
<p>Le locataire est rendu attentif au fait que <strong>l'appartement est en vente</strong>.</p>
<p>À la date d'échéance, si l'appartement n'est pas vendu, les deux parties pourront décider ou non de refaire un nouveau contrat d'un an.<br/>
Si l'appartement est vendu et que l'acte authentique est signé, les locataires devront quitter le logement à la date de fin de la location
soit le <strong>{contract['end_date_long']}</strong>.</p>
"""

    partial_block = ""
    if contract.get("partial_period_days") and contract.get("partial_period_rent"):
        partial_block = f"""<p>Loyer pour les <strong>{contract['partial_period_days']} jours de {contract['partial_period_label']}</strong> :
CHF <strong>{_fmt_chf(contract['partial_period_rent'])},-</strong> {contract['charges_label']}</p>"""

    return f"""
<h1>Bail à loyer{"" if not with_sale_clause else " – Logement en vente"}</h1>

<p><strong>Représentant du bailleur :</strong> {agency['name']}<br/>
{agency['address']}, {agency['city']}<br/>
<em>Est mandaté pour conclure un bail au nom et pour le compte d'un représenté.</em></p>

<h2>Locataire</h2>
<table class="info">
  <tr><td>Locataire</td><td><strong>{tenant['civility']} {tenant['full_name']}</strong></td></tr>
  <tr><td>Adresse</td><td>{tenant['address']}</td></tr>
  <tr><td>Tél</td><td>{tenant.get('phone','')}</td></tr>
  <tr><td>E-mail</td><td>{tenant.get('email','')}</td></tr>
  <tr><td>Nationalité</td><td>{tenant.get('nationality','')}</td></tr>
  <tr><td>Nombre d'occupants</td><td>{contract.get('occupants_count', 1)}</td></tr>
</table>
{"<p><em>S'il y a plusieurs signataires sur le bail, alors s'exerce la notion de co-solidarité en droit et en devoir.</em></p>" if contract.get("occupants_count", 1) > 1 else ""}

<h2>Objet du bail</h2>
<p>Logement N° <strong>{prop.get('unit_number','–')}</strong> de <strong>{prop.get('rooms','–')}</strong> pièces dans l'immeuble <strong>{prop.get('building_name','–')}</strong><br/>
Adresse : {prop['address']}, CH – {prop['zip_code']} {prop['city']}<br/>
Description : {prop.get('description','')}</p>

<h2>Durée du contrat</h2>
<p>Contrat d'une durée déterminée du <strong>{contract['start_date_long']}</strong> au <strong>{contract['end_date_long']}</strong></p>
<p><em>Lors des entrées ou des sorties, tous les protagonistes qui ont signé le contrat doivent être présents.</em></p>

<h2>Résiliation &amp; Reconduction</h2>
<p>Une résiliation anticipée est conditionnée au fait que le locataire doit retrouver un nouveau locataire solvable et prêt à reprendre
le bail aux mêmes conditions. L'agence est chargée de valider la candidature. Dans ce cas, des frais de dossiers d'un montant de
<strong>CHF {_fmt_chf(contract.get('early_termination_fee', 270))}.- HT</strong> seront facturés aux locataires.</p>
<p>Il se renouvellera aux mêmes conditions pour une année sauf avis de résiliation de l'une ou l'autre des parties, donné et reçu au moins
<strong>{contract.get('notice_period_months', 3)} mois et 10 jours de délais postaux</strong> avant la date d'échéance
{f", soit avant le <strong>{contract['notice_deadline_date']}</strong> de chaque année." if contract.get("notice_deadline_date") else "."}</p>

{sale_block}

<h2>Loyer mensuel payable d'avance</h2>
{partial_block}
<p>Loyer : <strong>CHF {_fmt_chf(contract.get('monthly_rent'))},-</strong> par mois {contract.get('charges_label','charges comprises')}</p>
{"<p>Une attestation d'assurance RC et Ménage est à fournir avant la remise des clefs du logement.</p>" if not contract.get("linen_fee_included") else ""}

<p><strong>Le loyer est à verser au plus tard le {contract.get('payment_day', 5)} de chaque mois sur le compte suivant, ou en cash à l'agence.</strong></p>
<table class="bank">
  <tr><td>Banque</td><td>{contract.get('bank_name', agency.get('bank_name','BCV'))}</td></tr>
  <tr><td>Titulaire</td><td>{agency['name']}, {agency['address']}, {agency['city']}</td></tr>
  <tr><td>IBAN</td><td>{contract.get('bank_iban', agency.get('iban',''))}</td></tr>
  <tr><td>BIC</td><td>{contract.get('bank_bic', agency.get('bic',''))}</td></tr>
  <tr><td>Communication</td><td><strong>{contract.get('payment_communication', '')}</strong></td></tr>
</table>

<p class="important">IMPORTANT :</p>
<ul class="clauses">
  <li>Tous les frais bancaires sont à la charge du locataire.</li>
  <li>Tous les frais de rappel (CHF {_fmt_chf(contract.get('reminder_fee', 35))},-) et les frais de poursuites sont à la charge du locataire.</li>
  <li>Le loyer est dû de plein droit.</li>
  <li>Un intérêt de {contract.get('late_interest_rate', 6)}% l'an sur toutes les sommes restées en souffrance pourra être appliqué.</li>
</ul>
{"<p>Taux hypothécaire : " + str(contract.get('mortgage_rate_ref','')) + "% | Indice suisse des prix à la consommation : " + str(contract.get('cpi_index_ref','')) + "</p>" if contract.get('mortgage_rate_ref') else ""}

<h2>Caution</h2>
<p>Le montant de la caution (3 mois maximum) est fixé à <strong>CHF {_fmt_chf(contract.get('deposit'))},-</strong>.
Il est destiné à couvrir les dégâts éventuels et les charges non-payées. Le locataire ne peut pas utiliser cette caution pour le dernier loyer.</p>
<ul class="clauses">
  <li>Créer une garantie de loyer auprès d'un organisme style Gocaution.</li>
  <li>Ouvrir un compte épargne garantie de loyer.</li>
</ul>

<h2>Obligations du locataire</h2>
<ul class="clauses">
  <li>Nettoyage final obligatoirement par une femme de ménage professionnelle mandatée par l'agence. 1 heure minimum
  (CHF {_fmt_chf(contract.get('cleaning_fee_hourly', 42))},-) est facturée pour le contrôle.</li>
  <li>Le logement est <strong>non-fumeur</strong>{"." if not contract.get('smoking_allowed') else " sauf accord écrit."}</li>
  <li>La <strong>sous-location n'est pas autorisée</strong>{"." if not contract.get('subletting_allowed') else " — voir accord écrit."}</li>
  {"<li>Si du linge est mis à disposition, le nettoyage final du linge sera facturé.</li>" if contract.get('linen_fee_included') else ""}
  <li>Taxes de séjour selon inscription à l'office de la population.</li>
  {"<li>Animaux acceptés — le locataire est responsable des dégâts et du nettoyage supplémentaire dûs aux animaux.</li>" if contract.get('animals_allowed') else ""}
</ul>

<h2>Dispositions générales</h2>
<p>Le présent bail est régi par le Code des Obligations Suisse et les dispositions légales applicables dans le canton de
<strong>{contract.get('canton','VS')}</strong>, ainsi que par les clauses particulières ci-dessous.</p>
<p>Les autorités de conciliation et les tribunaux au for de la situation de l'immeuble sont seuls compétents dans le cadre des litiges.</p>
<p><strong>Le présent contrat vaut reconnaissance de dette au sens de l'article 82 LP</strong> pour le montant de la location
et pour toutes sommes dues par le locataire.</p>

<h2>Clauses particulières</h2>
<ul class="clauses">
  <li>Le logement est non-fumeur – en cas de non-respect, le locataire est responsable du nettoyage supplémentaire et des dégâts éventuels.</li>
  {"<li>Si les animaux sont acceptés, le locataire est responsable des dégâts occasionnés.</li>" if contract.get('animals_allowed') else ""}
  <li>Lorsque le contrat est signé par correspondance, le locataire s'engage à accepter le logement tel que décrit. Sans réclamation dans un délai de 24 heures dès l'entrée, le locataire est réputé l'avoir reçu en bon état.</li>
  <li><em>Électricité</em> : Les locataires étrangers doivent utiliser un adaptateur (prises suisses incompatibles).</li>
  <li><em>Clés</em> : Le locataire doit contacter le courtier au moins 48h avant son arrivée afin de fixer un rendez-vous de remise des clefs, au plus tard à 17h.</li>
  <li>Les paliers doivent être libres de tout objet pour des raisons esthétiques et de sécurité.</li>
  <li>Silence de 22h à 7h (week-end inclus). Aucune fête ne sera admise sans autorisation.</li>
  <li>Les déchets doivent être mis dans les sacs appropriés et déposés dans les containers prévus à cet effet.</li>
  <li>Le locataire autorise le courtier à effectuer des visites du logement en vue d'une location future ou de vente, avec préavis.</li>
</ul>

<h2>Résiliation par le bailleur</h2>
<p>En cas de non-paiement du loyer ou d'inobservation des clauses du bail, le présent bail peut être résilié par le bailleur
avant son expiration selon les termes légaux en vigueur.</p>

<p>Établi en 2 exemplaires, à {contract.get('signed_at_city', prop['city'])}, le {contract.get('signed_date', '…')}</p>

<div class="signature-block">
  <div class="signature-line">Le(s) locataire(s) :<br/><br/><br/>…………………………………</div>
  <div class="signature-line">{agency['name']} :<br/><br/><br/>…………………………………</div>
</div>
"""


def _build_bail_saison(ctx: dict) -> str:
    agency = ctx["agency"]
    tenant = ctx["tenant"]
    prop = ctx["property"]
    contract = ctx["contract"]

    return f"""
<h1>Bail à loyer – Location Meublée</h1>

<p><strong>Représentant du bailleur :</strong> {agency['name']}<br/>
{agency['address']}, {agency['city']}<br/>
<em>Est mandaté pour conclure un bail au nom et pour le compte d'un représenté.</em></p>

<h2>Locataire</h2>
<table class="info">
  <tr><td>Locataire</td><td><strong>{tenant['civility']} {tenant['full_name']}</strong></td></tr>
  <tr><td>Adresse</td><td>{tenant['address']}</td></tr>
  <tr><td>Tél</td><td>{tenant.get('phone','')}</td></tr>
  <tr><td>E-mail</td><td>{tenant.get('email','')}</td></tr>
  <tr><td>Nationalité</td><td>{tenant.get('nationality','')}</td></tr>
</table>

<h2>Objet du bail</h2>
<p>Logement de <strong>{prop.get('rooms','–')}</strong> pièces — <strong>{prop.get('building_name','')}</strong><br/>
Adresse : {prop['address']}, CH – {prop['zip_code']} {prop['city']}<br/>
Description : {prop.get('description','')}</p>

<h2>Durée du contrat</h2>
<p>Contrat à durée déterminée du <strong>{contract['start_date_long']}</strong> au <strong>{contract['end_date_long']}</strong> à midi.</p>
<p>Une prolongation est possible sous réserve d'accord préalable. Le locataire doit avertir l'agence au moins 1 mois avant la fin du présent contrat.</p>

<h2>Résiliation &amp; Reconduction</h2>
<p>Une résiliation anticipée est conditionnée au fait que le locataire doit retrouver un nouveau locataire solvable et prêt à reprendre le bail
aux mêmes conditions. Frais de dossier : <strong>CHF {_fmt_chf(contract.get('early_termination_fee', 270))}.- HT</strong>.</p>
{"<p>S'il y a plusieurs signataires du bail, alors s'exerce la notion de co-solidarité en droits et devoirs.</p>" if contract.get("occupants_count",1) > 1 else ""}

<h2>Loyer (payable d'avance)</h2>
<p><strong>CHF {_fmt_chf(contract.get('monthly_rent'))},-</strong> {contract.get('charges_label','charges comprises')}</p>
{"<p>Taxe de séjour : CHF " + _fmt_chf(contract.get("tourist_tax_amount")) + ",- pour le séjour</p>" if contract.get("tourist_tax_amount") else ""}
<p><strong>Autres charges :</strong> Assurance RC obligatoire</p>

<p><strong>Le loyer est à verser au plus tard le {contract.get('payment_day', 5)} de chaque mois sur le compte suivant :</strong></p>
<table class="bank">
  <tr><td>Banque</td><td>{contract.get('bank_name', agency.get('bank_name',''))}</td></tr>
  <tr><td>Titulaire</td><td>{agency['name']}, {agency['address']}, {agency['city']}</td></tr>
  <tr><td>IBAN</td><td>{contract.get('bank_iban', agency.get('iban',''))}</td></tr>
  <tr><td>BIC</td><td>{contract.get('bank_bic', agency.get('bic',''))}</td></tr>
  <tr><td>Communication</td><td><strong>{contract.get('payment_communication','')}</strong></td></tr>
</table>

<p class="important">IMPORTANT :</p>
<ul class="clauses">
  <li>Tous les frais bancaires sont à la charge du locataire.</li>
  <li>Tous les frais de rappel (CHF {_fmt_chf(contract.get('reminder_fee', 35))},-) et les frais de poursuites sont à la charge du locataire.</li>
  <li>Intérêt de {contract.get('late_interest_rate', 6)}% l'an sur toutes les sommes restées en souffrance.</li>
</ul>

<h2>Caution</h2>
<p>Le montant de la caution est fixé à <strong>CHF {_fmt_chf(contract.get('deposit'))},-</strong> (3 mois maximum).
À verser sur le compte de l'agence maximum <strong>{contract.get('deposit_payment_deadline_days', 10)} jours</strong> avant le début du contrat ou en cash avant la remise des clés.</p>

<h2>Charges &amp; Obligations du locataire</h2>
<ul class="clauses">
  <li>Nettoyage final obligatoirement par une femme de ménage mandatée par l'agence. 1h minimum (CHF {_fmt_chf(contract.get('cleaning_fee_hourly', 38))}.- HT) pour la vérification.</li>
  <li>Le logement est <strong>non-fumeur</strong>.</li>
  {"<li>Linge selon facture finale — le linge utilisé doit être lavé, repassé et rangé à sa place initiale.</li>" if contract.get('linen_fee_included') else ""}
  <li>Taxes de séjour selon inscription à l'office de la population.</li>
</ul>

<h2>Dispositions générales</h2>
<p>Le présent bail est régi par le Code des Obligations Suisse et les dispositions légales du canton de <strong>{contract.get('canton','VS')}</strong>.</p>
<p><strong>Le présent contrat vaut reconnaissance de dette au sens de l'article 82 LP.</strong></p>

<p>Établi en 2 exemplaires, à {contract.get('signed_at_city', prop['city'])}, le {contract.get('signed_date', '…')}</p>

<div class="signature-block">
  <div class="signature-line">Le(s) locataire(s) :<br/><br/><br/>…………………………………</div>
  <div class="signature-line">{agency['name']} :<br/><br/><br/>…………………………………</div>
</div>
"""


def _build_mandat_gestion(ctx: dict) -> str:
    agency = ctx["agency"]
    owner = ctx["owner"]
    prop = ctx["property"]

    return f"""
<h1>Contrat de mandat de gestion locative</h1>
<p>Sous couvert des articles 394ss et suivant du Code des Obligations (CO), il est entendu ce qui suit :</p>

<h2>Article 1 – Parties contractantes</h2>
<p>Entre (le soussigné) :</p>
<table class="info">
  <tr><td>Nom / Prénom</td><td><strong>{owner.get('full_name','')}</strong></td></tr>
  <tr><td>Adresse</td><td>{owner.get('address','')}</td></tr>
  <tr><td>Téléphone</td><td>{owner.get('phone','')}</td></tr>
  <tr><td>E-mail</td><td>{owner.get('email','')}</td></tr>
</table>
<p><em>ci-après désigné « le (la) mandant(e) »</em></p>

<p>et (la soussignée) :</p>
<table class="info">
  <tr><td></td><td><strong>{agency['name']}</strong></td></tr>
  <tr><td>Représentée par</td><td>{agency.get('representative','')}</td></tr>
  <tr><td>Adresse</td><td>{agency['address']}, {agency['city']}</td></tr>
</table>
<p><em>ci-après désignée « le courtier »</em></p>

<h2>Article 2 – Contrat</h2>
<p>Le présent contrat donne au courtier le mandat de gestion locative servant d'intermédiaire entre le mandant et le client afin de louer le logement.</p>
<p>{agency['name']} fera :</p>
<ul class="clauses">
  <li>Un inventaire photos pour la constitution du dossier</li>
  <li>Une mise-en-ligne du bien sur plusieurs sites Internet</li>
  <li>Une prise de contact client</li>
  <li>La préparation du contrat de bail</li>
  <li>L'encaissement des loyers et de la caution</li>
  <li>Le versement des loyers au propriétaire</li>
  <li>Le décompte annuel</li>
  <li>Les états des lieux entrée-sortie et/ou intermédiaire en cas de vente de l'objet</li>
  <li>L'organisation du nettoyage à la fin de la location (appartement, linge et draps)</li>
</ul>

<h2>Article 3 – Désignation de l'objet</h2>
<table class="info">
  <tr><td>Logement N°</td><td>{prop.get('unit_number','')}</td></tr>
  <tr><td>Immeuble</td><td>{prop.get('building_name','')}</td></tr>
  <tr><td>Adresse</td><td>{prop['address']}, CH – {prop['zip_code']} {prop['city']}</td></tr>
  <tr><td>Description</td><td>{prop.get('description','')}</td></tr>
</table>

<h2>Article 4 – Prix de location</h2>
<p>Les prix sont fixés d'un commun accord entre les deux parties.<br/>
Le propriétaire autorise {agency['name']} à ajouter tous frais supplémentaires (nettoyage, linge…) à la charge du locataire.</p>
<p>Les loyers seront versés sur le compte du propriétaire :</p>
<table class="bank">
  <tr><td>Banque</td><td>{owner.get('bank_name','')}</td></tr>
  <tr><td>Titulaire</td><td>{owner.get('full_name','')}</td></tr>
  <tr><td>IBAN</td><td>{owner.get('iban','')}</td></tr>
  <tr><td>BIC</td><td>{owner.get('bic','')}</td></tr>
</table>

<h2>Article 5 – Obligation de la gérance</h2>
<p>La gérance est autorisée en cas de nécessité à prendre toutes les mesures qui s'imposent pour sauvegarder les intérêts du propriétaire.
Elle procède à l'encaissement des loyers et n'est pas responsable de l'insolvabilité imprévisible des locataires.</p>
<p>En cas de litige, tous les courriers rédigés par l'agence seront facturés <strong>CHF 300.- HT</strong>.
Représentation à la commission de conciliation : <strong>CHF 1'200.- HT</strong>.</p>

<h2>Article 6 – Obligation du propriétaire</h2>
<ul class="clauses">
  <li>Le propriétaire s'engage à équiper son logement de tout le nécessaire pour la satisfaction des locataires.</li>
  <li>La cuisine doit être équipée de tout l'électroménager obligatoire et en bon fonctionnement.</li>
  <li>En cas de location à la semaine ou à la saison, le linge de salle de bain et de lit doit être fourni.</li>
  <li>Trois jeux de clefs de l'appartement seront fournis à l'agence.</li>
</ul>

<h2>Article 7 – Commission du courtier</h2>
<ul class="clauses">
  <li>20% HT du montant total pour une location à la semaine + TVA</li>
  <li>15% HT du montant total pour une location saison + TVA</li>
  <li>10% HT du montant total pour une location à l'année + TVA</li>
</ul>

<h2>Article 8 – Durée du contrat</h2>
<p>Le mandant accorde au courtier le contrat de mandat de gestion locative à compter de la date de signature.
Le propriétaire peut résilier par courrier conformément à l'article 404 CO s'il n'y a pas de bail signé.</p>

<h2>Article 9 – Droit applicable</h2>
<p>Le Droit Suisse est seul applicable. Pour tous les conflits, toutes les parties font élection de domicile et de for à {agency.get('legal_city', prop['city'])}.</p>

<p>Fait à {agency.get('city_short', prop['city'])}, le ………………………………</p>

<div class="signature-block">
  <div class="signature-line">Le (la) mandant(e) :<br/><br/><br/>…………………………………</div>
  <div class="signature-line">{agency['name']} :<br/><br/><br/>…………………………………</div>
</div>
"""


def _build_fiche_bien(ctx: dict) -> str:  # noqa: C901
    import calendar as _cal
    agency  = ctx["agency"]
    prop    = ctx["property"]
    contract = ctx.get("contract", {})
    extra   = ctx.get("extra", {})

    # ── Helper: icon chip ─────────────────────────────────────────────────────
    def chip(label: str, active: bool) -> str:
        ok   = "background:#FAF5EB;border:0.5px solid rgba(212,96,26,0.35);color:#1C0F06;"
        off  = "background:#f4f4f4;border:0.5px solid #ddd;color:#bbb;"
        mark = "✓ " if active else ""
        return (f'<span style="{ok if active else off}padding:4px 10px;border-radius:20px;'
                f'font-size:10px;white-space:nowrap;display:inline-block;margin:3px 2px;">'
                f'{mark}{label}</span>')

    # ── Équipements ───────────────────────────────────────────────────────────
    equip = [
        ("Meublé",           prop.get("is_furnished")),
        ("Balcon",           prop.get("has_balcony")),
        ("Terrasse",         prop.get("has_terrace")),
        ("Jardin",           prop.get("has_garden")),
        ("Parking",          prop.get("has_parking")),
        ("Cave / stockage",  prop.get("has_storage")),
        ("Cheminée",         prop.get("has_fireplace")),
        ("Buanderie",        prop.get("has_laundry")),
        ("Linge fourni",     prop.get("linen_provided")),
        ("Animaux acceptés", prop.get("pets_allowed")),
        ("Fumeurs acceptés", prop.get("smoking_allowed")),
    ]
    equip_html = "".join(chip(l, v) for l, v in equip)

    # ── Cover photo ───────────────────────────────────────────────────────────
    cover_url = prop.get("cover_url")
    cover_html = (
        f'<img src="{cover_url}" '
        f'style="width:100%;height:260px;object-fit:cover;border-radius:10px;'
        f'display:block;margin-bottom:22px;" />'
        if cover_url else ""
    )

    # ── Key stats bar ─────────────────────────────────────────────────────────
    def stat(label: str, val) -> str:
        if not val and val != 0:
            return ""
        return (f'<div style="text-align:center;padding:12px 16px;background:#FAF5EB;'
                f'border-radius:10px;border:0.5px solid rgba(212,96,26,0.2);flex:1;">'
                f'<div style="font-size:18px;font-weight:300;color:#D4601A;font-family:Georgia,serif">{val}</div>'
                f'<div style="font-size:9px;color:#8C6E5A;margin-top:2px;letter-spacing:0.5px">{label}</div>'
                f'</div>')

    stats_cells = [
        stat("surface m²",    prop.get("surface")),
        stat("pièces",        prop.get("rooms")),
        stat("chambres",      prop.get("bedrooms")),
        stat("sdb",           prop.get("bathrooms")),
        stat("étage",         prop.get("floor")),
    ]
    stats_html = "".join(s for s in stats_cells if s)

    # ── Rental modes & pricing ────────────────────────────────────────────────
    monthly_rent = (contract.get("monthly_rent") or prop.get("monthly_rent"))
    deposit      = (contract.get("deposit")       or prop.get("deposit"))
    charges      = (contract.get("charges")       or prop.get("charges"))
    price_sale   = prop.get("price_sale")
    tourist_tax  = prop.get("tourist_tax_amount")

    # Extra can override / add rental modes:
    # extra = { "price_annual": n, "price_seasonal": n, "price_nightly": n,
    #           "seasonal_weeks": n, "has_annual": bool, "has_seasonal": bool, "has_nightly": bool }
    def _num(v):
        try: return float(v) if v else None
        except: return None

    price_annual   = _num(extra.get("price_annual"))   or monthly_rent
    price_seasonal = _num(extra.get("price_seasonal"))
    price_nightly  = _num(extra.get("price_nightly"))  or (round(float(monthly_rent) / 30, 0) if monthly_rent else None)

    def _truthy(val, default=False):
        if val is None: return default
        return str(val).lower() in ("true", "1", "yes")

    has_annual   = _truthy(extra.get("has_annual"),   bool(monthly_rent))
    has_seasonal = _truthy(extra.get("has_seasonal"), False)
    has_nightly  = _truthy(extra.get("has_nightly"),  False)
    has_sale     = bool(price_sale)

    # Detect from contract type
    if contract.get("type") == "long_term":
        has_annual = True
    elif contract.get("type") == "seasonal":
        has_seasonal = True
    elif contract.get("type") == "short_term":
        has_nightly = True

    pricing_rows = []
    if has_sale and price_sale:
        pricing_rows.append(
            f'<tr><td style="width:160px">Prix de vente</td>'
            f'<td><strong style="color:#D4601A;font-size:14px">CHF {_fmt_chf(price_sale)}.-</strong></td></tr>'
        )
    if has_annual and price_annual:
        pricing_rows.append(
            f'<tr><td>Location annuelle</td>'
            f'<td><strong style="color:#D4601A;font-size:14px">CHF {_fmt_chf(price_annual)}.- / mois</strong></td></tr>'
        )
        if charges:
            pricing_rows.append(f'<tr><td>Charges</td><td>CHF {_fmt_chf(charges)}.- / mois</td></tr>')
        if deposit:
            pricing_rows.append(f'<tr><td>Caution (dépôt)</td><td>CHF {_fmt_chf(deposit)}.-</td></tr>')
    if has_seasonal and price_seasonal:
        seasonal_weeks = extra.get("seasonal_weeks", "")
        sw = f" ({seasonal_weeks} sem.)" if seasonal_weeks else ""
        pricing_rows.append(
            f'<tr><td>Location saisonnière{sw}</td>'
            f'<td><strong style="color:#D4601A;font-size:14px">CHF {_fmt_chf(price_seasonal)}.-</strong></td></tr>'
        )
    if has_nightly and price_nightly:
        pricing_rows.append(
            f'<tr><td>Tarif nuitée (base)</td>'
            f'<td><strong style="color:#D4601A;font-size:14px">CHF {_fmt_chf(price_nightly)}.- / nuit</strong></td></tr>'
        )
        if tourist_tax:
            pricing_rows.append(f'<tr><td>Taxe de séjour</td><td>CHF {_fmt_chf(tourist_tax)} / pers. / nuit</td></tr>')

    pricing_html = ""
    if pricing_rows:
        pricing_html = (
            f'<h2>Tarifs</h2>'
            f'<table class="bank">{"".join(pricing_rows)}</table>'
        )

    # ── Weekly nightly calendar ───────────────────────────────────────────────
    calendar_html = ""
    if has_nightly and price_nightly:
        base = float(price_nightly)
        # Seasonal multipliers (VS Valais typical)
        season_mult = {
            1: 0.85, 2: 1.30, 3: 0.80, 4: 0.75, 5: 0.80, 6: 1.10,
            7: 1.50, 8: 1.50, 9: 0.90, 10: 0.85, 11: 0.80, 12: 1.40,
        }
        # Extra can provide custom nightly rates: { "nightly_rates": {"2025-07": 200, "2025-08": 220} }
        custom_rates = extra.get("nightly_rates", {})  # key: "YYYY-MM", val: nightly price

        today = datetime.now()
        months_html = []
        fr_months = ["Janvier","Février","Mars","Avril","Mai","Juin",
                     "Juillet","Août","Septembre","Octobre","Novembre","Décembre"]
        fr_days = ["Lu","Ma","Me","Je","Ve","Sa","Di"]

        for mi in range(12):
            yr  = today.year + (today.month - 1 + mi) // 12
            mo  = (today.month - 1 + mi) % 12 + 1
            key = f"{yr}-{mo:02d}"
            rate = custom_rates.get(key) or round(base * season_mult.get(mo, 1.0), 0)
            is_high = rate >= base * 1.2

            _, n_days = _cal.monthrange(yr, mo)
            first_wd  = _cal.weekday(yr, mo, 1)  # 0=Mon

            header_bg = "#D4601A" if is_high else "#FAF5EB"
            header_fg = "#fff"    if is_high else "#1C0F06"

            cells = ["<td></td>"] * first_wd
            for d in range(1, n_days + 1):
                cells.append(f"<td>{d}</td>")
            # pad to complete weeks
            while len(cells) % 7 != 0:
                cells.append("<td></td>")

            rows_cal = ""
            for i in range(0, len(cells), 7):
                rows_cal += "<tr>" + "".join(cells[i:i+7]) + "</tr>"

            months_html.append(f"""
<div style="display:inline-block;width:180px;margin:4px;vertical-align:top;
  border:0.5px solid rgba(212,96,26,0.2);border-radius:8px;overflow:hidden;">
  <div style="background:{header_bg};color:{header_fg};padding:5px 8px;
    font-size:10px;font-weight:600;letter-spacing:0.5px;text-align:center;">
    {fr_months[mo-1]} {yr}
    <span style="margin-left:6px;font-size:9px;opacity:0.85;">CHF {int(rate)}/nuit</span>
  </div>
  <table style="width:100%;border-collapse:collapse;font-size:9px;">
    <tr>{"".join(f"<th style='padding:2px;text-align:center;color:#8C6E5A;font-weight:600'>{d}</th>" for d in fr_days)}</tr>
    {rows_cal}
  </table>
</div>""")

        calendar_html = (
            f'<h2>Calendrier & tarifs nuitée (12 mois)</h2>'
            f'<p style="font-size:10px;color:#8C6E5A;margin-bottom:10px;">'
            f'  Tarif de base : CHF {int(base)}/nuit. '
            f'  <span style="display:inline-block;background:#D4601A;color:#fff;'
            f'padding:1px 8px;border-radius:10px;font-size:9px">Haute saison</span>'
            f'  <span style="display:inline-block;background:#FAF5EB;border:0.5px solid rgba(212,96,26,0.3);'
            f'color:#1C0F06;padding:1px 8px;border-radius:10px;font-size:9px;margin-left:4px">Basse saison</span>'
            f'</p>'
            f'<div style="line-height:0">{"".join(months_html)}</div>'
        )

    # ── Nearby / location detail ──────────────────────────────────────────────
    landmarks = prop.get("nearby_landmarks", "")
    maps_url  = (f"https://www.google.com/maps/search/?api=1&query="
                 f"{prop.get('address','').replace(' ','+')},"
                 f"{prop.get('zip_code','')}+{prop.get('city','')}")
    location_extra = ""
    if landmarks:
        location_extra = f'<p style="margin-top:6px;color:#3A2010;"><strong>À proximité :</strong> {landmarks}</p>'

    ref_row = (f'<tr><td>Référence</td><td>{prop.get("reference_number","")}</td></tr>'
               if prop.get("reference_number") else "")
    canton_row = (f'<tr><td>Canton</td><td>{prop.get("canton","")}</td></tr>'
                  if prop.get("canton") else "")

    # ── Final assembly ────────────────────────────────────────────────────────
    return f"""
<h1>Fiche de présentation</h1>

{cover_html}

<p style="text-align:center;font-size:11px;font-weight:600;letter-spacing:1.5px;
color:#D4601A;text-transform:uppercase;margin-bottom:4px;">{prop.get('status_label','À Louer')}</p>
<p style="text-align:center;font-size:22px;font-weight:300;font-family:Georgia,serif;
color:#1C0F06;margin:0 0 4px;">{prop.get('type_label','Appartement')} · {prop.get('city','')}</p>
{f'<p style="text-align:center;font-size:11px;color:#8C6E5A;margin-bottom:16px;">{prop.get("address","")}, {prop.get("zip_code","")} {prop.get("city","")}</p>' if prop.get('address') else ''}

<div style="display:flex;flex-wrap:wrap;gap:8px;margin:16px 0;">{stats_html}</div>

<h2>Localisation</h2>
<table class="bank">
  <tr><td>Adresse</td><td><strong>{prop.get('address','—')}, {prop.get('zip_code','')} {prop.get('city','—')}</strong></td></tr>
  {canton_row}
  <tr><td>Étage</td><td>{prop.get('floor','—')}</td></tr>
  {ref_row}
  <tr><td>Plan</td><td><a href="{maps_url}" style="color:#D4601A">Voir sur Google Maps →</a></td></tr>
</table>
{location_extra}

<h2>Description du logement</h2>
<p style="line-height:1.8;color:#3A2010">{prop.get('description','Aucune description disponible.')}</p>

<h2>Équipements & commodités</h2>
<div style="margin:8px 0">{equip_html}</div>

<h2>Caractéristiques techniques</h2>
<table class="bank">
  <tr><td>Type</td><td>{prop.get('type_label','—')}</td></tr>
  <tr><td>Surface habitable</td><td>{prop.get('surface','—')} m²</td></tr>
  <tr><td>Nombre de pièces</td><td>{prop.get('rooms','—')}</td></tr>
  <tr><td>Chambres</td><td>{prop.get('bedrooms','—')}</td></tr>
  <tr><td>Salles de bain</td><td>{prop.get('bathrooms','—')}</td></tr>
  <tr><td>Étage</td><td>{prop.get('floor','—')}</td></tr>
  {"<tr><td>Bâtiment</td><td>" + str(prop.get('building_name','')) + "</td></tr>" if prop.get('building_name') else ""}
  {"<tr><td>Unité</td><td>" + str(prop.get('unit_number','')) + "</td></tr>" if prop.get('unit_number') else ""}
</table>

{pricing_html}

{calendar_html}

<h2>Contact</h2>
<table class="info">
  <tr><td>Agence / Courtier</td><td><strong>{agency.get('name','')}</strong></td></tr>
  {"<tr><td>Représentant</td><td>" + agency.get('representative','') + "</td></tr>" if agency.get('representative') else ""}
  <tr><td>Téléphone</td><td>{agency.get('phone','—')}</td></tr>
  <tr><td>E-mail</td><td>{agency.get('email','—')}</td></tr>
  <tr><td>Site web</td><td>{agency.get('website','althy.ch')}</td></tr>
</table>

<p style="margin-top:20px;font-size:9px;color:#aaa;font-style:italic;border-top:0.5px solid #eee;padding-top:8px;">
Ce descriptif est fourni à titre indicatif et n'a pas de valeur contractuelle.
Les informations sont susceptibles d'être modifiées sans préavis.
Ce document est confidentiel et ne peut être transmis à des tiers sans autorisation écrite de l'agence.
</p>
"""


def _build_demande_pieces(ctx: dict, profile: str = "annee") -> str:
    """profile: annee | saison | nuitee | societe | commercial"""
    agency = ctx["agency"]
    prop = ctx.get("property", {})

    common_info = """
<ul class="clauses">
  <li>Votre adresse personnelle</li>
  <li>Votre nationalité</li>
  <li>Votre adresse e-mail</li>
  <li>Vos coordonnées téléphoniques</li>
  <li>Vos dates exactes de location</li>
</ul>"""

    docs_by_profile = {
        "annee": """
<p>Et nous adresser par mail :</p>
<ul class="clauses">
  <li>Pièce d'identité (passeport ou carte d'identité)</li>
  <li>Permis de séjour (si applicable)</li>
  <li>Contrat de travail</li>
  <li>3 derniers bulletins de salaire (si vous en avez)</li>
  <li>Attestation d'assurance Responsabilité Civile</li>
  <li>Caution auprès d'un organisme (Gocaution, Swisscaution) ou d'une banque</li>
  <li>Extrait d'office des poursuites de moins de 3 mois</li>
  <li>Référence du propriétaire ou de la dernière agence de location</li>
</ul>""",
        "saison": """
<p>Et nous adresser par mail :</p>
<ul class="clauses">
  <li>Pièce d'identité (passeport ou carte d'identité)</li>
  <li>Permis de séjour (si applicable)</li>
  <li>Attestation d'assurance Responsabilité Civile</li>
</ul>""",
        "nuitee": """
<p>Et nous adresser par mail :</p>
<ul class="clauses">
  <li>Pièce d'identité (passeport ou carte d'identité)</li>
  <li>Attestation d'assurance Responsabilité Civile</li>
</ul>""",
        "societe": """
<p>Et nous adresser par mail :</p>
<ul class="clauses">
  <li>Extrait du registre du commerce de la société (Zefix)</li>
  <li>Pièce d'identité du représentant de la société</li>
  <li>Permis de séjour du représentant (si applicable)</li>
  <li>Attestation d'assurance Responsabilité Civile</li>
  <li>Caution auprès d'une banque ou d'un organisme comme Swisscaution</li>
  <li>Extrait d'office des poursuites de moins de 3 mois</li>
</ul>""",
        "commercial": """
<p>Et nous adresser par mail :</p>
<ul class="clauses">
  <li>Extrait du registre du commerce (Zefix)</li>
  <li>Statuts de la société</li>
  <li>Pièce d'identité du représentant légal</li>
  <li>Attestation d'assurance Responsabilité Civile Professionnelle</li>
  <li>Bilans et comptes de résultat des 2 derniers exercices</li>
  <li>Caution bancaire ou garantie d'organisme spécialisé</li>
  <li>Extrait d'office des poursuites de moins de 3 mois</li>
  <li>Plan d'affaires si la société est récente</li>
</ul>""",
    }

    profile_labels = {
        "annee": "location à l'année",
        "saison": "location saisonnière",
        "nuitee": "location à la nuitée",
        "societe": "location pour une société",
        "commercial": "bail commercial",
    }

    societe_extra = ""
    if profile == "societe":
        societe_extra = """
<p>Merci de nous communiquer également :</p>
<ul class="clauses">
  <li>Le nom de la société</li>
  <li>Le nom du représentant</li>
  <li>L'adresse du représentant</li>
  <li>La nationalité du représentant</li>
</ul>"""

    prop_ref = f" — {prop.get('building_name', '')} {prop.get('address', prop.get('city', ''))}" if prop.get('city') else ""

    return f"""
<h1>Demande de pièces</h1>
<p style="text-align:center;">Renseignements et documents nécessaires pour un contrat de {profile_labels.get(profile, profile)}{prop_ref}</p>

<h2>Informations à nous communiquer</h2>
{common_info}
{societe_extra}
{docs_by_profile.get(profile, docs_by_profile['annee'])}

<p style="margin-top:20px;">Merci de nous faire parvenir ces documents à l'adresse : <strong>{agency.get('email','')}</strong></p>
<p>Pour toute question : <strong>{agency.get('phone','')}</strong></p>
<p style="margin-top:12px;font-size:10px;color:#888;">Ces documents sont traités de manière confidentielle et utilisés uniquement dans le cadre de votre dossier de location.</p>
"""


def _build_quittance(ctx: dict) -> str:
    """Quittance de loyer mensuelle."""
    agency = ctx["agency"]
    tenant = ctx["tenant"]
    prop = ctx["property"]
    contract = ctx["contract"]
    extra = ctx.get("extra", {})

    month_num = int(extra.get("quittance_month", datetime.now().month))
    year = int(extra.get("quittance_year", datetime.now().year))
    month_label = SWISS_MONTHS_FR[month_num] if 1 <= month_num <= 12 else "…"

    loyer = float(extra.get("quittance_amount") or contract.get("monthly_rent") or 0)
    charges = float(contract.get("charges") or 0)
    total = loyer + charges
    charges_row = f"<tr><td>Charges</td><td style='text-align:right'>CHF {_fmt_chf(charges)}.-</td></tr>" if charges else ""
    total_row = f"<tr style='border-top:2px solid #1a1a1a;font-weight:700'><td>Total versé</td><td style='text-align:right'>CHF {_fmt_chf(total)}.-</td></tr>" if charges else ""

    signed_city = contract.get("signed_at_city") or prop.get("city", "")

    return f"""
<h1>Quittance de loyer</h1>
<p style="text-align:center;font-size:13px;color:#555;">Période : <strong>{month_label} {year}</strong></p>

<h2>Bailleur / Régisseur</h2>
<table class="info">
  <tr><td>Nom</td><td><strong>{agency['name']}</strong></td></tr>
  <tr><td>Adresse</td><td>{agency['address']}, {agency['city']}</td></tr>
  <tr><td>E-mail</td><td>{agency.get('email','')}</td></tr>
  <tr><td>Téléphone</td><td>{agency.get('phone','')}</td></tr>
</table>

<h2>Locataire</h2>
<table class="info">
  <tr><td>Nom</td><td><strong>{tenant.get('full_name','')}</strong></td></tr>
  <tr><td>Adresse du bien</td><td>{prop.get('address','')}, CH-{prop.get('zip_code','')} {prop.get('city','')}</td></tr>
  {f"<tr><td>Appartement</td><td>N° {prop.get('unit_number')}</td></tr>" if prop.get('unit_number') else ""}
  <tr><td>Référence contrat</td><td>{contract.get('reference','')}</td></tr>
</table>

<h2>Montant encaissé</h2>
<table class="bank" style="width:100%;max-width:400px;">
  <tr><td>Loyer net</td><td style="text-align:right">CHF {_fmt_chf(loyer)}.-</td></tr>
  {charges_row}
  {total_row}
</table>

<p style="margin-top:1.2rem;">
Le bailleur, ou son mandataire, reconnaît avoir reçu de <strong>{tenant.get('full_name','…')}</strong>
la somme de <strong>CHF {_fmt_chf(total)}.-</strong>
à titre de loyer {f"et charges " if charges else ""}pour le mois de <strong>{month_label} {year}</strong>
concernant le logement sis <strong>{prop.get('address','')}, {prop.get('city','')}</strong>.
</p>

<p>Le locataire est à jour de ses paiements pour la période mentionnée.</p>

<p style="margin-top:1.5rem;">Fait à {signed_city}, le {datetime.now().strftime('%d.%m.%Y')}</p>

<div class="signature-block" style="margin-top:2rem;">
  <div class="signature-line">Le bailleur / régisseur :<br/><br/><br/>…………………………………<br/><small>{agency['name']}</small></div>
  <div class="signature-line">Accusé de réception :<br/><br/><br/>…………………………………<br/><small>{tenant.get('full_name','Le locataire')}</small></div>
</div>
"""


def _build_requisition_poursuite(ctx: dict) -> str:
    agency = ctx["agency"]
    tenant = ctx["tenant"]
    contract = ctx.get("contract", {})
    claims = ctx.get("claims", [])

    claims_rows = ""
    for i, claim in enumerate(claims[:10], 1):
        claims_rows += f"<tr><td>{i}</td><td>{claim.get('cause','')}</td><td>CHF {_fmt_chf(claim.get('amount'))}</td><td>{claim.get('interest_rate','')}</td><td>{claim.get('interest_from','')}</td></tr>"

    return f"""
<h1>Réquisition de poursuite</h1>
<p style="font-size:10px;color:#888;">À remplir en majuscules — LP RS 281.1</p>

<h2>Débiteur</h2>
<table class="info">
  <tr><td>Nom / Prénom</td><td><strong>{tenant.get('full_name','')}</strong></td></tr>
  <tr><td>Adresse</td><td>{tenant.get('address','')}</td></tr>
  <tr><td>NPA / Lieu</td><td>{tenant.get('zip','')} {tenant.get('city','')}</td></tr>
  <tr><td>Date de naissance</td><td>{tenant.get('dob','')}</td></tr>
</table>

<h2>Créancier</h2>
<table class="info">
  <tr><td>Raison sociale</td><td><strong>{agency['name']}</strong></td></tr>
  <tr><td>Adresse</td><td>{agency['address']}</td></tr>
  <tr><td>NPA / Lieu</td><td>{agency['city']}</td></tr>
</table>
<table class="bank">
  <tr><td>IBAN</td><td>{agency.get('iban','')}</td></tr>
  <tr><td>Téléphone</td><td>{agency.get('phone','')}</td></tr>
  <tr><td>E-mail</td><td>{agency.get('email','')}</td></tr>
</table>

<h2>Créances</h2>
<table class="bank" style="width:100%;">
  <tr style="background:#f5f5f5;">
    <td style="width:30px;">#</td>
    <td>Cause de l'obligation / Titre de la créance</td>
    <td style="width:100px;">Montant (CHF)</td>
    <td style="width:60px;">Intérêt %</td>
    <td style="width:80px;">Dès le</td>
  </tr>
  {claims_rows if claims_rows else "<tr><td colspan='5'>…</td></tr>"}
</table>

<p style="margin-top:12px;"><strong>Observations :</strong> Bail à loyer réf. {contract.get('reference','')}, {contract.get('start_date_long','')} – {contract.get('end_date_long','')}</p>
<p><strong>Votre référence :</strong> {contract.get('reference','')}</p>

<p style="margin-top:16px;">Date et signature : ………………………………</p>

<p style="margin-top:16px;font-size:10px;color:#888;font-style:italic;">
Ce formulaire doit être adressé à l'office des poursuites compétent selon le for du débiteur (art. 46 LP).
Pour les personnes domiciliées en Suisse : office des poursuites du domicile du débiteur.
Pour plus d'informations : www.portaildespoursuites.ch
</p>
"""


# ─── Relance 3 niveaux ────────────────────────────────────────────────────────

def _build_relance(ctx: dict, niveau: int = 1) -> str:
    """
    Niveau 1 — Rappel amiable (avant échéance ou J+3)
    Niveau 2 — Mise en demeure (J+7 : CO art. 102)
    Niveau 3 — Résiliation (J+30 : CO art. 257d — délai congé 30 jours)
    """
    agency = ctx["agency"]
    tenant = ctx["tenant"]
    contract = ctx.get("contract", {})
    today = ctx.get("today", "…")
    montant = ctx.get("montant", "…")
    periode = ctx.get("periode", "…")

    NIVEAUX = {
        1: {
            "titre": "Rappel de loyer",
            "objet": f"Rappel — Loyer {periode}",
            "ton": "cordial",
            "corps": f"""
<p>Nous nous permettons de vous adresser le présent rappel concernant le loyer du mois de <strong>{periode}</strong>,
d'un montant de <strong>CHF {montant}</strong>, qui n'apparaît pas encore à notre décompte.</p>

<p>Il s'agit peut-être d'un simple oubli. Nous vous prions de bien vouloir effectuer le virement dans les meilleurs délais
sur le compte indiqué ci-dessous.</p>

<p>En cas de paiement déjà effectué, nous vous remercions de ne pas tenir compte de ce rappel.</p>
""",
            "footer": "Restant à votre disposition pour tout renseignement, nous vous adressons nos cordiales salutations.",
        },
        2: {
            "titre": "Mise en demeure — Loyer impayé",
            "objet": f"Mise en demeure — Loyer {periode} — CO art. 102",
            "ton": "ferme",
            "corps": f"""
<p>Malgré notre rappel, nous constatons que le loyer du mois de <strong>{periode}</strong>,
d'un montant de <strong>CHF {montant}</strong>, demeure impayé à ce jour.</p>

<p>Conformément à l'art. 102 du Code des obligations (CO), nous vous mettons formellement en demeure de
nous verser la somme de <strong>CHF {montant}</strong> dans un délai de <strong>10 jours</strong> à
compter de la réception du présent courrier.</p>

<p>Passé ce délai, nous nous réservons le droit d'introduire une procédure de poursuite selon la
Loi fédérale sur la poursuite pour dettes et la faillite (LP), ainsi que toute autre voie de droit
à notre disposition.</p>

<p><strong>IBAN pour le paiement :</strong> {agency.get('iban', '…')}<br>
<strong>Référence :</strong> {contract.get('reference', '…')}</p>
""",
            "footer": "Veuillez agir sans délai afin d'éviter des frais supplémentaires.",
        },
        3: {
            "titre": "Résiliation du bail pour défaut de paiement",
            "objet": f"Résiliation — CO art. 257d — Loyer {periode} impayé",
            "ton": "juridique",
            "corps": f"""
<p>En application de l'art. 257d du Code des obligations (CO), nous vous notifions par le présent courrier
la résiliation de votre bail pour défaut de paiement du loyer.</p>

<p><strong>Arriéré constaté :</strong> CHF {montant} (loyer {periode})</p>
<p><strong>Délai de paiement accordé :</strong> 30 jours dès réception du présent avis</p>
<p><strong>Date d'effet de la résiliation :</strong> à l'expiration du délai si le paiement n'est pas intervenu</p>

<p>Si le montant de <strong>CHF {montant}</strong> est intégralement versé sur notre compte (IBAN : {agency.get('iban', '…')})
dans le délai imparti, la présente résiliation sera annulée.</p>

<p>À défaut, vous serez tenu de libérer les locaux à la date d'effet de la résiliation. Le cas échéant,
nous engagerons la procédure d'expulsion devant les autorités compétentes.</p>

<p><em>Ce courrier est adressé en recommandé avec accusé de réception, conformément à l'art. 257d al. 1 CO.</em></p>
""",
            "footer": "Nous vous invitons à régulariser votre situation dans les plus brefs délais.",
        },
    }

    cfg = NIVEAUX.get(niveau, NIVEAUX[1])
    badge_color = {1: "#2E7D32", 2: "#E65100", 3: "#B71C1C"}[niveau]
    badge_label = {1: "Niveau 1 — Rappel amiable", 2: "Niveau 2 — Mise en demeure", 3: "Niveau 3 — Résiliation CO 257d"}[niveau]

    return f"""
<div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
  <span style="background:{badge_color};color:#fff;padding:3px 10px;border-radius:4px;font-size:11px;font-weight:700;">
    {badge_label}
  </span>
</div>

<div style="text-align:right;margin-bottom:16px;">
  <p style="margin:0;font-size:12px;">{agency['name']}</p>
  <p style="margin:0;font-size:12px;">{agency['address']}, {agency['city']}</p>
  <p style="margin:0;font-size:12px;">{today}</p>
</div>

<div style="margin-bottom:16px;">
  <p style="margin:2px 0;"><strong>{tenant.get('full_name','…')}</strong></p>
  <p style="margin:2px 0;font-size:12px;">{tenant.get('address','')}, {tenant.get('zip','')} {tenant.get('city','')}</p>
</div>

<p style="font-weight:700;text-decoration:underline;margin-bottom:16px;">Objet : {cfg['objet']}</p>

<p>Madame, Monsieur,</p>

{cfg['corps']}

<p>{cfg['footer']}</p>

<p style="margin-top:24px;">Nous vous prions de recevoir, Madame, Monsieur, nos salutations les meilleures.</p>

<div style="margin-top:32px;">
  <p><strong>{agency['name']}</strong></p>
  <p style="margin-top:20px;">__________________________<br>Signature</p>
</div>
"""


def _build_dossier_vendeur(ctx: dict) -> str:
    """Dossier de présentation vendeur (pour mise en vente d'un bien)."""
    agency = ctx["agency"]
    prop = ctx.get("property", {})
    contract = ctx.get("contract", {})
    today = ctx.get("today", "…")

    return f"""
<h1 style="font-size:22px;font-weight:700;color:#2c2c2c;border-bottom:3px solid #B55A30;padding-bottom:8px;">
  Dossier Vendeur
</h1>
<p style="color:#888;font-size:12px;margin-top:0;">Préparé par {agency['name']} · {today}</p>

<h2>Le bien</h2>
<table class="info">
  <tr><td>Adresse</td><td><strong>{prop.get('address','…')}, {prop.get('zip','')} {prop.get('city','')}</strong></td></tr>
  <tr><td>Type</td><td>{prop.get('type','…')}</td></tr>
  <tr><td>Surface habitable</td><td>{prop.get('surface','…')} m²</td></tr>
  <tr><td>Année de construction</td><td>{prop.get('year_built','…')}</td></tr>
  <tr><td>Nombre de pièces</td><td>{prop.get('rooms','…')}</td></tr>
  <tr><td>Étage</td><td>{prop.get('floor','…')}</td></tr>
</table>

<h2>Situation locative</h2>
<table class="info">
  <tr><td>Statut actuel</td><td>{prop.get('status','…')}</td></tr>
  <tr><td>Loyer mensuel</td><td>CHF {_fmt_chf(contract.get('monthly_rent'))}</td></tr>
  <tr><td>Rendement brut estimé</td><td>{contract.get('gross_yield','…')}</td></tr>
  <tr><td>Locataire actuel</td><td>{contract.get('tenant_name','…')}</td></tr>
  <tr><td>Bail échéance</td><td>{contract.get('end_date_long','…')}</td></tr>
</table>

<h2>Prix de vente</h2>
<table class="info">
  <tr><td>Prix demandé</td><td><strong>CHF {_fmt_chf(prop.get('sale_price'))}</strong></td></tr>
  <tr><td>Prix au m²</td><td>{prop.get('price_per_sqm','…')} CHF/m²</td></tr>
  <tr><td>Charges PPE</td><td>CHF {_fmt_chf(prop.get('ppe_charges'))}/mois</td></tr>
</table>

<h2>Documents disponibles</h2>
<ul>
  <li>Plans du bien</li>
  <li>Derniers procès-verbaux de l'assemblée PPE</li>
  <li>Attestation d'assurance bâtiment</li>
  <li>Bail en cours et quittances des 12 derniers mois</li>
  <li>Extraits du registre foncier</li>
  <li>Rapport d'état du bien (à commander)</li>
</ul>

<h2>Contact</h2>
<table class="info">
  <tr><td>Agence</td><td>{agency['name']}</td></tr>
  <tr><td>Adresse</td><td>{agency['address']}, {agency['city']}</td></tr>
  <tr><td>Téléphone</td><td>{agency.get('phone','…')}</td></tr>
  <tr><td>E-mail</td><td>{agency.get('email','…')}</td></tr>
</table>

<p style="margin-top:16px;font-size:11px;color:#888;font-style:italic;">
Données basées sur les informations transmises par le propriétaire.
L'agence décline toute responsabilité quant à l'exactitude des informations fournies par les tiers.
</p>
"""


# ─── Context builder ──────────────────────────────────────────────────────────

def _build_ctx(
    contract: Contract | None,
    bien: Bien | None,
    owner: User,
    tenant: User | None,
    agency_user: User | None,
    agency_settings: dict | None,
    extra: dict,
) -> dict:
    def _s(val: Any) -> str:
        return str(val) if val is not None else ""

    agency_info = {
        "name": agency_settings.get("agency_name") if agency_settings else (
            f"{agency_user.first_name} {agency_user.last_name}" if agency_user else "—"
        ),
        "address": agency_settings.get("address", "") if agency_settings else "",
        "city": agency_settings.get("city", "") if agency_settings else "",
        "phone": agency_settings.get("phone", "") if agency_settings else _s(getattr(agency_user, "phone", "")),
        "email": agency_settings.get("notification_email", "") if agency_settings else _s(getattr(agency_user, "email", "")),
        "website": agency_settings.get("website", "althy.ch") if agency_settings else "althy.ch",
        "logo_url": agency_settings.get("logo_url") if agency_settings else None,
        "representative": agency_settings.get("representative_name", "") if agency_settings else "",
        "iban": getattr(agency_user, "iban", "") or "",
        "bic": getattr(agency_user, "bic", "") or "",
        "bank_name": getattr(agency_user, "bank_account_holder", "") or "",
        "legal_city": agency_settings.get("city", bien.ville if bien else "") if agency_settings else (bien.ville if bien else ""),
    }

    tenant_info: dict = {}
    if tenant:
        tenant_info = {
            "civility": "M." if (tenant.first_name or "").endswith("s") is False else "Mme",
            "full_name": f"{tenant.first_name or ''} {tenant.last_name or ''}".strip(),
            "email": tenant.email or "",
            "phone": tenant.phone or "",
            "address": "",
            "nationality": "",
            "dob": "",
        }
    if contract:
        if hasattr(contract, "tenant_address") and contract.tenant_address:
            tenant_info["address"] = contract.tenant_address
        if hasattr(contract, "tenant_nationality") and contract.tenant_nationality:
            tenant_info["nationality"] = contract.tenant_nationality

    tenant_info.update(extra.get("tenant_extra", {}))

    # Pattern adaptateur : on conserve les noms de clés historiques (address,
    # city, zip_code, monthly_rent, …) pour ne pas toucher les 300+ f-strings
    # des templates HTML. Les valeurs, elles, viennent du nouveau modèle Bien.
    # Les champs out-of-scope (saisonnier, vente, linen, tourist tax) sont
    # figés en defaults — voir SPRINT_LOG.md "Fonctionnalités retirées du scope Phase 1".
    prop_info: dict = {}
    if bien:
        prop_info = {
            # Localisation
            "address": bien.adresse,
            "city": bien.ville,
            "zip_code": bien.cp,
            "canton": bien.canton or "VS",
            # Surface et pièces
            "surface": bien.surface,
            "rooms": bien.rooms,
            "bedrooms": bien.bedrooms,
            "bathrooms": bien.bathrooms,
            "floor": bien.etage,
            "year_built": bien.annee_construction,
            # Présentation
            "description": bien.description_logement or bien.description_lieu or "",
            # Identité
            "building_name": bien.building_name or "",
            "unit_number": bien.unit_number or "",
            "reference_number": bien.reference_number or "",
            # Finances
            "monthly_rent": float(bien.loyer) if bien.loyer else 0.0,
            "charges": float(bien.charges) if bien.charges else 0.0,
            "deposit": float(bien.deposit) if bien.deposit else 0.0,
            # Équipements — adaptés aux nouvelles colonnes
            "is_furnished": bien.is_furnished,
            "has_parking": bool(bien.parking_type),
            "has_balcony": bien.has_balcony,
            "has_terrace": bien.has_terrace,
            "has_garden": bien.has_garden,
            "has_storage": bien.has_storage,
            "has_fireplace": bien.has_fireplace,
            "has_laundry": bien.has_laundry_private or bien.has_laundry_building,
            # Règles
            "pets_allowed": bien.pets_allowed,
            "smoking_allowed": bien.smoking_allowed,
            # Opérationnel
            "keys_count": bien.keys_count or 3,
            # Enums bruts + libellés FR
            "status": bien.statut,
            "type_label": {
                "appartement": "Appartement", "villa": "Villa", "studio": "Studio",
                "maison": "Maison", "commerce": "Local commercial", "bureau": "Bureau",
                "parking": "Parking", "garage": "Garage", "cave": "Cave", "autre": "Bien",
            }.get(bien.type, "Bien"),
            "status_label": {
                "vacant": "À Louer", "loue": "Loué", "en_travaux": "En travaux",
            }.get(bien.statut, "Disponible"),
            "cover_url": extra.get("cover_url"),
            # Champs out-of-scope Phase 1 (saisonnier, vente, linen) — defaults figés
            "linen_provided": False,
            "price_sale": None,
            "is_for_sale": False,
            "tourist_tax_amount": None,
            "nearby_landmarks": "",
            "prix_nuit_basse": None,
            "prix_nuit_haute": None,
        }

    contract_info: dict = {}
    if contract:
        contract_info = {
            "reference": contract.reference,
            "monthly_rent": float(contract.monthly_rent) if contract.monthly_rent else None,
            "charges": float(contract.charges) if contract.charges else None,
            "deposit": float(contract.deposit) if contract.deposit else None,
            "start_date_long": _fmt_date_long(contract.start_date),
            "end_date_long": _fmt_date_long(contract.end_date) if contract.end_date else "…",
            "is_furnished": getattr(contract, "is_furnished", False),
            "payment_day": getattr(contract, "payment_day", 5),
            "notice_period_months": getattr(contract, "notice_period_months", 3),
            "notice_deadline_date": getattr(contract, "notice_deadline_date", "") or "",
            "partial_period_days": getattr(contract, "partial_period_days", None),
            "partial_period_rent": float(contract.partial_period_rent) if getattr(contract, "partial_period_rent", None) else None,
            "partial_period_label": extra.get("partial_period_label", ""),
            "charges_label": extra.get("charges_label", "charges comprises"),
            "tourist_tax_amount": float(contract.tourist_tax_amount) if getattr(contract, "tourist_tax_amount", None) else None,
            "cleaning_fee_hourly": float(contract.cleaning_fee_hourly) if getattr(contract, "cleaning_fee_hourly", None) else 42,
            "linen_fee_included": getattr(contract, "linen_fee_included", False),
            "reminder_fee": float(contract.reminder_fee) if getattr(contract, "reminder_fee", None) else 35,
            "late_interest_rate": float(contract.late_interest_rate) if getattr(contract, "late_interest_rate", None) else 6,
            "mortgage_rate_ref": float(contract.mortgage_rate_ref) if getattr(contract, "mortgage_rate_ref", None) else None,
            "cpi_index_ref": float(contract.cpi_index_ref) if getattr(contract, "cpi_index_ref", None) else None,
            "deposit_type": getattr(contract, "deposit_type", "gocaution") or "gocaution",
            "deposit_payment_deadline_days": getattr(contract, "deposit_payment_deadline_days", 10),
            "early_termination_fee": float(contract.early_termination_fee) if getattr(contract, "early_termination_fee", None) else 270,
            "payment_communication": getattr(contract, "payment_communication", "") or "",
            "subletting_allowed": getattr(contract, "subletting_allowed", False),
            "animals_allowed": getattr(contract, "animals_allowed", False),
            "smoking_allowed": getattr(contract, "smoking_allowed", False),
            "is_for_sale": getattr(contract, "is_for_sale", False),
            "signed_at_city": getattr(contract, "signed_at_city", "") or (bien.ville if bien else ""),
            "signed_date": extra.get("signed_date", ""),
            "canton": getattr(contract, "canton", "VS") or "VS",
            "bank_name": getattr(contract, "bank_name", "") or "",
            "bank_iban": getattr(contract, "bank_iban", "") or "",
            "bank_bic": getattr(contract, "bank_bic", "") or "",
            "occupants_count": getattr(contract, "occupants_count", 1),
            "tenant_nationality": getattr(contract, "tenant_nationality", "") or "",
        }

    owner_info = {
        "full_name": f"{owner.first_name or ''} {owner.last_name or ''}".strip(),
        "email": owner.email or "",
        "phone": owner.phone or "",
        "iban": owner.iban or "",
        "bic": owner.bic or "",
        "bank_account_holder": owner.bank_account_holder or "",
        "address": extra.get("owner_address", ""),
        "bank_name": extra.get("owner_bank_name", ""),
    }

    return {
        "agency": agency_info,
        "tenant": tenant_info,
        "property": prop_info,
        "contract": contract_info,
        "owner": owner_info,
        "claims": extra.get("claims", []),
    }


# ─── Pydantic schemas ─────────────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    template_type: str
    contract_id: str | None = None
    bien_id: str | None = None
    profile: str = "annee"
    extra: dict = {}


class GeneratedDocRead(BaseModel):
    id: str
    template_type: str
    content_html: str
    status: str
    created_at: str
    model_config = {"from_attributes": True}


TEMPLATE_TYPES = [
    "bail_annee", "bail_annee_avec_vente", "bail_saison",
    "mandat_gestion", "fiche_bien",
    "demande_pieces_annee", "demande_pieces_saison", "demande_pieces_nuitee",
    "demande_pieces_societe", "demande_pieces_commercial",
    "requisition_poursuite",
    "quittance_loyer",
    "relance_1", "relance_2", "relance_3",
    "dossier_vendeur",
]


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.get("/types")
async def list_template_types() -> list[dict]:
    return [
        {"key": "bail_annee", "label": "Bail à l'année", "icon": "📄"},
        {"key": "bail_annee_avec_vente", "label": "Bail à l'année + clause vente", "icon": "🏷️"},
        {"key": "bail_saison", "label": "Bail saisonnier (meublé)", "icon": "❄️"},
        {"key": "mandat_gestion", "label": "Mandat de gestion locative", "icon": "🤝"},
        {"key": "fiche_bien", "label": "Fiche de présentation du bien", "icon": "🏠"},
        {"key": "demande_pieces_annee", "label": "Demande de pièces — Annuel (individuel)", "icon": "📋"},
        {"key": "demande_pieces_saison", "label": "Demande de pièces — Saisonnier", "icon": "📋"},
        {"key": "demande_pieces_nuitee", "label": "Demande de pièces — Nuitée", "icon": "📋"},
        {"key": "demande_pieces_societe", "label": "Demande de pièces — Société", "icon": "🏢"},
        {"key": "demande_pieces_commercial", "label": "Demande de pièces — Bail commercial", "icon": "🏪"},
        {"key": "requisition_poursuite", "label": "Réquisition de poursuite LP", "icon": "⚖️"},
        {"key": "quittance_loyer", "label": "Quittance de loyer", "icon": "🧾"},
        {"key": "relance_1", "label": "Lettre de relance — Niveau 1 (rappel amiable)", "icon": "📬"},
        {"key": "relance_2", "label": "Lettre de relance — Niveau 2 (mise en demeure CO 102)", "icon": "⚠️"},
        {"key": "relance_3", "label": "Lettre de relance — Niveau 3 (résiliation CO 257d)", "icon": "🔴"},
        {"key": "dossier_vendeur", "label": "Dossier de présentation vendeur", "icon": "🏷️"},
    ]


@router.post("/generate", status_code=status.HTTP_201_CREATED)
async def generate_document(
    payload: GenerateRequest,
    db: DbDep,
    current_user: AuthDep,
) -> dict:
    """Generate a document and store it. Returns the generated document with HTML."""

    # Load contract
    contract: Contract | None = None
    if payload.contract_id:
        res = await db.execute(select(Contract).where(Contract.id == uuid_lib.UUID(payload.contract_id)))
        contract = res.scalar_one_or_none()
        if not contract:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Contrat introuvable")

    # Load bien
    bien: Bien | None = None
    bien_id = payload.bien_id or (str(contract.bien_id) if contract else None)
    if bien_id:
        res = await db.execute(select(Bien).where(Bien.id == uuid_lib.UUID(bien_id)))
        bien = res.scalar_one_or_none()

    # Load tenant
    tenant: User | None = None
    if contract and contract.tenant_id:
        res = await db.execute(select(User).where(User.id == contract.tenant_id))
        tenant = res.scalar_one_or_none()

    # Load agency
    agency_user: User | None = None
    agency_id = contract.agency_id if contract else None
    if not agency_id and bien:
        agency_id = bien.agency_id
    if agency_id:
        res = await db.execute(select(User).where(User.id == agency_id))
        agency_user = res.scalar_one_or_none()

    # Determine owner
    owner = current_user
    if contract and contract.owner_id != current_user.id:
        res = await db.execute(select(User).where(User.id == contract.owner_id))
        found = res.scalar_one_or_none()
        if found:
            owner = found

    # Agency settings (try to load)
    agency_settings: dict | None = None
    try:
        from app.models.agency_settings import AgencySettings
        eff_agency_id = agency_id or (current_user.id if current_user.role == "agence" else None)
        if eff_agency_id:
            res = await db.execute(select(AgencySettings).where(AgencySettings.agency_id == eff_agency_id))
            settings_obj = res.scalar_one_or_none()
            if settings_obj:
                agency_settings = {
                    "agency_name": settings_obj.agency_name,
                    "notification_email": settings_obj.notification_email,
                    "logo_url": settings_obj.logo_url,
                    "representative_name": settings_obj.representative_name,
                    "address": settings_obj.address if hasattr(settings_obj, "address") else "",
                    "city": settings_obj.city if hasattr(settings_obj, "city") else "",
                    "phone": settings_obj.phone if hasattr(settings_obj, "phone") else "",
                    "website": settings_obj.website if hasattr(settings_obj, "website") else "althy.ch",
                }
    except Exception:
        pass

    # Load cover image URL for the bien
    extra_with_cover = dict(payload.extra)
    if bien:
        from app.models.bien import BienImage as _BienImg
        cover_res = await db.execute(
            select(_BienImg)
            .where(_BienImg.bien_id == bien.id, _BienImg.is_cover.is_(True))
            .limit(1)
        )
        cover_img = cover_res.scalar_one_or_none()
        if not cover_img:
            cover_res = await db.execute(
                select(_BienImg)
                .where(_BienImg.bien_id == bien.id)
                .order_by(_BienImg.order)
                .limit(1)
            )
            cover_img = cover_res.scalar_one_or_none()
        if cover_img:
            extra_with_cover["cover_url"] = cover_img.url

    ctx = _build_ctx(contract, bien, owner, tenant, agency_user, agency_settings, extra_with_cover)

    # Generate body HTML
    ttype = payload.template_type
    body_html: str

    if ttype == "bail_annee":
        body_html = _build_bail_annee(ctx, with_sale_clause=False)
    elif ttype == "bail_annee_avec_vente":
        body_html = _build_bail_annee(ctx, with_sale_clause=True)
    elif ttype == "bail_saison":
        body_html = _build_bail_saison(ctx)
    elif ttype == "mandat_gestion":
        body_html = _build_mandat_gestion(ctx)
    elif ttype == "fiche_bien":
        body_html = _build_fiche_bien(ctx)
    elif ttype.startswith("demande_pieces"):
        profile_map = {
            "demande_pieces_annee": "annee",
            "demande_pieces_saison": "saison",
            "demande_pieces_nuitee": "nuitee",
            "demande_pieces_societe": "societe",
            "demande_pieces_commercial": "commercial",
        }
        body_html = _build_demande_pieces(ctx, profile=profile_map.get(ttype, payload.profile))
    elif ttype == "requisition_poursuite":
        body_html = _build_requisition_poursuite(ctx)
    elif ttype == "quittance_loyer":
        ctx["extra"] = payload.extra
        body_html = _build_quittance(ctx)
    elif ttype in ("relance_1", "relance_2", "relance_3"):
        niveau = int(ttype[-1])
        ctx["montant"] = payload.extra.get("montant", "…")
        ctx["periode"] = payload.extra.get("periode", "…")
        body_html = _build_relance(ctx, niveau=niveau)
    elif ttype == "dossier_vendeur":
        ctx["property"]["sale_price"] = payload.extra.get("sale_price")
        ctx["property"]["price_per_sqm"] = payload.extra.get("price_per_sqm", "…")
        ctx["property"]["ppe_charges"] = payload.extra.get("ppe_charges")
        body_html = _build_dossier_vendeur(ctx)
    else:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Type de document inconnu: {ttype}")

    title_map = {
        "bail_annee": "Bail à l'année",
        "bail_annee_avec_vente": "Bail à l'année — bien en vente",
        "bail_saison": "Bail saisonnier",
        "mandat_gestion": "Mandat de gestion locative",
        "fiche_bien": "Fiche de présentation",
        "demande_pieces_annee": "Demande de pièces",
        "demande_pieces_saison": "Demande de pièces",
        "demande_pieces_nuitee": "Demande de pièces",
        "demande_pieces_societe": "Demande de pièces",
        "demande_pieces_commercial": "Demande de pièces",
        "requisition_poursuite": "Réquisition de poursuite",
        "relance_1": "Lettre de relance — Rappel amiable",
        "relance_2": "Lettre de relance — Mise en demeure",
        "relance_3": "Lettre de relance — Résiliation CO 257d",
        "dossier_vendeur": "Dossier vendeur",
    }

    full_html = _wrap_html(body_html, ctx["agency"], title_map.get(ttype, "Document"))

    # Save
    doc = GeneratedDocument(
        id=uuid_lib.uuid4(),
        template_type=ttype,
        contract_id=contract.id if contract else None,
        bien_id=bien.id if bien else None,
        owner_id=owner.id,
        agency_id=agency_id,
        generated_by_id=current_user.id,
        content_html=full_html,
        context_data={"extra": payload.extra},
        status="draft",
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    return {
        "id": str(doc.id),
        "template_type": doc.template_type,
        "content_html": doc.content_html,
        "status": doc.status,
        "created_at": doc.created_at.isoformat(),
    }


@router.get("/{doc_id}")
async def get_document(
    doc_id: str,
    db: DbDep,
    current_user: AuthDep,
) -> dict:
    res = await db.execute(select(GeneratedDocument).where(GeneratedDocument.id == uuid_lib.UUID(doc_id)))
    doc = res.scalar_one_or_none()
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document introuvable")
    if doc.owner_id != current_user.id and doc.generated_by_id != current_user.id and current_user.role != "super_admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Non autorisé")
    return {
        "id": str(doc.id),
        "template_type": doc.template_type,
        "content_html": doc.content_html,
        "status": doc.status,
        "created_at": doc.created_at.isoformat(),
    }


@router.get("/")
async def list_documents(
    db: DbDep,
    current_user: AuthDep,
    contract_id: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
) -> list[dict]:
    q = select(GeneratedDocument).where(
        (GeneratedDocument.owner_id == current_user.id) |
        (GeneratedDocument.generated_by_id == current_user.id)
    ).order_by(GeneratedDocument.created_at.desc()).limit(limit)

    if contract_id:
        q = q.where(GeneratedDocument.contract_id == uuid_lib.UUID(contract_id))

    res = await db.execute(q)
    docs = res.scalars().all()
    return [
        {"id": str(d.id), "template_type": d.template_type, "status": d.status, "created_at": d.created_at.isoformat()}
        for d in docs
    ]


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_document(doc_id: str, db: DbDep, current_user: AuthDep) -> None:
    res = await db.execute(select(GeneratedDocument).where(GeneratedDocument.id == uuid_lib.UUID(doc_id)))
    doc = res.scalar_one_or_none()
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document introuvable")
    if doc.generated_by_id != current_user.id and current_user.role != "super_admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Non autorisé")
    await db.delete(doc)
    await db.commit()
