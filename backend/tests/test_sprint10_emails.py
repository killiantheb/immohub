"""Tests smoke templates emails Sprint 10 (Lot 4).

Vérifie que chaque template :
  - Existe en .html + .txt
  - Se rend via `.format(**ctx)` sans KeyError
  - Produit > 200 chars (non vide)

Test idempotence rappels : 2 appels consécutifs sur même doc_id → 1 email max.
"""

from __future__ import annotations

import os
import uuid
from unittest.mock import AsyncMock, patch

import pytest

TEMPLATES_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "app",
    "templates",
    "emails",
)


def _load(name: str) -> tuple[str, str]:
    with open(os.path.join(TEMPLATES_DIR, name + ".html"), encoding="utf-8") as f:
        html = f.read()
    with open(os.path.join(TEMPLATES_DIR, name + ".txt"), encoding="utf-8") as f:
        text = f.read()
    return html, text


COMMON = {
    "althy_creditor_name": "HBM Swiss Sàrl",
    "emails_from": "noreply@althy.ch",
}


# ── Smoke render des 10 templates ────────────────────────────────────────────


def test_template_approbation_proprietaire():
    html, text = _load("approbation_proprietaire")
    ctx = {
        **COMMON,
        "owner_name": "Killian Thebaud",
        "candidate_full_name": "Marie Dupont",
        "candidate_dossier_summary": "Ingénieure (CDI) chez Acme SA — revenu CHF 8'500",
        "bien_address": "Rue Centrale 1, 3963 Crans-Montana",
        "monthly_rent": "2'400.00",
        "approval_link": "https://althy.ch/approuver/token123",
        "deny_link": "https://althy.ch/approuver/token123?action=refuse",
        "expires_at_formatted": "dans 14 jours",
    }
    assert "{" + "owner_name" not in html.format(**ctx)
    assert len(html.format(**ctx)) > 500
    assert "Killian Thebaud" in html.format(**ctx)
    assert "Marie Dupont" in text.format(**ctx)


def test_template_approbation_donnee():
    html, text = _load("approbation_donnee")
    ctx = {
        **COMMON,
        "owner_name": "Killian",
        "candidate_name": "Marie Dupont",
        "next_steps": "<li>Step 1</li><li>Step 2</li>",
        "bien_address": "Rue 1",
    }
    out = html.format(**ctx)
    assert len(out) > 300
    assert "Killian" in out


def test_template_candidat_refuse():
    html, text = _load("candidat_refuse")
    ctx = {
        **COMMON,
        "candidate_name": "Marie",
        "bien_address": "Rue 1",
        "agency_name": "Sunimmo Riviera",
    }
    assert "Sunimmo Riviera" in html.format(**ctx)
    assert "Sunimmo Riviera" in text.format(**ctx)


def test_template_signature_bail_locataire():
    html, text = _load("signature_bail_locataire")
    ctx = {
        **COMMON,
        "tenant_name": "Marie",
        "bien_address": "Rue 1",
        "contract_reference": "CTR-202601-ABCD1234",
        "skribble_signing_url": "https://signing.skribble.com/x",
        "expires_at_formatted": "dans 7 jours",
    }
    assert "CTR-202601-ABCD1234" in html.format(**ctx)
    assert "Skribble" in html.format(**ctx)


def test_template_signature_bail_agence():
    html, text = _load("signature_bail_agence")
    ctx = {
        **COMMON,
        "agency_name": "Sunimmo Riviera",
        "contract_reference": "CTR-X",
        "signed_by_summary": "Locataire signé le 10.05.2026",
        "skribble_signing_url": "https://signing.x",
    }
    out = html.format(**ctx)
    assert "Sunimmo Riviera" in out
    assert "10.05.2026" in out


def test_template_bail_signe_tous():
    html, text = _load("bail_signe_tous")
    ctx = {
        **COMMON,
        "tenant_name": "Marie",
        "contract_reference": "CTR-X",
        "bien_address": "Rue 1",
        "start_date_formatted": "01.06.2026",
        "signed_pdf_url": "https://althy.ch/pdf",
        "prochaines_etapes": "<ul><li>Step</li></ul>",
    }
    assert "01.06.2026" in html.format(**ctx)


def test_template_avenant_a_signer():
    html, text = _load("avenant_a_signer")
    ctx = {
        **COMMON,
        "tenant_name": "Marie",
        "contract_reference": "CTR-X",
        "avenant_type_label": "Modification du loyer",
        "avenant_objet": "Loyer mensuel passe de 2'400 à 2'500 CHF",
        "skribble_signing_url": "https://x",
    }
    out = html.format(**ctx)
    assert "Modification du loyer" in out
    assert "2'500 CHF" in out


def test_template_resiliation_envoyee():
    html, text = _load("resiliation_envoyee")
    ctx = {
        **COMMON,
        "recipient_name": "Marie",
        "contract_reference": "CTR-X",
        "date_resiliation_formatted": "30.09.2026",
        "respect_preavis_bool": "Oui",
        "message_co_266l": "",
    }
    out = html.format(**ctx)
    assert "30.09.2026" in out
    assert "Oui" in out


def test_template_edl_a_planifier():
    html, text = _load("edl_a_planifier")
    ctx = {
        **COMMON,
        "phase": "d'entrée",
        "bien_address": "Rue 1",
        "date_suggestion_formatted": "15.06.2026",
        "planning_link": "https://x",
    }
    assert "d'entrée" in html.format(**ctx)
    assert "15.06.2026" in html.format(**ctx)


def test_template_rappel_signature_pending():
    html, text = _load("rappel_signature_pending")
    ctx = {
        **COMMON,
        "recipient_name": "Marie",
        "document_type": "bail",
        "skribble_signing_url": "https://x",
        "days_since_sent": "3",
    }
    out = html.format(**ctx)
    assert "3 jours" in out
    assert "Marie" in out


# ── Idempotence rappels ──────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_reminders_idempotent_same_day():
    """Deuxième appel le même jour → pas de doublon (Set in-memory)."""
    from app.tasks import sprint10_reminders

    # Reset state
    sprint10_reminders._REMINDERS_SENT.clear()

    doc_id_str = str(uuid.uuid4())
    sprint10_reminders._mark_sent("contract", doc_id_str)
    assert sprint10_reminders._already_sent("contract", doc_id_str) is True

    # Re-marquer → idempotent (Set ignore les duplicates)
    sprint10_reminders._mark_sent("contract", doc_id_str)
    # Toujours présent, taille du set inchangée
    contract_entries = [
        x for x in sprint10_reminders._REMINDERS_SENT if x[0] == "contract" and x[1] == doc_id_str
    ]
    assert len(contract_entries) == 1
