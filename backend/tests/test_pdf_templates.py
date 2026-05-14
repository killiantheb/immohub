"""Tests smoke PDF templates Sprint 10 (Lot 3).

Tests des helpers de formatage + smoke generation via mocked DB entities.
Les tests ne touchent PAS la DB réelle — les modèles sont construits en
mémoire avec attributs minimaux.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


# ── Helpers de formatage ─────────────────────────────────────────────────────


def test_fmt_chf_basic():
    from app.services._althy_pdf_base import fmt_chf

    assert fmt_chf(1200) == "CHF 1'200.00"
    assert fmt_chf(1234567.89) == "CHF 1'234'567.89"
    assert fmt_chf(None) == "—"
    assert fmt_chf(0) == "CHF 0.00"
    assert fmt_chf(Decimal("2400.50")) == "CHF 2'400.50"


def test_fmt_chf_without_currency():
    from app.services._althy_pdf_base import fmt_chf

    assert fmt_chf(1200, with_currency=False) == "1'200.00"


def test_fmt_date_basic():
    from app.services._althy_pdf_base import fmt_date

    d = date(2026, 6, 1)
    assert fmt_date(d) == "01.06.2026"
    assert fmt_date(None) == "—"
    assert fmt_date(datetime(2026, 6, 1, 12, 30)) == "01.06.2026"


def test_fmt_int():
    from app.services._althy_pdf_base import fmt_int

    assert fmt_int(3) == "3"
    assert fmt_int(None) == "—"
    assert fmt_int(None, fallback="N/A") == "N/A"


# ── Base PDF class smoke ─────────────────────────────────────────────────────


def test_althy_pdf_base_renders_minimal():
    """Smoke : AlthyPdfBase produit un PDF valide avec juste header+footer."""
    from app.services._althy_pdf_base import AlthyPdfBase

    pdf = AlthyPdfBase(title="Test", emit_disclaimer_ia=True)
    pdf.alias_nb_pages()
    pdf.add_page()
    pdf.big_title("Smoke test")
    pdf.section_title("Section 1")
    pdf.paragraph("Lorem ipsum dolor sit amet.")
    pdf.field_row("Champ", "Valeur")
    pdf.bullet_list(["Item 1", "Item 2"])
    pdf.disclaimer_ia()

    out = bytes(pdf.output())
    assert out.startswith(b"%PDF-")
    assert len(out) > 1000  # PDF non-trivial


# ── Bail PDF — smoke avec mocks ──────────────────────────────────────────────


def _mock_contract(template_type: str = "sunimmo_annee") -> MagicMock:
    c = MagicMock()
    c.id = uuid.uuid4()
    c.reference = "CTR-202601-ABCD1234"
    c.template_type = template_type
    c.start_date = datetime(2026, 6, 1)
    c.end_date = datetime(2027, 5, 31)
    c.monthly_rent = Decimal("2400.00")
    c.charges = Decimal("150.00")
    c.deposit = Decimal("7200.00")
    c.deposit_type = "gocaution"
    c.deposit_iban = None
    c.deposit_bank_name = None
    c.payment_day = 5
    c.bank_name = "BCV"
    c.bank_iban = "CH32 0076 7000 T546 0720 9"
    c.bank_bic = "BCVLCH2LXXX"
    c.payment_communication = "Location Test + nom"
    c.late_interest_rate = Decimal("6")
    c.reminder_fee = Decimal("35")
    c.cleaning_fee_hourly = Decimal("42")
    c.mortgage_rate_ref = Decimal("1.250")
    c.cpi_index_ref = Decimal("107.5")
    c.tourist_tax_amount = None
    c.subletting_allowed = False
    c.animals_allowed = False
    c.linen_fee_included = False
    c.tenant_nationality = "Suisse"
    c.occupants_count = 2
    c.signed_at_city = "Crans-Montana"
    c.canton = "VS"
    c.is_furnished = False
    c.conditions_particulieres = None
    c.reserve_hausse_motif = None
    c.reserve_hausse_montant = None
    c.bien_id = uuid.uuid4()
    c.tenant_id = uuid.uuid4()
    c.owner_id = uuid.uuid4()
    return c


def _mock_bien() -> MagicMock:
    b = MagicMock()
    b.adresse = "Rue du Grand-Place 10"
    b.cp = "3963"
    b.ville = "Crans-Montana"
    b.titre = "Logement N°29 Grand Place Ouest"
    b.type = "appartement"
    b.description = "1,5 pièces avec balcon"
    b.owner_id = uuid.uuid4()
    return b


def _mock_user(first="Marie", last="Dupont", email="marie@test.ch") -> MagicMock:
    u = MagicMock()
    u.id = uuid.uuid4()
    u.first_name = first
    u.last_name = last
    u.email = email
    u.phone = "+41791234567"
    u.adresse = "Rue de Test 5, 1003 Lausanne"
    u.role = "locataire"
    return u


@pytest.mark.asyncio
async def test_generate_bail_pdf_annee_smoke():
    """Smoke test PDF bail à l'année avec entities mockées."""
    from app.services import pdf_bail_service

    contract = _mock_contract("sunimmo_annee")
    bien = _mock_bien()
    tenant = _mock_user()
    locataire = MagicMock()
    locataire.cosignataires = []

    mock_db = AsyncMock()
    mock_db.get = AsyncMock(side_effect=lambda model, _id: {
        "Contract": contract,
        "Bien": bien,
        "User": tenant,
    }.get(model.__name__, None))

    # Patch AsyncSessionLocal pour retourner mock_db
    class _CM:
        async def __aenter__(self):
            return mock_db
        async def __aexit__(self, *a):
            return None

    with patch.object(pdf_bail_service, "AsyncSessionLocal", lambda: _CM()):
        mock_db.execute = AsyncMock()
        mock_db.execute.return_value.scalar_one_or_none = MagicMock(return_value=locataire)

        out = await pdf_bail_service.generate_bail_pdf(
            contract_id=contract.id,
            template_type="sunimmo_annee",
        )

    assert out.startswith(b"%PDF-")
    assert len(out) > 3000


@pytest.mark.asyncio
async def test_generate_bail_pdf_saison_smoke():
    """Smoke test bail saison (meublé) — variante avec taxe séjour."""
    from app.services import pdf_bail_service

    contract = _mock_contract("sunimmo_saison")
    contract.tourist_tax_amount = Decimal("63.00")
    contract.is_furnished = True
    bien = _mock_bien()
    tenant = _mock_user()
    locataire = MagicMock()
    locataire.cosignataires = []

    mock_db = AsyncMock()
    mock_db.get = AsyncMock(side_effect=lambda model, _id: {
        "Contract": contract, "Bien": bien, "User": tenant,
    }.get(model.__name__, None))

    class _CM:
        async def __aenter__(self): return mock_db
        async def __aexit__(self, *a): return None

    with patch.object(pdf_bail_service, "AsyncSessionLocal", lambda: _CM()):
        mock_db.execute = AsyncMock()
        mock_db.execute.return_value.scalar_one_or_none = MagicMock(return_value=locataire)

        out = await pdf_bail_service.generate_bail_pdf(
            contract_id=contract.id,
            template_type="sunimmo_saison",
        )

    assert out.startswith(b"%PDF-")
    assert b"Location" in out or len(out) > 3000


# ── Avenant PDF smoke ────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_generate_avenant_pdf_animaux_smoke():
    from app.services import pdf_avenant_service

    avenant = MagicMock()
    avenant.id = uuid.uuid4()
    avenant.reference = "AVT-202601-X"
    avenant.contract_id = uuid.uuid4()
    avenant.avenant_type = "animaux"
    avenant.objet = "Autorisation chien"
    avenant.body_text = None
    avenant.effective_date = date(2026, 7, 1)
    avenant.data = {"animal_type": "un chien Berger Australien"}

    contract = _mock_contract()
    contract.id = avenant.contract_id
    bien = _mock_bien()
    tenant = _mock_user()

    mock_db = AsyncMock()
    mock_db.get = AsyncMock(side_effect=lambda model, _id: {
        "Avenant": avenant, "Contract": contract, "Bien": bien, "User": tenant,
    }.get(model.__name__, None))

    class _CM:
        async def __aenter__(self): return mock_db
        async def __aexit__(self, *a): return None

    with patch.object(pdf_avenant_service, "AsyncSessionLocal", lambda: _CM()):
        out = await pdf_avenant_service.generate_avenant_pdf(avenant.id)

    assert out.startswith(b"%PDF-")
    assert len(out) > 2000


# ── Résiliation PDF smoke ────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_generate_resiliation_pdf_with_co_266l_warning():
    """Si initiateur=bailleur ET bail non-meublé → warning CO 266l visible."""
    from app.services import pdf_resiliation_service

    resiliation = MagicMock()
    resiliation.id = uuid.uuid4()
    resiliation.reference = "RES-202601-X"
    resiliation.contract_id = uuid.uuid4()
    resiliation.initiateur = "bailleur"
    resiliation.motif = "Non-paiement du loyer"
    resiliation.date_resiliation = date(2026, 9, 30)
    resiliation.date_envoi = date(2026, 6, 30)
    resiliation.respect_preavis = True
    resiliation.preavis_months = 3

    contract = _mock_contract()
    contract.id = resiliation.contract_id
    contract.is_furnished = False  # → warning expected
    bien = _mock_bien()
    tenant = _mock_user()
    owner = _mock_user(first="Jean", last="Bailleur", email="owner@test.ch")
    owner.role = "proprio_solo"

    mock_db = AsyncMock()

    def _get(model, _id):
        m = model.__name__
        if m == "Resiliation":
            return resiliation
        if m == "Contract":
            return contract
        if m == "Bien":
            return bien
        if m == "User":
            return tenant if _id == contract.tenant_id else owner
        return None

    mock_db.get = AsyncMock(side_effect=_get)

    class _CM:
        async def __aenter__(self): return mock_db
        async def __aexit__(self, *a): return None

    with patch.object(pdf_resiliation_service, "AsyncSessionLocal", lambda: _CM()):
        out = await pdf_resiliation_service.generate_resiliation_pdf(resiliation.id)

    assert out.startswith(b"%PDF-")
    assert len(out) > 2000


# ── Mandat PDF smoke ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_generate_mandat_pdf_smoke():
    from app.services import pdf_mandat_service

    mandat = MagicMock()
    mandat.id = uuid.uuid4()
    mandat.reference = "MDT-202601-X"
    mandat.mandant_id = uuid.uuid4()
    mandat.agence_id = uuid.uuid4()
    mandat.bien_id = uuid.uuid4()
    mandat.commission_pct_annee = Decimal("10.00")
    mandat.commission_pct_saison = Decimal("15.00")
    mandat.commission_pct_semaine = Decimal("20.00")
    mandat.start_date = date(2026, 6, 1)
    mandat.end_date = None
    mandat.notice_period_months = 3
    mandat.notice_deadline_month_day = "10-01"
    mandat.for_juridique = "Sierre"
    mandat.notes = None

    mandant = _mock_user(first="Killian", last="Thebaud", email="k@test.ch")
    agence = _mock_user(first="Cathy", last="Moser", email="cathy@sunimmo.ch")
    bien = _mock_bien()

    mock_db = AsyncMock()

    def _get(model, _id):
        m = model.__name__
        if m == "MandatGestion":
            return mandat
        if m == "User":
            return mandant if _id == mandat.mandant_id else agence
        if m == "Bien":
            return bien
        return None

    mock_db.get = AsyncMock(side_effect=_get)

    class _CM:
        async def __aenter__(self): return mock_db
        async def __aexit__(self, *a): return None

    with patch.object(pdf_mandat_service, "AsyncSessionLocal", lambda: _CM()):
        out = await pdf_mandat_service.generate_mandat_pdf(mandat.id)

    assert out.startswith(b"%PDF-")
    assert len(out) > 4000  # mandat est plus volumineux (4 pages)
