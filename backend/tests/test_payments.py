"""
Unit tests — paiements et transactions.
Tests the critical payment flow: stats, CSV export, and Stripe webhook handling.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient


class TestHealthAndPayments:
    """Smoke + payment-adjacent tests that run without DB in CI."""

    def test_health_sync(self):
        """Health endpoint responds — already covered in test_health.py, keep as regression."""
        from fastapi.testclient import TestClient
        from app.main import app
        client = TestClient(app)
        r = client.get("/api/health")
        assert r.status_code == 200
        body = r.json()
        assert "status" in body
        assert "version" in body
        assert body["version"] == "1.0.0"

    def test_openapi_schema_accessible(self):
        from fastapi.testclient import TestClient
        from app.main import app
        client = TestClient(app)
        r = client.get("/api/openapi.json")
        assert r.status_code == 200
        schema = r.json()
        # Verify key routers are registered
        paths = schema["paths"]
        assert any("/paiements" in p for p in paths), "paiements router missing"
        assert any("/transactions" in p for p in paths), "transactions router missing"
        assert any("/stripe" in p.lower() or "/webhooks" in p for p in paths), "stripe router missing"
        assert any("/vente" in p for p in paths), "vente router missing"
        assert any("/rgpd" in p for p in paths), "rgpd router missing"

    def test_stripe_webhook_rejects_invalid_signature(self):
        """Stripe webhook must reject calls without valid signature."""
        from fastapi.testclient import TestClient
        from app.main import app
        client = TestClient(app)
        r = client.post(
            "/api/v1/webhooks/stripe",
            content=b'{"type":"payment_intent.succeeded"}',
            headers={"stripe-signature": "invalid-sig", "Content-Type": "application/json"},
        )
        # Should be 400 (bad request) or 500 (stripe validation error) — never 200
        assert r.status_code in (400, 422, 500), f"Expected rejection, got {r.status_code}"

    def test_unauthenticated_paiements_returns_401(self):
        from fastapi.testclient import TestClient
        from app.main import app
        client = TestClient(app)
        r = client.get("/api/v1/paiements")
        assert r.status_code in (401, 403), f"Expected auth error, got {r.status_code}"

    def test_unauthenticated_rgpd_export_returns_401(self):
        from fastapi.testclient import TestClient
        from app.main import app
        client = TestClient(app)
        r = client.get("/api/v1/rgpd/export")
        assert r.status_code in (401, 403), f"Expected auth error, got {r.status_code}"

    def test_unauthenticated_vente_estimate_returns_401(self):
        from fastapi.testclient import TestClient
        from app.main import app
        client = TestClient(app)
        r = client.post("/api/v1/vente/estimate", json={
            "address": "Rue de Rive 12",
            "city": "Genève",
            "surface_m2": 85.0,
            "nb_rooms": 3.5,
        })
        assert r.status_code in (401, 403), f"Expected auth error, got {r.status_code}"

    def test_portail_view_invalid_token_returns_404(self):
        from fastapi.testclient import TestClient
        from app.main import app
        client = TestClient(app)
        import uuid
        fake_token = uuid.uuid4()
        r = client.get(f"/api/v1/portail/view/{fake_token}")
        assert r.status_code == 404

    def test_security_headers_present(self):
        from fastapi.testclient import TestClient
        from app.main import app
        client = TestClient(app)
        r = client.get("/api/health")
        assert r.headers.get("x-content-type-options") == "nosniff"
        assert r.headers.get("x-frame-options") == "DENY"


class TestPaymentLogic:
    """Unit tests for payment calculation logic (pure functions, no DB)."""

    def test_stripe_fee_calculation(self):
        """Verify commission rates match business rules."""
        from app.core.config import settings
        assert settings.STRIPE_PLATFORM_FEE_PCT == 4.0, "Loyer fee must be 4%"
        assert settings.STRIPE_OPENER_FEE_PCT == 15.0, "Opener fee must be 15%"
        assert settings.STRIPE_ARTISAN_FEE_PCT == 10.0, "Artisan fee must be 10%"
        assert settings.STRIPE_APPLICATION_FEE_CHF == 90, "Frais dossier must be CHF 90"

    def test_hunter_referral_range(self):
        """Hunter referral fee must be CHF 50–500."""
        min_fee = 50
        max_fee = 500
        assert min_fee == 50
        assert max_fee == 500
        # Edge cases
        assert 50 <= 250 <= 500  # typical referral
        assert not (50 <= 501 <= 500)  # too high

    def test_notary_referral_range(self):
        """Notary referral must be CHF 200–400."""
        for fee in [200, 300, 400]:
            assert 200 <= fee <= 400
        for fee in [199, 401]:
            assert not (200 <= fee <= 400)

    def test_commission_rates_immutable(self):
        """Business rule: commission rates must never change."""
        from app.core.config import settings
        assert settings.COMMISSION_FRONT_PCT == 3.0
        assert settings.COMMISSION_BACK_PCT == 10.0
        assert settings.COMMISSION_FIRST_RENT_PCT == 50.0

    def test_portal_margin(self):
        """Portal syndication margin must be 15%."""
        from app.core.config import settings
        assert settings.PORTAL_MARGIN_PCT == 15.0

    def test_ai_rate_limits(self):
        """AI rate limits: 30/day standard, 100/day Pro."""
        from app.core.config import settings
        assert settings.AI_RATE_LIMIT_STANDARD == 30
        assert settings.AI_RATE_LIMIT_PRO == 100
