"""Chiffrement at-rest pour champs sensibles (PR-A11.A.6.d).

Helper générique factorisant le pattern Fernet historiquement implémenté
dans `partner_service.encrypt_api_key` / `decrypt_api_key`. Réutilise la
même dérivation `SECRET_KEY → SHA256 → base64 urlsafe` pour rester
compatible avec d'éventuels rotations de clé (un seul levier env).

Usage côté service :

    from app.core.crypto import encrypt_field, decrypt_field

    bien.code_digicode_encrypted = encrypt_field(payload.code_digicode)
    plain = decrypt_field(bien.code_digicode_encrypted)

Champs concernés actuellement :
  - `Bien.code_digicode_encrypted` (sécurité opérationnelle, nLPD §6.2)

Backlog : `partner_service.py` peut migrer plus tard pour réutiliser ces
helpers (sans changer la sémantique cryptographique). Hors scope A11.A.6.d.
"""

from __future__ import annotations

import base64
import hashlib
import logging

from app.core.config import settings
from cryptography.fernet import Fernet, InvalidToken

logger = logging.getLogger("althy.crypto")


def _fernet() -> Fernet:
    """Dérive une clé Fernet depuis SECRET_KEY (32 bytes → urlsafe base64)."""
    digest = hashlib.sha256(settings.SECRET_KEY.encode("utf-8")).digest()
    key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


def encrypt_field(plaintext: str | None) -> str | None:
    """Chiffre une chaîne. None ou chaîne vide → None (no-op idempotent)."""
    if not plaintext:
        return None
    token = _fernet().encrypt(plaintext.encode("utf-8"))
    return token.decode("utf-8")


def decrypt_field(ciphertext: str | None) -> str | None:
    """Déchiffre. None → None. Token invalide → None (log + retour vide)."""
    if not ciphertext:
        return None
    try:
        return _fernet().decrypt(ciphertext.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        logger.error("crypto.decrypt_field: token invalide — SECRET_KEY a changé ?")
        return None
