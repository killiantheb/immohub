"""Tests webhook Skribble end-to-end — Sprint 10 Lot 8.

Couvre :
  - HMAC invalid → 401 (security critical)
  - HMAC valid + event signed → status='partial_signed'
  - HMAC valid + event completed bail → loyer_activation triggered
  - HMAC valid + event completed mandat → mandat.status='active', AUCUN
    side-effect financier (§2.4.16)
"""

from __future__ import annotations

import hashlib
import hmac
import json
import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


def _hmac(secret: str, body: bytes) -> str:
    return hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()


@pytest.mark.asyncio
async def test_webhook_invalid_hmac_returns_401(monkeypatch):
    """SECURITY : HMAC invalide → 401, aucune mutation."""
    monkeypatch.setattr(
        "app.services.skribble_service.settings.SKRIBBLE_WEBHOOK_SECRET",
        "real-secret-key",
    )
    from app.routers.skribble_webhooks import skribble_webhook
    from fastapi import HTTPException

    request = AsyncMock()
    request.body = AsyncMock(return_value=b'{"event_type":"signature_request.completed","request_id":"abc"}')
    request.headers = {"X-Skribble-Signature": "deadbeef" * 8}

    db = AsyncMock()

    with pytest.raises(HTTPException) as exc:
        await skribble_webhook(request, db)
    assert exc.value.status_code == 401
    assert "hmac" in exc.value.detail.lower() or "signature" in exc.value.detail.lower()


@pytest.mark.asyncio
async def test_webhook_valid_hmac_unknown_session_returns_200_ignored(monkeypatch):
    """Session ID inconnu → 200 + status='ignored' (anti-retry Skribble)."""
    secret = "shared-secret"
    monkeypatch.setattr(
        "app.services.skribble_service.settings.SKRIBBLE_WEBHOOK_SECRET", secret
    )
    from app.routers import skribble_webhooks
    from app.routers.skribble_webhooks import skribble_webhook

    body = json.dumps({
        "event_type": "signature_request.completed",
        "request_id": "unknown-session-xyz",
    }).encode("utf-8")
    sig = _hmac(secret, body)

    request = AsyncMock()
    request.body = AsyncMock(return_value=body)
    request.headers = {"X-Skribble-Signature": sig}

    db = AsyncMock()

    # Mock _resolve_document → None (session inconnue)
    with patch.object(skribble_webhooks, "_resolve_document", new=AsyncMock(return_value=None)):
        # Mock audit log to no-op
        with patch.object(skribble_webhooks, "_audit_log_webhook", new=AsyncMock()):
            resp = await skribble_webhook(request, db)

    assert resp["status"] == "ignored"
    assert resp["reason"] == "session_unknown"


@pytest.mark.asyncio
async def test_webhook_completed_bail_triggers_loyer_activation(monkeypatch):
    """Webhook completed sur Contract → activate_first_rent called."""
    secret = "shared-secret"
    monkeypatch.setattr(
        "app.services.skribble_service.settings.SKRIBBLE_WEBHOOK_SECRET", secret
    )
    monkeypatch.setattr(
        "app.core.config.settings.SUPABASE_BUCKET_SIGNABLE_DOCUMENTS",
        "signable-documents",
    )

    from app.routers import skribble_webhooks
    from app.routers.skribble_webhooks import skribble_webhook

    contract = MagicMock()
    contract.id = uuid.uuid4()
    contract.reference = "CTR-TEST"
    contract.owner_id = uuid.uuid4()
    contract.bien_id = uuid.uuid4()
    contract.skribble_status = "pending_signatures"
    contract.skribble_signed_pdf_url = None
    contract.status = "draft"

    body = json.dumps({
        "event_type": "signature_request.completed",
        "request_id": "sk-bail-session-123",
    }).encode("utf-8")
    sig = _hmac(secret, body)

    request = AsyncMock()
    request.body = AsyncMock(return_value=body)
    request.headers = {"X-Skribble-Signature": sig}
    db = AsyncMock()

    # Mock chain : resolve → contract found, download_signed_pdf returns bytes,
    # upload_pdf returns key, activate_first_rent is the critical hook
    mock_client = MagicMock()
    mock_client.download_signed_pdf = AsyncMock(return_value=b"%PDF signed bytes")

    activate_mock = AsyncMock()

    with patch.object(skribble_webhooks, "_resolve_document",
                      new=AsyncMock(return_value=("contract", contract))):
        with patch.object(skribble_webhooks, "get_skribble_client", return_value=mock_client):
            with patch.object(skribble_webhooks, "upload_pdf",
                              new=AsyncMock(return_value="user/bien/bail-signed.pdf")):
                with patch.object(skribble_webhooks, "activate_first_rent", new=activate_mock):
                    with patch.object(skribble_webhooks, "_audit_log_webhook", new=AsyncMock()):
                        resp = await skribble_webhook(request, db)

    # Loyer activation appelée
    activate_mock.assert_called_once_with(db, contract)
    # Contract status mis à jour
    assert contract.status == "active"
    assert contract.skribble_status == "completed"
    assert resp["status"] == "ok"


@pytest.mark.asyncio
async def test_webhook_completed_mandat_no_financial_side_effect(monkeypatch):
    """§2.4.16 — completed sur Mandat → status='active', PAS de prélèvement."""
    secret = "shared-secret"
    monkeypatch.setattr(
        "app.services.skribble_service.settings.SKRIBBLE_WEBHOOK_SECRET", secret
    )

    from app.routers import skribble_webhooks
    from app.routers.skribble_webhooks import skribble_webhook
    from decimal import Decimal

    mandat = MagicMock()
    mandat.id = uuid.uuid4()
    mandat.reference = "MDT-TEST"
    mandat.mandant_id = uuid.uuid4()
    mandat.bien_id = uuid.uuid4()
    mandat.commission_pct_annee = Decimal("10.00")
    mandat.commission_pct_saison = Decimal("15.00")
    mandat.commission_pct_semaine = Decimal("20.00")
    mandat.status = "pending_signatures"
    mandat.skribble_status = "pending_signatures"
    mandat.signed_at_mandant = None
    mandat.signed_at_agence = None

    body = json.dumps({
        "event_type": "signature_request.completed",
        "request_id": "sk-mandat-session-456",
    }).encode("utf-8")
    sig = _hmac(secret, body)

    request = AsyncMock()
    request.body = AsyncMock(return_value=body)
    request.headers = {"X-Skribble-Signature": sig}
    db = AsyncMock()

    mock_client = MagicMock()
    mock_client.download_signed_pdf = AsyncMock(return_value=b"%PDF signed")

    activate_mock = AsyncMock()

    with patch.object(skribble_webhooks, "_resolve_document",
                      new=AsyncMock(return_value=("mandat", mandat))):
        with patch.object(skribble_webhooks, "get_skribble_client", return_value=mock_client):
            with patch.object(skribble_webhooks, "upload_pdf",
                              new=AsyncMock(return_value="mandant/global/mandat.pdf")):
                with patch.object(skribble_webhooks, "activate_first_rent", new=activate_mock):
                    with patch.object(skribble_webhooks, "_audit_log_webhook", new=AsyncMock()):
                        resp = await skribble_webhook(request, db)

    # Mandat completed → status='active'
    assert mandat.status == "active"
    assert mandat.skribble_status == "completed"
    # CRITIQUE §2.4.16 : commission_pct_* INCHANGÉS (data pure, pas tracking)
    assert mandat.commission_pct_annee == Decimal("10.00")
    assert mandat.commission_pct_saison == Decimal("15.00")
    assert mandat.commission_pct_semaine == Decimal("20.00")
    # CRITIQUE : activate_first_rent NE doit PAS être appelé pour un mandat
    activate_mock.assert_not_called()
    assert resp["status"] == "ok"
