"""Adaptateurs partenaires — un fichier par partenaire majeur.

Chaque adaptateur expose la même interface (PartnerAdapter) pour que le routeur
(partner_service.send_lead_to_partner) puisse dispatcher sans connaître
l'implémentation concrète.

ÉTAT ACTUEL : tous stubs. Aucune intégration live tant que les contrats ne sont
pas signés. Les stubs loggent + renvoient un external_reference fictif.
"""

from __future__ import annotations

from typing import Protocol


class PartnerAdapter(Protocol):
    """Interface commune à tous les adaptateurs partenaires."""

    vertical: str
    name: str

    async def send_lead(
        self,
        *,
        lead_id: str,
        user_payload: dict,
        api_base_url: str | None,
        api_key: str | None,
    ) -> dict:
        """Envoie un lead au partenaire.

        Retourne un dict avec au minimum :
          - accepted: bool
          - external_reference: str | None   (ID côté partenaire)
          - message: str                     (stub: "stub_mode"; live: message API)
        """
        ...


# Registre : vertical -> { nom_partenaire: adapter_instance }
# Peuplé par partner_service au chargement.
_REGISTRY: dict[str, dict[str, PartnerAdapter]] = {}


def register(adapter: PartnerAdapter) -> None:
    _REGISTRY.setdefault(adapter.vertical, {})[adapter.name.lower()] = adapter


def get_adapter(vertical: str, partner_name: str) -> PartnerAdapter | None:
    return _REGISTRY.get(vertical, {}).get(partner_name.lower())


def adapters_for(vertical: str) -> list[PartnerAdapter]:
    return list(_REGISTRY.get(vertical, {}).values())
