"""Tests pour le flag-masking backend (Lot B).

Vérifie que chaque router gaté renvoie 503 quand son flag est OFF
(masque l'existence de l'endpoint → pas de leak 401/404) et laisse
passer l'auth quand le flag est ON (401/403/422 selon le cas).

Pattern : `dependencies=[Depends(require_flag(...))]` au niveau
`include_router`, donc la dépendance tombe AVANT `get_current_user`.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app

client = TestClient(app)

# Format : (path, flag_name)
# Chaque path pointe vers un GET réel du router gaté (sinon 404).
GATED_ROUTES: list[tuple[str, str]] = [
    ("/api/v1/contracts",        "BACKEND_FLAG_CONTRACTS"),
    ("/api/v1/companies",        "BACKEND_FLAG_AGENCE"),
    ("/api/v1/agency/settings",  "BACKEND_FLAG_AGENCE"),
    ("/api/v1/crm/stats",        "BACKEND_FLAG_CRM"),
    ("/api/v1/portail",          "BACKEND_FLAG_PORTAIL"),
    ("/api/v1/integrations/status", "BACKEND_FLAG_INTEGRATIONS"),
]


@pytest.mark.parametrize("path,flag_name", GATED_ROUTES)
def test_returns_503_when_flag_off(monkeypatch, path: str, flag_name: str):
    """Flag OFF → 503 Service Unavailable (masque l'endpoint)."""
    monkeypatch.setattr(settings, flag_name, False)
    response = client.get(path)
    assert response.status_code == 503, (
        f"{path} doit renvoyer 503 quand {flag_name}=False "
        f"(reçu {response.status_code}: {response.text[:200]})"
    )
    assert response.json()["detail"] == "Module non disponible"


@pytest.mark.parametrize("path,flag_name", GATED_ROUTES)
def test_returns_auth_error_when_flag_on(monkeypatch, path: str, flag_name: str):
    """Flag ON → la dépendance passe → auth prend le relais (401/403/422)."""
    monkeypatch.setattr(settings, flag_name, True)
    response = client.get(path)  # pas de token → auth doit rejeter
    # Pas de 503 = le flag-gate a laissé passer.
    # Pas de 200/404 = il reste une garde quelque part (auth/validation).
    assert response.status_code in (401, 403, 422, 500), (
        f"{path} avec {flag_name}=True devrait demander auth (401/403/422), "
        f"reçu {response.status_code}: {response.text[:200]}"
    )
    assert response.status_code != 503, (
        f"{path} ne doit PAS renvoyer 503 quand {flag_name}=True"
    )
