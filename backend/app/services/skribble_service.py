"""Service Skribble — client HTTP + helpers signature SES (Sprint 10 Lot 2).

§2.4.16 doctrine 2026-05-14 — Skribble SES bascule Phase 1.0. Coexiste avec
Plan B SES renforcée (flow Sprint 8) via `settings.SKRIBBLE_ENABLED`.

API officielle : https://api.skribble.com/v2 (REST + JSON).
Auth : POST /access/login → JWT bearer, cache process-local 1h.
Webhook : HMAC-SHA256 du body avec `settings.SKRIBBLE_WEBHOOK_SECRET`.

Doctrine :
  - §B.10 : si Skribble retourne 5xx/timeout → propage l'exception httpx
    pour que l'appelant raise 502 explicite (pas de silencieux).
  - §B.11 : pas de mock data en code production. Les mocks vivent dans tests/.
  - §B.12 : si on logge un événement Skribble dans une table d'audit, session
    isolée via AsyncSessionLocal().

Référence métier : 5 documents Phase 1.0 (bail, avenant, résiliation, mandat,
EDL+convention sortie). Cf signature_orchestrator.py pour la façade.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import logging
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
from app.core.config import settings
from pydantic import BaseModel, EmailStr, Field

logger = logging.getLogger("althy.skribble")

_TIMEOUT = httpx.Timeout(30.0, connect=10.0)
_TOKEN_TTL = timedelta(hours=1)


# ── Pydantic models ──────────────────────────────────────────────────────────


class SkribbleSigner(BaseModel):
    """Représente un signataire transmis à Skribble.

    SES (Simple Electronic Signature) nécessite a minima email et nom complet.
    `mobile_number` est requis pour la signature SES via SMS OTP — sinon
    Skribble bascule sur signature email-only (légèrement moins probante mais
    toujours conforme art. 14 al. 1 CO).
    """

    email_address: EmailStr
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    language: str = Field("fr", pattern=r"^(fr|de|it|en)$")
    mobile_number: str | None = None  # E.164 format si fourni (ex: +41791234567)
    signer_identity_data: dict[str, Any] | None = None


# ── Errors ───────────────────────────────────────────────────────────────────


class SkribbleClientError(Exception):
    """Erreur métier Skribble (auth, validation payload, etc.)."""


class SkribbleAPIError(Exception):
    """Erreur HTTP Skribble (5xx, timeout). Le caller transforme en 502."""

    def __init__(self, message: str, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


# ── Webhook HMAC helpers ─────────────────────────────────────────────────────


def verify_webhook_signature(payload_body: bytes, header_signature: str) -> bool:
    """Vérifie le HMAC-SHA256 d'un webhook Skribble.

    Args:
        payload_body: corps brut de la requête HTTP (bytes — important pour HMAC).
        header_signature: valeur du header `X-Skribble-Signature` (hex digest).

    Returns:
        True si la signature correspond, False sinon. Comparaison constant-time
        via `hmac.compare_digest` pour prévenir les timing attacks.

    Si `settings.SKRIBBLE_WEBHOOK_SECRET` est vide (env dev sans Skribble),
    retourne False — pas d'auth bypass possible.
    """
    if not settings.SKRIBBLE_WEBHOOK_SECRET:
        logger.warning("verify_webhook_signature: SKRIBBLE_WEBHOOK_SECRET empty")
        return False
    if not header_signature:
        return False
    expected = hmac.new(
        settings.SKRIBBLE_WEBHOOK_SECRET.encode("utf-8"),
        payload_body,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, header_signature)


# ── SkribbleClient ───────────────────────────────────────────────────────────


class SkribbleClient:
    """Client HTTP Skribble (singleton process-local).

    Cache JWT 1h. Retry httpx automatique via Transport (3 retries sur 5xx +
    connection errors).

    Usage :
        client = get_skribble_client()
        resp = await client.create_signature_request(...)

    L'instance est partagée entre requêtes FastAPI — httpx.AsyncClient est
    thread-safe et fait du connection pooling automatiquement.
    """

    def __init__(self) -> None:
        # §B.10 validation : prod env mais clé sandbox → refus explicite.
        if (
            settings.SKRIBBLE_ENVIRONMENT == "production"
            and "sandbox" in settings.SKRIBBLE_API_KEY.lower()
        ):
            raise SkribbleClientError(
                "Configuration incohérente : SKRIBBLE_ENVIRONMENT=production "
                "mais SKRIBBLE_API_KEY contient 'sandbox'. Refus boot client."
            )

        self.api_url = settings.SKRIBBLE_API_URL.rstrip("/")
        self.username = settings.SKRIBBLE_USERNAME
        self.api_key = settings.SKRIBBLE_API_KEY
        self.environment = settings.SKRIBBLE_ENVIRONMENT

        # Token cache (process-local — pas Redis pour Phase 1.0 simplicité)
        self._token: str | None = None
        self._token_expires_at: datetime | None = None

        # httpx async client réutilisable
        transport = httpx.AsyncHTTPTransport(retries=3)
        self._http = httpx.AsyncClient(timeout=_TIMEOUT, transport=transport)

    async def aclose(self) -> None:
        """À appeler au shutdown FastAPI (lifespan)."""
        await self._http.aclose()

    # ── Auth ─────────────────────────────────────────────────────────────────

    async def authenticate(self) -> str:
        """Retourne un JWT bearer valide (cache 1h).

        Raises SkribbleAPIError si Skribble down ou credentials invalides.
        """
        now = datetime.now(UTC)
        if (
            self._token
            and self._token_expires_at
            and self._token_expires_at > now + timedelta(minutes=5)
        ):
            return self._token

        if not self.username or not self.api_key:
            raise SkribbleClientError(
                "SKRIBBLE_USERNAME et SKRIBBLE_API_KEY doivent être configurés"
            )

        try:
            resp = await self._http.post(
                f"{self.api_url}/access/login",
                json={"username": self.username, "api-key": self.api_key},
                headers={"Content-Type": "application/json"},
            )
        except httpx.HTTPError as exc:
            raise SkribbleAPIError(f"Skribble auth network error: {exc}") from exc

        if resp.status_code != 200:
            raise SkribbleAPIError(
                f"Skribble auth failed: {resp.status_code} {resp.text[:200]}",
                status_code=resp.status_code,
            )

        # Skribble retourne le token en text brut (pas JSON wrapper)
        token = resp.text.strip().strip('"')
        if not token:
            raise SkribbleAPIError("Skribble auth: empty token in response")

        self._token = token
        self._token_expires_at = now + _TOKEN_TTL
        logger.info("skribble.authenticate.cached_until=%s", self._token_expires_at)
        return token

    async def _authed_headers(self) -> dict[str, str]:
        token = await self.authenticate()
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

    # ── Signature requests ───────────────────────────────────────────────────

    async def create_signature_request(
        self,
        *,
        document_pdf_bytes: bytes,
        document_filename: str,
        title: str,
        signers: list[SkribbleSigner],
        quality: str = "SES",
        callback_success_url: str,
        callback_error_url: str,
        webhook_url: str,
        legislation: str = "ZERTES",
    ) -> dict[str, Any]:
        """Crée une signature request Skribble.

        Args:
            document_pdf_bytes: contenu binaire du PDF à signer.
            document_filename: nom de fichier (pour l'UI Skribble).
            title: titre affiché dans Skribble.
            signers: liste de SkribbleSigner (≥ 1).
            quality: SES | AES | QES (Phase 1.0 = SES par défaut).
            callback_success_url: URL de redirection après signature OK.
            callback_error_url: URL de redirection après échec.
            webhook_url: URL webhook pour notifications événements.
            legislation: ZERTES (Suisse) ou EIDAS (UE).

        Returns:
            dict — réponse Skribble (contient au minimum 'id' + 'signing_url').

        Raises:
            SkribbleClientError : payload invalide (signers vide, etc.).
            SkribbleAPIError    : erreur HTTP Skribble.
        """
        if not signers:
            raise SkribbleClientError("create_signature_request: signers cannot be empty")
        if quality not in ("SES", "AES", "QES"):
            raise SkribbleClientError(f"quality invalide: {quality} (SES|AES|QES)")
        if legislation not in ("ZERTES", "EIDAS"):
            raise SkribbleClientError(f"legislation invalide: {legislation}")

        payload: dict[str, Any] = {
            "title": title,
            "content": base64.b64encode(document_pdf_bytes).decode("ascii"),
            "file_name": document_filename,
            "quality": quality,
            "legislation": legislation,
            "callback_success_url": callback_success_url,
            "callback_error_url": callback_error_url,
            "webhook_url": webhook_url,
            "signatures": [
                {
                    "account_email": s.email_address,
                    "first_name": s.first_name,
                    "last_name": s.last_name,
                    "language": s.language,
                    **({"mobile_number": s.mobile_number} if s.mobile_number else {}),
                    **(
                        {"signer_identity_data": s.signer_identity_data}
                        if s.signer_identity_data
                        else {}
                    ),
                }
                for s in signers
            ],
        }

        try:
            resp = await self._http.post(
                f"{self.api_url}/signature-requests",
                headers=await self._authed_headers(),
                json=payload,
            )
        except httpx.HTTPError as exc:
            raise SkribbleAPIError(
                f"Skribble create_signature_request network error: {exc}"
            ) from exc

        if resp.status_code == 401:
            # Token expired — invalidate cache + retry once
            self._token = None
            try:
                resp = await self._http.post(
                    f"{self.api_url}/signature-requests",
                    headers=await self._authed_headers(),
                    json=payload,
                )
            except httpx.HTTPError as exc:
                raise SkribbleAPIError(
                    f"Skribble create retry network error: {exc}"
                ) from exc

        if resp.status_code not in (200, 201):
            raise SkribbleAPIError(
                f"Skribble create_signature_request failed: "
                f"{resp.status_code} {resp.text[:200]}",
                status_code=resp.status_code,
            )

        data = resp.json()
        logger.info(
            "skribble.create_signature_request.id=%s signers=%d quality=%s",
            data.get("id"),
            len(signers),
            quality,
        )
        return data

    async def get_signature_request(self, request_id: str) -> dict[str, Any]:
        """Récupère l'état actuel d'une signature request."""
        try:
            resp = await self._http.get(
                f"{self.api_url}/signature-requests/{request_id}",
                headers=await self._authed_headers(),
            )
        except httpx.HTTPError as exc:
            raise SkribbleAPIError(
                f"Skribble get_signature_request network error: {exc}"
            ) from exc

        if resp.status_code == 404:
            raise SkribbleClientError(f"Signature request {request_id} introuvable")
        if resp.status_code != 200:
            raise SkribbleAPIError(
                f"Skribble get failed: {resp.status_code} {resp.text[:200]}",
                status_code=resp.status_code,
            )
        return resp.json()

    async def download_signed_pdf(self, request_id: str) -> bytes:
        """Télécharge le PDF signé (signature visuelle + cert horodatage).

        Disponible uniquement quand `status='completed'` côté Skribble.
        """
        try:
            resp = await self._http.get(
                f"{self.api_url}/signature-requests/{request_id}/attachments/document",
                headers={"Authorization": f"Bearer {await self.authenticate()}"},
            )
        except httpx.HTTPError as exc:
            raise SkribbleAPIError(
                f"Skribble download_signed_pdf network error: {exc}"
            ) from exc

        if resp.status_code != 200:
            raise SkribbleAPIError(
                f"Skribble download failed: {resp.status_code} {resp.text[:200]}",
                status_code=resp.status_code,
            )
        return resp.content

    async def cancel_signature_request(self, request_id: str) -> bool:
        """Annule une signature request (toutes parties)."""
        try:
            resp = await self._http.delete(
                f"{self.api_url}/signature-requests/{request_id}",
                headers=await self._authed_headers(),
            )
        except httpx.HTTPError as exc:
            raise SkribbleAPIError(
                f"Skribble cancel network error: {exc}"
            ) from exc
        return resp.status_code in (200, 204)

    async def withdraw_signer(self, request_id: str, signer_id: str) -> bool:
        """Retire un signataire d'une signature request en cours."""
        try:
            resp = await self._http.delete(
                f"{self.api_url}/signature-requests/{request_id}/signatures/{signer_id}",
                headers=await self._authed_headers(),
            )
        except httpx.HTTPError as exc:
            raise SkribbleAPIError(
                f"Skribble withdraw_signer network error: {exc}"
            ) from exc
        return resp.status_code in (200, 204)


# ── Singleton accessor ───────────────────────────────────────────────────────


_client: SkribbleClient | None = None


def get_skribble_client() -> SkribbleClient:
    """Retourne l'instance partagée du client Skribble (lazy init)."""
    global _client
    if _client is None:
        _client = SkribbleClient()
    return _client
