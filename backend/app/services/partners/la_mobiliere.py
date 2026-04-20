"""Adaptateur La Mobilière — assurance (bâtiment, RC, inventaire).

ÉTAT : stub. À remplacer quand le contrat affiliation sera signé et l'accès
Broker Portal / API obtenu.

Docs attendues (à récupérer côté commercial) :
  - URL endpoint création lead (probablement OAuth2 client_credentials)
  - Schéma payload (nom, adresse bien, type couverture, date effet)
  - Schéma callback de signature (webhook ou polling statut)
"""

from __future__ import annotations

import logging
from typing import Any

from app.services.partners import PartnerAdapter, register

logger = logging.getLogger("althy.partners.la_mobiliere")


class LaMobiliereAdapter:
    vertical: str = "insurance"
    name: str = "La Mobilière"

    async def send_lead(
        self,
        *,
        lead_id: str,
        user_payload: dict,
        api_base_url: str | None,
        api_key: str | None,
    ) -> dict[str, Any]:
        """STUB : log + retour simulé.

        Implémentation cible :
          POST {api_base_url}/v1/leads
          Authorization: Bearer {api_key}
          Body: {
            "source": "althy",
            "althy_lead_id": lead_id,
            "customer": {"first_name":..., "last_name":..., "email":...},
            "property": {"street":..., "zip":..., "city":...},
            "coverage": "building_rc_inventory"
          }
        """
        logger.info(
            "la_mobiliere.stub_lead lead_id=%s payload_keys=%s",
            lead_id,
            sorted(user_payload.keys()),
        )
        return {
            "accepted": True,
            "external_reference": f"stub-mob-{lead_id[:8]}",
            "message": "stub_mode",
        }


register(LaMobiliereAdapter())
