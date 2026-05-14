"""Tests unitaires SkribbleClient + helpers (Sprint 10 Lot 2).

Pattern : mock httpx via httpx.MockTransport pour ne pas appeler Skribble réel.
"""

from __future__ import annotations

import hashlib
import hmac
from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import httpx
import pytest
from app.services.skribble_service import (
    SkribbleAPIError,
    SkribbleClient,
    SkribbleClientError,
    SkribbleSigner,
    verify_webhook_signature,
)


# ── Fixtures ─────────────────────────────────────────────────────────────────


def _signer() -> SkribbleSigner:
    return SkribbleSigner(
        email_address="test@example.ch",
        first_name="Killian",
        last_name="Thebaud",
        language="fr",
        mobile_number="+41791234567",
    )


def _mock_settings(**overrides):
    """Patch app.core.config.settings with Skribble values."""
    defaults = {
        "SKRIBBLE_API_URL": "https://api.skribble.com/v2",
        "SKRIBBLE_USERNAME": "test-user",
        "SKRIBBLE_API_KEY": "test-key",
        "SKRIBBLE_WEBHOOK_SECRET": "test-webhook-secret",
        "SKRIBBLE_ENVIRONMENT": "sandbox",
        "SKRIBBLE_DEFAULT_QUALITY": "SES",
        "SKRIBBLE_ENABLED": True,
    }
    defaults.update(overrides)
    return defaults


# ── HMAC webhook verification ────────────────────────────────────────────────


def test_verify_webhook_signature_valid(monkeypatch):
    secret = "my-secret-key"
    monkeypatch.setattr(
        "app.services.skribble_service.settings.SKRIBBLE_WEBHOOK_SECRET", secret
    )
    body = b'{"event_type":"signature_request.completed","request_id":"abc"}'
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    assert verify_webhook_signature(body, expected) is True


def test_verify_webhook_signature_invalid(monkeypatch):
    """SECURITY : signature falsifiée → False."""
    monkeypatch.setattr(
        "app.services.skribble_service.settings.SKRIBBLE_WEBHOOK_SECRET",
        "my-secret-key",
    )
    body = b'{"evil":"payload"}'
    bad_sig = "deadbeef" * 8
    assert verify_webhook_signature(body, bad_sig) is False


def test_verify_webhook_signature_empty_secret_refuses(monkeypatch):
    """Si SKRIBBLE_WEBHOOK_SECRET vide → refuse même un HMAC valide."""
    monkeypatch.setattr(
        "app.services.skribble_service.settings.SKRIBBLE_WEBHOOK_SECRET", ""
    )
    body = b"any"
    fake_sig = hmac.new(b"", body, hashlib.sha256).hexdigest()
    assert verify_webhook_signature(body, fake_sig) is False


def test_verify_webhook_signature_empty_header(monkeypatch):
    monkeypatch.setattr(
        "app.services.skribble_service.settings.SKRIBBLE_WEBHOOK_SECRET", "secret"
    )
    assert verify_webhook_signature(b"body", "") is False


# ── SkribbleClient — validation config ───────────────────────────────────────


def test_skribble_client_refuses_sandbox_in_prod(monkeypatch):
    """§B.10 : si env=production mais clé contient 'sandbox' → refus boot."""
    monkeypatch.setattr(
        "app.services.skribble_service.settings.SKRIBBLE_ENVIRONMENT", "production"
    )
    monkeypatch.setattr(
        "app.services.skribble_service.settings.SKRIBBLE_API_KEY",
        "live-key-sandbox-mode-x",
    )
    monkeypatch.setattr(
        "app.services.skribble_service.settings.SKRIBBLE_API_URL",
        "https://api.skribble.com/v2",
    )
    monkeypatch.setattr(
        "app.services.skribble_service.settings.SKRIBBLE_USERNAME", "test"
    )
    with pytest.raises(SkribbleClientError, match="incohérente"):
        SkribbleClient()


# ── SkribbleClient — authenticate cache ──────────────────────────────────────


@pytest.mark.asyncio
async def test_authenticate_caches_token(monkeypatch):
    """Deuxième appel à authenticate() dans la fenêtre 1h → pas de POST."""
    for k, v in _mock_settings().items():
        monkeypatch.setattr(f"app.services.skribble_service.settings.{k}", v)

    client = SkribbleClient()
    call_count = {"n": 0}

    async def handler(request: httpx.Request) -> httpx.Response:
        if "/access/login" in str(request.url):
            call_count["n"] += 1
            return httpx.Response(200, text='"jwt-token-abc"')
        return httpx.Response(404)

    client._http = httpx.AsyncClient(transport=httpx.MockTransport(handler))

    token1 = await client.authenticate()
    token2 = await client.authenticate()

    assert token1 == "jwt-token-abc"
    assert token2 == "jwt-token-abc"
    assert call_count["n"] == 1  # cache hit sur le 2e


# ── SkribbleClient — create_signature_request ────────────────────────────────


@pytest.mark.asyncio
async def test_create_signature_request_signers_empty_raises(monkeypatch):
    for k, v in _mock_settings().items():
        monkeypatch.setattr(f"app.services.skribble_service.settings.{k}", v)
    client = SkribbleClient()
    with pytest.raises(SkribbleClientError, match="signers cannot be empty"):
        await client.create_signature_request(
            document_pdf_bytes=b"%PDF-1.4",
            document_filename="t.pdf",
            title="t",
            signers=[],
            callback_success_url="https://x",
            callback_error_url="https://x",
            webhook_url="https://x",
        )


@pytest.mark.asyncio
async def test_create_signature_request_invalid_quality(monkeypatch):
    for k, v in _mock_settings().items():
        monkeypatch.setattr(f"app.services.skribble_service.settings.{k}", v)
    client = SkribbleClient()
    with pytest.raises(SkribbleClientError, match="quality invalide"):
        await client.create_signature_request(
            document_pdf_bytes=b"%PDF",
            document_filename="t.pdf",
            title="t",
            signers=[_signer()],
            quality="INVALID",  # type: ignore[arg-type]
            callback_success_url="https://x",
            callback_error_url="https://x",
            webhook_url="https://x",
        )


@pytest.mark.asyncio
async def test_create_signature_request_success(monkeypatch):
    for k, v in _mock_settings().items():
        monkeypatch.setattr(f"app.services.skribble_service.settings.{k}", v)

    seen_payload = {}

    async def handler(request: httpx.Request) -> httpx.Response:
        if "/access/login" in str(request.url):
            return httpx.Response(200, text='"tok"')
        if "/signature-requests" in str(request.url) and request.method == "POST":
            import json as _json

            seen_payload.update(_json.loads(request.content))
            return httpx.Response(
                201,
                json={"id": "sk-session-123", "signing_url": "https://signing.example"},
            )
        return httpx.Response(404)

    client = SkribbleClient()
    client._http = httpx.AsyncClient(transport=httpx.MockTransport(handler))

    resp = await client.create_signature_request(
        document_pdf_bytes=b"%PDF-1.4",
        document_filename="bail.pdf",
        title="Bail Test",
        signers=[_signer()],
        callback_success_url="https://althy.ch/ok",
        callback_error_url="https://althy.ch/err",
        webhook_url="https://althy.ch/api/v1/webhooks/skribble",
    )

    assert resp["id"] == "sk-session-123"
    assert seen_payload["title"] == "Bail Test"
    assert seen_payload["quality"] == "SES"
    assert seen_payload["legislation"] == "ZERTES"
    assert len(seen_payload["signatures"]) == 1
    assert seen_payload["signatures"][0]["account_email"] == "test@example.ch"


@pytest.mark.asyncio
async def test_create_signature_request_5xx_raises(monkeypatch):
    """§B.10 : Skribble 5xx → SkribbleAPIError, pas de silence."""
    for k, v in _mock_settings().items():
        monkeypatch.setattr(f"app.services.skribble_service.settings.{k}", v)

    async def handler(request: httpx.Request) -> httpx.Response:
        if "/access/login" in str(request.url):
            return httpx.Response(200, text='"tok"')
        return httpx.Response(503, text="Service unavailable")

    client = SkribbleClient()
    client._http = httpx.AsyncClient(transport=httpx.MockTransport(handler))

    with pytest.raises(SkribbleAPIError) as exc_info:
        await client.create_signature_request(
            document_pdf_bytes=b"%PDF",
            document_filename="t.pdf",
            title="t",
            signers=[_signer()],
            callback_success_url="https://x",
            callback_error_url="https://x",
            webhook_url="https://x",
        )
    assert exc_info.value.status_code == 503
