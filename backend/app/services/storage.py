"""Supabase Storage — upload et URL pré-signées.

Utilise l'API REST Supabase Storage (pas de SDK Python).

Bucket par défaut : lu depuis `settings.SUPABASE_BUCKET_DOCUMENTS` (Lot 1.5
Sprint 10 — variabilisation anti-§C hardcode, cf AUDIT_SPRINT10.md §8.2).
Le bucket Sprint 10 dédié aux documents signables (bail, mandat, avenant,
résiliation, EDL signés) est `settings.SUPABASE_BUCKET_SIGNABLE_DOCUMENTS` —
à passer explicitement via le paramètre `bucket=` des fonctions ci-dessous.
"""

from __future__ import annotations

import httpx
from app.core.config import settings

_TIMEOUT = 15


def _default_bucket() -> str:
    """Bucket par défaut (anti-§C — lu depuis settings, pas hardcodé)."""
    return settings.SUPABASE_BUCKET_DOCUMENTS


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
    bien_id: str,
    doc_type: str,
    mois: str,
    pdf_bytes: bytes,
    bucket: str | None = None,
) -> str:
    """Upload un PDF dans Supabase Storage et retourne le chemin (object key).

    Structure : {bucket}/{user_id}/{bien_id}/{doc_type}_{mois}.pdf

    Args:
        bucket: optionnel — bucket cible. Si None, utilise
            `settings.SUPABASE_BUCKET_DOCUMENTS` (= "documents" par défaut).
            Pour les documents signables Sprint 10, passer explicitement
            `settings.SUPABASE_BUCKET_SIGNABLE_DOCUMENTS`.
    """
    target_bucket = bucket or _default_bucket()
    key = f"{user_id}/{bien_id}/{doc_type}_{mois}.pdf"

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.post(
            _storage_url(f"/object/{target_bucket}/{key}"),
            headers={
                **_headers(),
                "Content-Type": "application/pdf",
                "x-upsert": "true",
            },
            content=pdf_bytes,
        )
        resp.raise_for_status()

    return key


async def get_signed_url(
    key: str, expires_in: int = 3600, bucket: str | None = None
) -> str:
    """Génère une URL pré-signée (1h par défaut) pour télécharger un fichier.

    Args:
        bucket: optionnel — bucket cible. Si None, utilise le bucket par défaut.
            Doit matcher celui passé à `upload_pdf` pour la même clé.
    """
    target_bucket = bucket or _default_bucket()
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.post(
            _storage_url(f"/object/sign/{target_bucket}/{key}"),
            headers={**_headers(), "Content-Type": "application/json"},
            json={"expiresIn": expires_in},
        )
        resp.raise_for_status()
        data = resp.json()

    signed_path = data.get("signedURL", "")
    return f"{settings.SUPABASE_URL}/storage/v1{signed_path}"
