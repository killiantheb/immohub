"""Tests unitaires signature_orchestrator (Sprint 10 Lot 2).

Tests parcours nominaux + idempotence + RBAC clé.
"""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException
from app.services.signature_orchestrator import (
    send_contract_to_skribble,
    send_mandat_to_skribble,
)


@pytest.mark.asyncio
async def test_send_contract_skribble_disabled_returns_503(monkeypatch):
    """Si SKRIBBLE_ENABLED=False → 503 (Plan B fallback)."""
    monkeypatch.setattr(
        "app.services.signature_orchestrator.settings.SKRIBBLE_ENABLED", False
    )
    db = AsyncMock()
    with pytest.raises(HTTPException) as exc:
        await send_contract_to_skribble(db, uuid.uuid4())
    assert exc.value.status_code == 503
    assert "Skribble désactivé" in exc.value.detail


@pytest.mark.asyncio
async def test_send_contract_idempotent_when_session_exists(monkeypatch):
    """Si contract.skribble_session_id existe déjà → retourne session_id sans re-create."""
    monkeypatch.setattr(
        "app.services.signature_orchestrator.settings.SKRIBBLE_ENABLED", True
    )

    existing_contract = MagicMock()
    existing_contract.skribble_session_id = "existing-session-id"
    existing_contract.skribble_status = "pending_signatures"

    db = AsyncMock()
    db.get = AsyncMock(return_value=existing_contract)

    resp = await send_contract_to_skribble(db, uuid.uuid4())
    assert resp["id"] == "existing-session-id"
    assert resp.get("idempotent") is True


@pytest.mark.asyncio
async def test_send_contract_missing_tenant_or_agency_raises_409(monkeypatch):
    monkeypatch.setattr(
        "app.services.signature_orchestrator.settings.SKRIBBLE_ENABLED", True
    )

    contract = MagicMock()
    contract.skribble_session_id = None
    contract.tenant_id = None  # missing
    contract.agency_id = uuid.uuid4()
    db = AsyncMock()
    db.get = AsyncMock(return_value=contract)

    with pytest.raises(HTTPException) as exc:
        await send_contract_to_skribble(db, uuid.uuid4())
    assert exc.value.status_code == 409
    assert "tenant_id" in exc.value.detail


@pytest.mark.asyncio
async def test_send_mandat_idempotent_when_session_exists(monkeypatch):
    monkeypatch.setattr(
        "app.services.signature_orchestrator.settings.SKRIBBLE_ENABLED", True
    )

    existing_mandat = MagicMock()
    existing_mandat.skribble_session_id = "mandat-session-xyz"
    existing_mandat.skribble_status = "pending_signatures"

    db = AsyncMock()
    db.get = AsyncMock(return_value=existing_mandat)

    resp = await send_mandat_to_skribble(db, uuid.uuid4())
    assert resp["id"] == "mandat-session-xyz"
    assert resp.get("idempotent") is True
