"""Adaptateur Raiffeisen — hypothèque.

ÉTAT : stub. À finaliser avec la Direction Partenariats Raiffeisen (deal
hypothèque + scoring affinité automatique depuis profil Althy).

Cas d'usage :
  User s'inscrit sur Althy avec intention d'achat (marketplace visites répétées
  + estimation IA enregistrée) → Althy propose mise en relation agence
  Raiffeisen régionale (région du bien consulté).
"""

from __future__ import annotations

import logging
from typing import Any

from app.services.partners import register

logger = logging.getLogger("althy.partners.raiffeisen")


class RaiffeisenAdapter:
    vertical: str = "mortgage"
    name: str = "Raiffeisen"

    async def send_lead(
        self,
        *,
        lead_id: str,
        user_payload: dict,
        api_base_url: str | None,
        api_key: str | None,
    ) -> dict[str, Any]:
        """STUB — implémentation cible :

          POST {api_base_url}/broker/leads
          Authorization: Bearer {api_key}
          Body: {
            "source": "althy",
            "ref": lead_id,
            "prospect": {"email":..., "phone":..., "canton":...},
            "target": {"price_range_chf": [750000, 950000], "property_type": "appartement"},
          }
        """
        logger.info(
            "raiffeisen.stub_lead lead_id=%s canton=%s",
            lead_id,
            user_payload.get("canton"),
        )
        return {
            "accepted": True,
            "external_reference": f"stub-raiff-{lead_id[:8]}",
            "message": "stub_mode",
        }


register(RaiffeisenAdapter())
