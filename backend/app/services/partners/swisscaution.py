"""Adaptateur SwissCaution — garantie de loyer (caution).

ÉTAT : stub. À remplacer dès accord commercial + accès Partner API SwissCaution.

Cas d'usage Althy :
  Un locataire postule sur une annonce mais n'a pas les 3 mois de loyer de
  garantie bancaire — Althy propose (avec consentement) d'envoyer la demande
  à SwissCaution pour une garantie indépendante.
"""

from __future__ import annotations

import logging
from typing import Any

from app.services.partners import register

logger = logging.getLogger("althy.partners.swisscaution")


class SwissCautionAdapter:
    vertical: str = "caution"
    name: str = "SwissCaution"

    async def send_lead(
        self,
        *,
        lead_id: str,
        user_payload: dict,
        api_base_url: str | None,
        api_key: str | None,
    ) -> dict[str, Any]:
        """STUB — implémentation cible :

          POST {api_base_url}/partners/leads
          Authorization: Bearer {api_key}
          Body: {
            "partner_id": "althy",
            "ref": lead_id,
            "tenant": {"first_name":..., "last_name":..., "email":..., "phone":...},
            "lease": {"monthly_rent": 2300, "deposit_months": 3, "property_address":...},
          }
        """
        logger.info(
            "swisscaution.stub_lead lead_id=%s rent=%s",
            lead_id,
            user_payload.get("monthly_rent"),
        )
        return {
            "accepted": True,
            "external_reference": f"stub-sc-{lead_id[:8]}",
            "message": "stub_mode",
        }


register(SwissCautionAdapter())
