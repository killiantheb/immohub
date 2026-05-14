"""Tests workflow approbation propriétaire — Sprint 10 Lot 8.

Couvre :
  - pre_validate_dossier : RBAC, idempotence, génération magic_link
  - approve_dossier : pose proprio_approbation_at + IP
  - deny_dossier : pose proprio_refus_at + reason
  - Sécurité : token invalide → 404, token expiré → 410
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


@pytest.mark.asyncio
async def test_pre_validate_dossier_rbac_strict(monkeypatch):
    """Seuls agence et super_admin peuvent pré-valider — proprio_solo refusé."""
    from app.routers.agences_dossiers import pre_validate_dossier
    from fastapi import HTTPException

    user = MagicMock()
    user.role = "proprio_solo"
    user.id = uuid.uuid4()

    db = AsyncMock()

    with pytest.raises(HTTPException) as exc:
        await pre_validate_dossier(uuid.uuid4(), user, db)
    assert exc.value.status_code == 403
    assert "agence" in exc.value.detail.lower()


@pytest.mark.asyncio
async def test_pre_validate_dossier_requires_renseignements_complets():
    """Pre-validate refuse si dossier incomplet."""
    from app.routers.agences_dossiers import pre_validate_dossier
    from fastapi import HTTPException

    user = MagicMock()
    user.role = "super_admin"
    user.id = uuid.uuid4()

    fake_row = MagicMock()
    fake_row.dossier_id = uuid.uuid4()
    fake_row.renseignements_complets = False  # bloquant
    fake_row.loyer_caution_verses = False
    fake_row.proprio_approbation_at = None
    fake_row.proprio_refus_at = None
    fake_row.locataire_id = uuid.uuid4()
    fake_row.candidate_user_id = uuid.uuid4()
    fake_row.bien_id = uuid.uuid4()
    fake_row.owner_id = uuid.uuid4()
    fake_row.agence_id = None

    db = AsyncMock()
    result_mock = MagicMock()
    result_mock.one_or_none = MagicMock(return_value=fake_row)
    db.execute = AsyncMock(return_value=result_mock)

    with pytest.raises(HTTPException) as exc:
        await pre_validate_dossier(fake_row.dossier_id, user, db)
    assert exc.value.status_code == 409
    assert "renseignements_complets" in exc.value.detail


@pytest.mark.asyncio
async def test_approve_dossier_invalid_token_returns_404():
    """Token magic_link inconnu → 404."""
    from app.routers.public_approbation import _resolve_magic_link
    from fastapi import HTTPException

    db = AsyncMock()
    result_mock = MagicMock()
    result_mock.one_or_none = MagicMock(return_value=None)
    db.execute = AsyncMock(return_value=result_mock)

    with pytest.raises(HTTPException) as exc:
        await _resolve_magic_link(db, "fake-invalid-token-not-in-db-xxxxxxxx")
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_approve_dossier_short_token_returns_404():
    """Token trop court (< 16 chars) → 404 immédiat (pas de DB hit)."""
    from app.routers.public_approbation import _resolve_magic_link
    from fastapi import HTTPException

    db = AsyncMock()

    with pytest.raises(HTTPException) as exc:
        await _resolve_magic_link(db, "short")
    assert exc.value.status_code == 404
    # DB ne doit pas avoir été appelée
    db.execute.assert_not_called()


@pytest.mark.asyncio
async def test_pre_validate_idempotent_returns_existing_link():
    """Si un magic_link non-expiré existe déjà pour ce dossier → retourne-le."""
    from app.routers.agences_dossiers import pre_validate_dossier

    user = MagicMock()
    user.role = "super_admin"
    user.id = uuid.uuid4()
    dossier_id = uuid.uuid4()

    fake_dossier_row = MagicMock()
    fake_dossier_row.dossier_id = dossier_id
    fake_dossier_row.renseignements_complets = True
    fake_dossier_row.loyer_caution_verses = True
    fake_dossier_row.proprio_approbation_at = None
    fake_dossier_row.proprio_refus_at = None
    fake_dossier_row.locataire_id = uuid.uuid4()
    fake_dossier_row.candidate_user_id = uuid.uuid4()
    fake_dossier_row.bien_id = uuid.uuid4()
    fake_dossier_row.owner_id = uuid.uuid4()
    fake_dossier_row.agence_id = None

    fake_owner_row = MagicMock()
    fake_owner_row.email = "owner@test.ch"
    fake_owner_row.first_name = "Jean"
    fake_owner_row.last_name = "Bailleur"

    fake_existing_link = MagicMock()
    fake_existing_link.id = uuid.uuid4()
    fake_existing_link.token = "existing-token-12345-very-long-xx"
    fake_existing_link.expires_at = datetime.now(UTC) + timedelta(days=10)

    db = AsyncMock()
    call_count = {"n": 0}

    def _exec_router(*args, **kwargs):
        call_count["n"] += 1
        r = MagicMock()
        if call_count["n"] == 1:
            # First call : dossier context lookup
            r.one_or_none = MagicMock(return_value=fake_dossier_row)
        elif call_count["n"] == 2:
            # owner email lookup
            r.one_or_none = MagicMock(return_value=fake_owner_row)
        elif call_count["n"] == 3:
            # Idempotence check — return existing
            r.one_or_none = MagicMock(return_value=fake_existing_link)
        else:
            r.one_or_none = MagicMock(return_value=None)
        return r

    db.execute = AsyncMock(side_effect=_exec_router)

    resp = await pre_validate_dossier(dossier_id, user, db)
    assert str(resp.magic_link_token) == fake_existing_link.token
    assert resp.email_sent is False  # idempotent — email pas re-envoyé
