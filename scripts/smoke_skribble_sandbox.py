"""Smoke test Skribble sandbox — Sprint 10 Lot 8.

Exécute un cycle complet :
  1. Authentifie au sandbox Skribble (POST /access/login)
  2. Crée une signature_request avec un PDF dummy + 1 signataire fictif
  3. Récupère le status (devrait être 'created' ou 'pending_signatures')
  4. Annule la signature_request (cleanup)

Pré-requis env :
  SKRIBBLE_API_URL=https://api.skribble.com/v2
  SKRIBBLE_USERNAME=hbm-swiss-sandbox
  SKRIBBLE_API_KEY=<sandbox-key>
  SKRIBBLE_ENVIRONMENT=sandbox

Usage :
  cd backend && python ../scripts/smoke_skribble_sandbox.py

§B.11 : pas de fake data en production — ce script reste un outil dev/ops.
Idempotent : la signature créée est annulée à la fin (cleanup).
"""

from __future__ import annotations

import asyncio
import os
import sys
import time
from datetime import datetime

# Bootstrap path
here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(here, "backend"))


PLACEHOLDER_PDF = (
    b"%PDF-1.4\n%Smoke test Althy Sprint 10 Skribble sandbox\n"
    b"1 0 obj << /Type /Catalog >> endobj\n"
    b"%%EOF\n"
)


async def main() -> int:
    print(f"\n=== Smoke test Skribble sandbox — {datetime.now().isoformat()} ===\n")

    # Lazy import après bootstrap path
    from app.services.skribble_service import (
        SkribbleAPIError,
        SkribbleClient,
        SkribbleClientError,
        SkribbleSigner,
    )
    from app.core.config import settings

    if not settings.SKRIBBLE_API_KEY or not settings.SKRIBBLE_USERNAME:
        print("✗ SKRIBBLE_USERNAME ou SKRIBBLE_API_KEY non configuré dans .env")
        return 2

    if settings.SKRIBBLE_ENVIRONMENT != "sandbox":
        print(f"✗ SKRIBBLE_ENVIRONMENT={settings.SKRIBBLE_ENVIRONMENT} — refus exécution hors sandbox")
        return 3

    client = SkribbleClient()
    request_id: str | None = None

    try:
        # 1. Authenticate
        print("→ Étape 1/4 : authentification Skribble sandbox...")
        t0 = time.time()
        token = await client.authenticate()
        print(f"  ✓ Authentifié ({time.time() - t0:.2f}s) — token len={len(token)}")

        # 2. Create signature request
        print("\n→ Étape 2/4 : create_signature_request (1 signataire fictif)...")
        t0 = time.time()
        signer = SkribbleSigner(
            email_address="smoke-test@althy.local",
            first_name="Smoke",
            last_name="Test",
            language="fr",
        )
        resp = await client.create_signature_request(
            document_pdf_bytes=PLACEHOLDER_PDF,
            document_filename="smoke-test-althy.pdf",
            title=f"Smoke test {datetime.now().isoformat()[:19]}",
            signers=[signer],
            quality="SES",
            callback_success_url=f"{settings.FRONTEND_URL}/app",
            callback_error_url=f"{settings.FRONTEND_URL}/app",
            webhook_url=f"{settings.FRONTEND_URL}/api/v1/webhooks/skribble",
        )
        request_id = resp.get("id")
        if not request_id:
            print(f"  ✗ Pas d'id dans la réponse Skribble : {resp}")
            return 4
        print(f"  ✓ Signature request créée ({time.time() - t0:.2f}s) — id={request_id}")

        # 3. Get status
        print("\n→ Étape 3/4 : get_signature_request status...")
        t0 = time.time()
        status_resp = await client.get_signature_request(request_id)
        sk_status = status_resp.get("status", "unknown")
        print(f"  ✓ Status: {sk_status} ({time.time() - t0:.2f}s)")

        # 4. Cleanup
        print("\n→ Étape 4/4 : cancel_signature_request (cleanup)...")
        t0 = time.time()
        cancelled = await client.cancel_signature_request(request_id)
        if cancelled:
            print(f"  ✓ Annulée proprement ({time.time() - t0:.2f}s)")
        else:
            print(f"  ⚠ Annulation retournée False — vérifier manuellement {request_id}")

        print(f"\n✓ SMOKE OK — Skribble sandbox réactif, signing flow nominal\n")
        return 0

    except (SkribbleAPIError, SkribbleClientError) as e:
        print(f"\n✗ ERREUR Skribble : {e}")
        if request_id:
            print(f"  Cleanup manuel requis sur signature_request_id={request_id}")
        return 1
    except Exception as e:
        print(f"\n✗ ERREUR inattendue : {type(e).__name__}: {e}")
        if request_id:
            print(f"  Cleanup manuel requis sur signature_request_id={request_id}")
        return 1
    finally:
        await client.aclose()


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
