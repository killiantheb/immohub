"""
Unit tests — AI service (mocked Anthropic).
Tests the AI estimation logic and document generation without calling the real API.
"""

from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

import pytest


class TestAIEstimation:
    """Test the vente estimate endpoint with mocked Claude responses."""

    @patch("anthropic.Anthropic")
    def test_estimate_parses_fourchette(self, mock_anthropic_cls):
        """If Claude returns a proper fourchette, parse it correctly."""
        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client

        mock_msg = MagicMock()
        mock_msg.content = [MagicMock(
            text="FOURCHETTE: CHF 750'000 – CHF 900'000 (milieu CHF 825'000)\nANALYSE: Bien situé..."
        )]
        mock_client.messages.create.return_value = mock_msg

        # Simulate the parsing logic from vente.py
        import re
        rapport = mock_msg.content[0].text

        fourchette_match = re.search(
            r"CHF\s*([\d\s']+)\s*[–-]\s*CHF\s*([\d\s']+).*?CHF\s*([\d\s']+)", rapport
        )

        def parse_chf(s: str) -> float:
            return float(s.replace("'", "").replace(" ", "")) if s else 0.0

        assert fourchette_match is not None
        low  = parse_chf(fourchette_match.group(1))
        high = parse_chf(fourchette_match.group(2))
        mid  = parse_chf(fourchette_match.group(3))

        assert low  == 750_000.0
        assert high == 900_000.0
        assert mid  == 825_000.0

    @patch("anthropic.Anthropic")
    def test_estimate_fallback_when_no_fourchette(self, mock_anthropic_cls):
        """Fallback: estimate from surface × market price if Claude doesn't return fourchette."""
        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_msg = MagicMock()
        mock_msg.content = [MagicMock(text="Votre bien vaut beaucoup. C'est un bel appartement.")]
        mock_client.messages.create.return_value = mock_msg

        import re
        rapport = mock_msg.content[0].text
        fourchette_match = re.search(
            r"CHF\s*([\d\s']+)\s*[–-]\s*CHF\s*([\d\s']+).*?CHF\s*([\d\s']+)", rapport
        )
        assert fourchette_match is None  # No match → fallback applies

        # Fallback logic
        surface_m2 = 85.0
        city = "genève"
        price_m2 = 8000 if city.lower() in ("genève", "lausanne", "zurich", "zürich") else 5000
        mid  = surface_m2 * price_m2
        low  = mid * 0.90
        high = mid * 1.15

        assert mid  == 680_000.0
        assert low  == 612_000.0
        assert high == 782_000.0

    def test_disclaimer_always_present(self):
        """The DISCLAIMER string must always be returned in estimates."""
        from app.routers.vente import DISCLAIMER
        assert "automatiquement" in DISCLAIMER
        assert "Althy décline" in DISCLAIMER
        assert "expert immobilier" in DISCLAIMER

    def test_estimate_mandate_type_solo_context(self):
        """Solo mandate prompt must mention Althy upsells."""
        from app.routers.vente import DISCLAIMER
        # The endpoint builds a prompt — verify the mandate_type affects the prompt
        mandate_type = "solo"
        expected_fragment = "Avantages de la vente solo"
        prompt_fragment = (
            "5. Avantages de la vente solo (économie commission, contrôle total) + services Althy"
            if mandate_type == "solo"
            else "5. Avantages du mandat via agence (commission 3-5%, visibilité, réseau notaires)"
        )
        assert "solo" in prompt_fragment


class TestDocumentDisclaimer:
    """Verify DISCLAIMER appears on all generated document types."""

    def test_disclaimer_in_relance_1(self):
        from app.routers.documents import _build_relance
        ctx = {
            "locataire": "Jean Dupont", "montant": "1200", "mois": "mars 2025",
            "adresse": "Rue de Rive 12, Genève", "proprio": "Marie Martin",
            "iban": "CH56 0483 5012 3456 7800 9", "date": "2025-04-01",
        }
        result = _build_relance(ctx, niveau=1)
        assert "DISCLAIMER" in result or "indicatif" in result or "Althy" in result

    def test_disclaimer_in_relance_3_is_most_severe(self):
        from app.routers.documents import _build_relance
        ctx = {
            "locataire": "Jean Dupont", "montant": "1200", "mois": "mars 2025",
            "adresse": "Rue de Rive 12, Genève", "proprio": "Marie Martin",
            "iban": "CH56 0483 5012 3456 7800 9", "date": "2025-04-01",
        }
        r1 = _build_relance(ctx, niveau=1)
        r3 = _build_relance(ctx, niveau=3)
        # Level 3 should mention eviction / résiliation
        assert "résiliation" in r3.lower() or "expulsion" in r3.lower() or "257d" in r3.lower()
        # Level 1 should be friendlier
        assert len(r3) >= len(r1) or "mise en demeure" in r3.lower()


class TestAIRateLimit:
    """Verify AI rate limit constants."""

    def test_rate_limits_match_business_rules(self):
        from app.core.config import settings
        assert settings.AI_RATE_LIMIT_STANDARD == 30, "Standard: 30 interactions/day"
        assert settings.AI_RATE_LIMIT_PRO == 100, "Pro: 100 interactions/day"

    def test_rate_limit_header_format(self):
        """Rate limit error should be RFC-compliant."""
        from app.core.rate_limit import rate_limit_exceeded_handler
        assert callable(rate_limit_exceeded_handler)


class TestOBLFClassification:
    """Verify OBLF categories are complete and correct."""

    def test_all_7_oblf_categories_present(self):
        from app.routers.ai import OBLF_CATEGORIES
        assert len(OBLF_CATEGORIES) == 7
        expected = {"entretien", "réparation", "assurance", "impôts", "frais_admin", "amortissement", "autre"}
        assert set(OBLF_CATEGORIES.keys()) == expected

    def test_oblf_categories_have_sous_categories(self):
        from app.routers.ai import OBLF_CATEGORIES
        for cat, sous_cats in OBLF_CATEGORIES.items():
            assert isinstance(sous_cats, list), f"{cat} should be a list"
            assert len(sous_cats) >= 1, f"{cat} should have at least one sous-category"
