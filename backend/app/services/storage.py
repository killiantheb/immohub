"""Supabase Storage — upload et URL pré-signées.

Utilise l'API REST Supabase Storage (pas de SDK Python).
Bucket : "documents" (créé via migration SQL).
"""

from __future__ import annotations

from datetime import datetime

import httpx
from app.core.config import settings


_BUCKET = "documents"
_TIMEOUT = 15


def _storage_url(path: str) -> str:
    return f"{settings.SUPABASE_URL}/storage/v1{path}"


def _headers() -> dict[str, str]:
    return {
        "apikey": settings.SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
    }


async def upload_pdf(
    *,
    user_id: str,
    property_id: str,
    doc_type: str,
    mois: str,
    pdf_bytes: bytes,
) -> str:
    """Upload un PDF dans Supabase Storage et retourne le chemin (object key).

    Structure : documents/{user_id}/{property_id}/{doc_type}_{mois}.pdf
    """
    key = f"{user_id}/{property_id}/{doc_type}_{mois}.pdf"

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.post(
            _storage_url(f"/object/{_BUCKET}/{key}"),
            headers={
                **_headers(),
                "Content-Type": "application/pdf",
                "x-upsert": "true",
            },
            content=pdf_bytes,
        )
        resp.raise_for_status()

    return key


async def get_signed_url(key: str, expires_in: int = 3600) -> str:
    """Génère une URL pré-signée (1h par défaut) pour télécharger un fichier."""
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.post(
            _storage_url(f"/object/sign/{_BUCKET}/{key}"),
            headers={**_headers(), "Content-Type": "application/json"},
            json={"expiresIn": expires_in},
        )
        resp.raise_for_status()
        data = resp.json()

    signed_path = data.get("signedURL", "")
    return f"{settings.SUPABASE_URL}/storage/v1{signed_path}"
