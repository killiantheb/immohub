"""
Source unique des enums et mappings relatifs à l'entité Bien.

Centralisation des normalizations EN/FR/accents/abréviations vers les valeurs
canoniques FR attendues par la base (bien_type_enum, bien_statut_enum).

Évite la duplication dans tasks/import_elements.py, routers/onboarding.py,
routers/ai/listings.py, routers/sphere_agent.py.
"""
from typing import Literal

# ──────────────────────────────────────────────────────────────────────────
# Types canoniques (source unique)
# ──────────────────────────────────────────────────────────────────────────

BienTypeLiteral = Literal[
    "appartement", "villa", "studio", "maison",
    "commerce", "bureau", "parking", "garage", "cave", "autre",
]

BienStatutLiteral = Literal["loue", "vacant", "en_travaux"]

# Défauts canoniques utilisés par les normalizers en cas d'entrée inconnue
DEFAULT_BIEN_TYPE: BienTypeLiteral = "appartement"
DEFAULT_BIEN_STATUT: BienStatutLiteral = "vacant"

# ──────────────────────────────────────────────────────────────────────────
# Aliases — superset fusionné des mappings historiques
# ──────────────────────────────────────────────────────────────────────────

BIEN_TYPE_ALIASES: dict[str, BienTypeLiteral] = {
    # FR canoniques (identité)
    "appartement": "appartement",
    "villa": "villa",
    "studio": "studio",
    "maison": "maison",
    "commerce": "commerce",
    "bureau": "bureau",
    "parking": "parking",
    "garage": "garage",
    "cave": "cave",
    "autre": "autre",
    # FR variations
    "appart": "appartement",
    "appt": "appartement",
    "apt": "appartement",
    "app": "appartement",
    "place": "parking",
    # EN canoniques
    "apartment": "appartement",
    "flat": "appartement",
    "house": "maison",
    "office": "bureau",
    "commercial": "commerce",
    # EN supprimés Phase 1 (mappés vers le plus proche pour robustesse import legacy)
    "box": "garage",
    "depot": "autre",
    "dépôt": "autre",
    "hotel": "autre",
    "other": "autre",
}

BIEN_STATUT_ALIASES: dict[str, BienStatutLiteral] = {
    # FR canoniques (identité)
    "loue": "loue",
    "vacant": "vacant",
    "en_travaux": "en_travaux",
    # FR variations
    "loué": "loue",
    "occupe": "loue",
    "occupé": "loue",
    "vide": "vacant",
    "libre": "vacant",
    "disponible": "vacant",
    "travaux": "en_travaux",
    "renovation": "en_travaux",
    "rénovation": "en_travaux",
    # EN
    "rented": "loue",
    "occupied": "loue",
    "free": "vacant",
    "available": "vacant",
    "maintenance": "en_travaux",
}

# ──────────────────────────────────────────────────────────────────────────
# Normalizers
# ──────────────────────────────────────────────────────────────────────────

def normalize_bien_type(
    raw: str | None,
    default: BienTypeLiteral = DEFAULT_BIEN_TYPE,
) -> BienTypeLiteral:
    """
    Normalise une valeur brute (EN/FR/accents/abréviations) vers le type
    canonique FR attendu par bien_type_enum.
    Retourne `default` si la valeur est None, vide, ou inconnue.
    """
    if not raw:
        return default
    cleaned = raw.strip().lower()
    return BIEN_TYPE_ALIASES.get(cleaned, default)


def normalize_bien_statut(
    raw: str | None,
    default: BienStatutLiteral = DEFAULT_BIEN_STATUT,
) -> BienStatutLiteral:
    """
    Normalise une valeur brute vers le statut canonique FR attendu par
    bien_statut_enum.
    Retourne `default` si la valeur est None, vide, ou inconnue.
    """
    if not raw:
        return default
    cleaned = raw.strip().lower()
    return BIEN_STATUT_ALIASES.get(cleaned, default)
