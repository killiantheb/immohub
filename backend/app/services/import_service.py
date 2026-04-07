"""
Import Service — parse un fichier (PDF, Excel, CSV, image) et extrait les données d'un bien.
Utilise Claude pour l'extraction intelligente.
"""
from __future__ import annotations

import base64
import csv
import io
import json
import re

from anthropic import AsyncAnthropic
from app.core.config import settings

CLIENT = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
MODEL = "claude-sonnet-4-5"

PROPERTY_SCHEMA = """
{
  "properties": [
    {
      "type": "apartment|house|studio|commercial|parking|land",
      "address": "adresse complète ou null",
      "city": "ville ou null",
      "zip_code": "code postal ou null",
      "country": "CH",
      "surface": <nombre m² ou null>,
      "rooms": <nombre de pièces ou null>,
      "floor": <étage ou null>,
      "monthly_rent": <loyer mensuel CHF ou null>,
      "charges": <charges mensuelles CHF ou null>,
      "deposit": <dépôt de garantie CHF ou null>,
      "price_sale": <prix de vente CHF ou null>,
      "status": "available|rented|for_sale",
      "is_furnished": true/false,
      "has_parking": true/false,
      "pets_allowed": true/false,
      "description": "description du bien ou null",
      "tenant_name": "nom du locataire si mentionné ou null",
      "tenant_email": "email du locataire ou null"
    }
  ],
  "notes": "informations supplémentaires ou ambiguïtés"
}
"""

EXTRACT_PROMPT = f"""Tu es un expert en gestion immobilière suisse. Analyse ce document et extrait toutes les informations sur les biens immobiliers.

Retourne UNIQUEMENT ce JSON (sans texte avant/après) :
{PROPERTY_SCHEMA}

Règles :
- Extrais TOUS les biens mentionnés dans le document
- "apartment"=appartement/flat, "house"=maison/villa, "studio"=studio, "commercial"=local commercial
- "available"=disponible/libre, "rented"=loué/occupé, "for_sale"=à vendre
- Montants toujours en CHF (convertis si EUR: ×1.05)
- Si plusieurs biens, retourne un tableau avec tous
- null si information absente
"""


async def extract_from_text(text: str) -> dict:
    """Extrait les données d'un texte brut via Claude."""
    response = await CLIENT.messages.create(
        model=MODEL,
        max_tokens=2000,
        messages=[{"role": "user", "content": f"{EXTRACT_PROMPT}\n\nDocument :\n{text[:8000]}"}],
    )
    return _parse_response(response.content[0].text)


async def extract_from_pdf_bytes(pdf_bytes: bytes) -> dict:
    """Extrait les données d'un PDF via Claude (vision + text)."""
    # Essaie d'abord l'extraction texte avec pdfplumber
    try:
        import pdfplumber
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            text = "\n".join(page.extract_text() or "" for page in pdf.pages)
        if text.strip():
            return await extract_from_text(text)
    except Exception:
        pass

    # Fallback: envoie le PDF en base64 à Claude (vision)
    b64 = base64.standard_b64encode(pdf_bytes).decode()
    response = await CLIENT.messages.create(
        model=MODEL,
        max_tokens=2000,
        messages=[{
            "role": "user",
            "content": [
                {"type": "text", "text": EXTRACT_PROMPT},
                {"type": "document", "source": {"type": "base64", "media_type": "application/pdf", "data": b64}},
            ],
        }],
    )
    return _parse_response(response.content[0].text)


async def extract_from_image_bytes(image_bytes: bytes, media_type: str) -> dict:
    """Extrait les données d'une image via Claude Vision."""
    b64 = base64.standard_b64encode(image_bytes).decode()
    response = await CLIENT.messages.create(
        model=MODEL,
        max_tokens=2000,
        messages=[{
            "role": "user",
            "content": [
                {"type": "text", "text": EXTRACT_PROMPT},
                {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}},
            ],
        }],
    )
    return _parse_response(response.content[0].text)


async def extract_from_excel_bytes(excel_bytes: bytes) -> dict:
    """Extrait les données d'un fichier Excel via openpyxl → texte → Claude."""
    import openpyxl
    wb = openpyxl.load_workbook(io.BytesIO(excel_bytes), read_only=True, data_only=True)
    lines = []
    for sheet in wb.worksheets:
        lines.append(f"=== Feuille: {sheet.title} ===")
        for row in sheet.iter_rows(values_only=True):
            if any(cell is not None for cell in row):
                lines.append(" | ".join(str(c) if c is not None else "" for c in row))
    text = "\n".join(lines)
    return await extract_from_text(text)


async def extract_from_csv_bytes(csv_bytes: bytes) -> dict:
    """Extrait les données d'un CSV → texte → Claude."""
    text = csv_bytes.decode("utf-8-sig", errors="replace")
    return await extract_from_text(text)


async def extract_agency_identity(file_bytes: bytes, content_type: str, filename: str) -> dict:
    """
    Extrait l'identité de l'agence depuis un fichier (logo URL, nom, site web).
    Utilise Clearbit Logo API pour récupérer le logo depuis le domaine.
    """
    is_image = content_type.startswith("image/")
    is_pdf = "pdf" in content_type or filename.endswith(".pdf")

    prompt = """Analyse ce document et extrait les informations de l'agence immobilière.
Retourne UNIQUEMENT ce JSON :
{
  "agency_name": "nom exact de l'agence ou null",
  "website": "domaine sans https (ex: sunimmo.ch) ou null",
  "email": "email de contact ou null",
  "phone": "téléphone ou null",
  "address": "adresse physique ou null",
  "logo_visible": true/false
}"""

    messages_content = []

    if is_image:
        b64 = base64.standard_b64encode(file_bytes).decode()
        mt = content_type if content_type.startswith("image/") else "image/jpeg"
        messages_content = [
            {"type": "text", "text": prompt},
            {"type": "image", "source": {"type": "base64", "media_type": mt, "data": b64}},
        ]
    elif is_pdf:
        try:
            import pdfplumber
            with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                text = "\n".join(page.extract_text() or "" for page in pdf.pages[:3])
            messages_content = [{"type": "text", "text": f"{prompt}\n\nTexte du document :\n{text[:3000]}"}]
        except Exception:
            b64 = base64.standard_b64encode(file_bytes).decode()
            messages_content = [
                {"type": "text", "text": prompt},
                {"type": "document", "source": {"type": "base64", "media_type": "application/pdf", "data": b64}},
            ]
    else:
        return {}

    try:
        response = await CLIENT.messages.create(
            model=MODEL,
            max_tokens=400,
            messages=[{"role": "user", "content": messages_content}],
        )
        raw = response.content[0].text.strip()
        identity = _parse_response(raw)

        # Tente de récupérer le logo via Clearbit si on a le domaine
        domain = identity.get("website")
        if domain:
            domain = domain.replace("https://", "").replace("http://", "").split("/")[0]
            identity["logo_url"] = f"https://logo.clearbit.com/{domain}"

        return identity
    except Exception:
        return {}


def _parse_response(raw: str) -> dict:
    """Parse la réponse Claude en dict."""
    if "```" in raw:
        raw = re.sub(r"```(?:json)?", "", raw).strip()
    try:
        return json.loads(raw)
    except Exception:
        match = re.search(r"\{[\s\S]*\}", raw)
        if match:
            try:
                return json.loads(match.group())
            except Exception:
                pass
    return {"properties": [], "notes": "Extraction échouée"}
