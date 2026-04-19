"""ai_listings.py — Generate-listing, estimate, scan-facture, generer-description, import-property."""

from __future__ import annotations

import json as _json
import re as _re
import uuid as _uuid
from typing import Annotated

from app.core.database import get_db
from app.core.limiter import rate_limit
from app.core.security import get_current_user
from app.models.user import User
from app.services.ai_service import generate_listing_description
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/ai", tags=["ai"])

DbDep       = Annotated[AsyncSession, Depends(get_db)]
AuthUserDep = Annotated[User, Depends(get_current_user)]


# ── Schemas ───────────────────────────────────────────────────────────────────

class GenerateListingRequest(BaseModel):
    property_id: str


class GenerateListingResponse(BaseModel):
    description: str


class EstimateRequest(BaseModel):
    address: str
    city: str
    property_type: str = "apartment"
    surface: float | None = None
    rooms: int | None = None
    year_built: int | None = None
    condition: str = "good"


class EstimateResponse(BaseModel):
    sale_price_min: int
    sale_price_max: int
    rent_monthly_min: int
    rent_monthly_max: int
    rent_seasonal_week: int | None
    rent_nightly: int | None
    gross_yield_pct: float
    price_per_sqm: int | None
    ai_comment: str
    confidence: str


class ScanFactureResponse(BaseModel):
    id: _uuid.UUID
    montant: float | None
    fournisseur: str | None
    date_facture: str | None
    description: str | None
    numero_facture: str | None
    categorie_oblf: str | None
    sous_categorie: str | None
    bien_id: _uuid.UUID | None
    bien_adresse: str | None
    statut: str
    confidence: float


class ConfirmerFactureRequest(BaseModel):
    depense_id: _uuid.UUID
    bien_id: _uuid.UUID
    categorie_oblf: str
    montant: float | None = None
    description: str | None = None


class GenererDescriptionBienRequest(BaseModel):
    type: str = "apartment"
    transaction_type: str = "location"
    ville: str
    surface: float | None = None
    pieces: int | None = None
    prix: float | None = None
    charges: float | None = None
    is_furnished: bool = False
    has_parking: bool = False
    has_balcony: bool = False
    has_terrace: bool = False
    has_garden: bool = False
    pets_allowed: bool = False


class GenererDescriptionBienResponse(BaseModel):
    description: str
    tags_ia: list[str]


# ── Helpers ───────────────────────────────────────────────────────────────────

_CITY_PRICES: dict[str, int] = {
    "genève": 13500, "geneva": 13500, "ge": 13500,
    "zürich": 13000, "zurich": 13000, "zuerich": 13000,
    "lausanne": 10500, "vaud": 9000,
    "berne": 8500, "bern": 8500,
    "bâle": 9000, "basel": 9000, "bale": 9000,
    "zug": 14000, "zoug": 14000,
    "lugano": 9500,
    "neuchâtel": 7500, "neuchatel": 7500,
    "fribourg": 7000,
}

OBLF_CATEGORIES = {
    "entretien":    "Entretien courant (nettoyage, jardinage, petites réparations)",
    "reparation":   "Réparations (électricité, plomberie, toiture, carrelage)",
    "assurance":    "Assurances (bâtiment, RC, incendie, dégâts d'eau)",
    "impots":       "Impôts et taxes (foncier, déchets, eaux usées)",
    "frais_admin":  "Frais administratifs (gérance, courrier recommandé, notaire)",
    "amortissement":"Amortissement et entretien différé",
    "autre":        "Autre charge locative",
}

_TYPE_FR = {
    "apartment": "appartement", "villa": "villa / maison", "parking": "parking",
    "garage": "garage", "box": "box", "cave": "cave", "depot": "dépôt",
    "office": "bureau", "commercial": "local commercial", "hotel": "hôtel",
}
_TX_FR = {
    "location": "à louer", "colocation": "en colocation", "vente": "à vendre",
}


def _price_per_sqm(city: str) -> int:
    city_lower = city.lower().strip()
    for key, price in _CITY_PRICES.items():
        if key in city_lower:
            return price
    return 7500


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/generate-listing", response_model=GenerateListingResponse)
async def generate_listing(
    payload: GenerateListingRequest,
    current_user: AuthUserDep,
    db: DbDep,
) -> GenerateListingResponse:
    """Generate an SEO property description via Claude."""
    import uuid
    from app.models.property import Property
    from sqlalchemy import select

    try:
        pid = uuid.UUID(payload.property_id)
    except ValueError:
        raise HTTPException(422, "property_id invalide")

    result = await db.execute(select(Property).where(Property.id == pid))
    prop = result.scalar_one_or_none()
    if not prop:
        raise HTTPException(404, "Bien introuvable")

    try:
        description = await generate_listing_description(prop, db, str(current_user.id))
    except RuntimeError as exc:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, str(exc))

    return GenerateListingResponse(description=description)


@router.post("/import-property")
async def import_property_file(
    current_user: AuthUserDep,
    db: DbDep,
    file: UploadFile = File(...),
    _=rate_limit(5, 60),
):
    """Upload un fichier (PDF, Excel, CSV, image) → Claude extrait les données → crée les biens."""
    from app.models.property import Property
    from app.services.import_service import (
        extract_from_csv_bytes,
        extract_from_excel_bytes,
        extract_from_image_bytes,
        extract_from_pdf_bytes,
    )

    if current_user.role not in ("proprio_solo", "agence", "super_admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Réservé aux propriétaires et agences")

    content_type = file.content_type or ""
    filename     = (file.filename or "").lower()
    file_bytes   = await file.read()

    if len(file_bytes) > 20 * 1024 * 1024:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Fichier trop volumineux (max 20 Mo)")

    try:
        if "pdf" in content_type or filename.endswith(".pdf"):
            result = await extract_from_pdf_bytes(file_bytes)
        elif content_type in ("image/jpeg", "image/png", "image/webp") or filename.endswith((".jpg", ".jpeg", ".png", ".webp")):
            mt = content_type if content_type.startswith("image/") else "image/jpeg"
            result = await extract_from_image_bytes(file_bytes, mt)
        elif "spreadsheet" in content_type or "excel" in content_type or filename.endswith((".xlsx", ".xls")):
            result = await extract_from_excel_bytes(file_bytes)
        elif "csv" in content_type or filename.endswith(".csv"):
            result = await extract_from_csv_bytes(file_bytes)
        else:
            raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Format non supporté. Utilisez PDF, Excel, CSV ou image.")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Erreur d'extraction : {exc}") from exc

    props_data = result.get("properties", [])
    if not props_data:
        return {"created": [], "count": 0, "notes": result.get("notes", "Aucun bien détecté dans le fichier.")}

    created = []
    for p in props_data:
        if not (p.get("address") or p.get("city")):
            continue
        try:
            new_prop = Property(
                id=_uuid.uuid4(),
                type=p.get("type", "apartment"),
                address=p.get("address") or "",
                city=p.get("city") or "",
                zip_code=p.get("zip_code") or "",
                country=p.get("country") or "CH",
                surface=float(p["surface"]) if p.get("surface") else None,
                rooms=float(p["rooms"]) if p.get("rooms") else None,
                floor=int(p["floor"]) if p.get("floor") else None,
                monthly_rent=float(p["monthly_rent"]) if p.get("monthly_rent") else None,
                charges=float(p["charges"]) if p.get("charges") else None,
                deposit=float(p["deposit"]) if p.get("deposit") else None,
                price_sale=float(p["price_sale"]) if p.get("price_sale") else None,
                status=p.get("status", "available"),
                is_furnished=bool(p.get("is_furnished", False)),
                has_parking=bool(p.get("has_parking", False)),
                pets_allowed=bool(p.get("pets_allowed", False)),
                description=p.get("description"),
                owner_id=current_user.id,
                created_by_id=current_user.id,
                is_active=True,
            )
            db.add(new_prop)
            await db.flush()
            created.append({
                "id": str(new_prop.id), "type": new_prop.type,
                "address": new_prop.address, "city": new_prop.city,
                "monthly_rent": new_prop.monthly_rent, "status": new_prop.status,
            })
        except Exception:
            continue

    await db.commit()

    agency_identity: dict = {}
    if content_type.startswith("image/") or "pdf" in content_type or filename.endswith(".pdf"):
        from app.services.import_service import extract_agency_identity
        try:
            agency_identity = await extract_agency_identity(file_bytes, content_type, file.filename or "")
            logo_url = agency_identity.get("logo_url")
            if logo_url and current_user.role in ("agence", "proprio_solo"):
                import httpx
                async with httpx.AsyncClient(timeout=5) as hclient:
                    resp = await hclient.head(logo_url)
                    if resp.status_code == 200:
                        from sqlalchemy import select as sa_select
                        from app.models.user import User as UserModel
                        result2 = await db.execute(sa_select(UserModel).where(UserModel.id == current_user.id))
                        user_row = result2.scalar_one_or_none()
                        if user_row and not user_row.avatar_url:
                            user_row.avatar_url = logo_url
                            await db.commit()
                            agency_identity["logo_updated"] = True
        except Exception:
            pass

    return {"created": created, "count": len(created), "notes": result.get("notes", ""), "agency_identity": agency_identity}


@router.post("/estimate", response_model=EstimateResponse)
async def estimate_property(body: EstimateRequest):
    """Public estimation endpoint — no auth required (lead magnet)."""
    p_sqm = _price_per_sqm(body.city)

    if body.surface and body.surface > 0:
        mid_price = int(p_sqm * body.surface)
        price_min = int(mid_price * 0.88)
        price_max = int(mid_price * 1.12)
        rent_monthly = int(body.surface * 25)
    else:
        rooms = body.rooms or 3
        estimated_surface = rooms * 30
        mid_price    = int(p_sqm * estimated_surface)
        price_min    = int(mid_price * 0.85)
        price_max    = int(mid_price * 1.15)
        rent_monthly = int(estimated_surface * 25)

    rent_min    = int(rent_monthly * 0.88)
    rent_max    = int(rent_monthly * 1.12)
    gross_yield = round((rent_monthly * 12 / mid_price) * 100, 1)

    city_lower = body.city.lower()
    is_tourist = any(k in city_lower for k in ["genève", "geneva", "lausanne", "verbier", "zermatt", "lugano"])
    rent_seasonal_week = int(rent_monthly * 0.4) if is_tourist else None
    rent_nightly       = int(rent_monthly / 15)  if is_tourist else None

    surface_text = f"{int(body.surface)}m² · " if body.surface else ""
    ai_comment = (
        f"Estimation basée sur le marché immobilier de {body.city} ({surface_text}"
        f"prix moyen CHF {p_sqm:,}/m²). "
        f"Rendement brut estimé de {gross_yield}% — "
        + ("excellent pour la Suisse romande." if gross_yield >= 5 else
           "dans la moyenne suisse." if gross_yield >= 3.5 else
           "typique des marchés premium suisses.")
    )

    return EstimateResponse(
        sale_price_min=price_min, sale_price_max=price_max,
        rent_monthly_min=rent_min, rent_monthly_max=rent_max,
        rent_seasonal_week=rent_seasonal_week, rent_nightly=rent_nightly,
        gross_yield_pct=gross_yield,
        price_per_sqm=p_sqm if body.surface else None,
        ai_comment=ai_comment,
        confidence="medium" if body.surface else "low",
    )


@router.post("/scan-facture", response_model=ScanFactureResponse)
async def scan_facture(
    request: Request,
    current_user: AuthUserDep,
    db: DbDep,
    _=rate_limit(20, 60),
):
    """Scan une facture (image JPEG/PNG/WEBP ou PDF) via Claude Vision."""
    import base64
    import io as _io
    import httpx
    from datetime import date as _date, datetime, timezone
    from anthropic import AsyncAnthropic
    from app.core.config import settings
    from app.models.bien import Bien
    from sqlalchemy import select as sa_sel, text as sa_text

    form      = await request.form()
    file      = form.get("file")
    if not file or not hasattr(file, "read"):
        raise HTTPException(422, "Champ 'file' requis (image ou PDF)")

    file_bytes   = await file.read()  # type: ignore[union-attr]
    content_type: str = getattr(file, "content_type", None) or "image/jpeg"
    filename: str     = getattr(file, "filename",     None) or "facture"

    fn_lower = filename.lower()
    if fn_lower.endswith((".jpg", ".jpeg")) or "jpeg" in content_type:
        media_type = "image/jpeg"
    elif fn_lower.endswith(".png") or "png" in content_type:
        media_type = "image/png"
    elif fn_lower.endswith(".webp") or "webp" in content_type:
        media_type = "image/webp"
    elif fn_lower.endswith(".gif"):
        media_type = "image/gif"
    else:
        media_type = "pdf"

    ts           = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    storage_path = f"factures/{current_user.id}/{ts}_{filename}"
    public_url: str | None = None

    async with httpx.AsyncClient(timeout=30.0) as http:
        up = await http.post(
            f"{settings.SUPABASE_URL}/storage/v1/object/althy-docs/{storage_path}",
            content=file_bytes,
            headers={
                "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
                "Content-Type": content_type,
            },
        )
        if up.status_code in (200, 201):
            public_url = f"{settings.SUPABASE_URL}/storage/v1/object/public/althy-docs/{storage_path}"

    OBLF_LIST = "\n".join(f"- {k}: {v}" for k, v in OBLF_CATEGORIES.items())
    extraction_prompt = (
        "Analyse cette facture et extrais les informations suivantes.\n\n"
        f"Catégories OBLF disponibles (droit suisse du bail) :\n{OBLF_LIST}\n\n"
        "Retourne UNIQUEMENT ce JSON (pas de markdown) :\n"
        '{"montant":<float|null>,"fournisseur":"<str|null>","date_facture":"<YYYY-MM-DD|null>",'
        '"description":"<str|null>","numero_facture":"<str|null>",'
        '"categorie_oblf":"<clé|null>","sous_categorie":"<str|null>","confidence":<0.0-1.0>}'
    )

    extracted: dict = {}
    try:
        client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        if media_type != "pdf":
            b64 = base64.standard_b64encode(file_bytes).decode()
            msg = await client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=400,
                messages=[{"role": "user", "content": [
                    {"type": "text", "text": extraction_prompt},
                    {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}},
                ]}],
            )
        else:
            try:
                import pdfplumber
                with pdfplumber.open(_io.BytesIO(file_bytes)) as pdf:
                    pdf_text = "\n".join(p.extract_text() or "" for p in pdf.pages)
            except Exception:
                pdf_text = "(Contenu PDF non lisible)"
            msg = await client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=400,
                messages=[{"role": "user", "content": f"{extraction_prompt}\n\nContenu PDF:\n{pdf_text[:3000]}"}],
            )

        raw = msg.content[0].text.strip()  # type: ignore[union-attr]
        if "```" in raw:
            raw = raw.split("```")[1].lstrip("json").strip()
        extracted = _json.loads(raw)
    except Exception:
        extracted = {"confidence": 0.3}

    biens_rows = (await db.execute(
        sa_sel(Bien).where(Bien.owner_id == current_user.id, Bien.is_active.is_(True)).limit(1)
    )).scalars().all()
    bien_id      = biens_rows[0].id if biens_rows else None
    bien_adresse = f"{biens_rows[0].adresse}, {biens_rows[0].ville}" if biens_rows else None

    date_str  = extracted.get("date_facture")
    date_parsed = None
    if date_str:
        try:
            date_parsed = _date.fromisoformat(str(date_str))
        except (ValueError, TypeError):
            pass

    insert_row = (await db.execute(
        sa_text("""
            INSERT INTO depenses_scannees
                (owner_id, bien_id, montant, fournisseur, date_facture, description,
                 numero_facture, categorie_oblf, sous_categorie, url_fichier_source, media_type)
            VALUES
                (:owner_id, :bien_id, :montant, :fournisseur, :date_facture, :description,
                 :numero_facture, :categorie_oblf, :sous_categorie, :url, :media_type)
            RETURNING id
        """),
        {
            "owner_id": str(current_user.id), "bien_id": str(bien_id) if bien_id else None,
            "montant": extracted.get("montant"), "fournisseur": extracted.get("fournisseur"),
            "date_facture": date_parsed, "description": extracted.get("description"),
            "numero_facture": extracted.get("numero_facture"),
            "categorie_oblf": extracted.get("categorie_oblf"),
            "sous_categorie": extracted.get("sous_categorie"),
            "url": public_url, "media_type": media_type,
        },
    )).fetchone()
    await db.commit()

    return ScanFactureResponse(
        id=insert_row[0] if insert_row else _uuid.uuid4(),
        montant=extracted.get("montant"), fournisseur=extracted.get("fournisseur"),
        date_facture=extracted.get("date_facture"), description=extracted.get("description"),
        numero_facture=extracted.get("numero_facture"),
        categorie_oblf=extracted.get("categorie_oblf"), sous_categorie=extracted.get("sous_categorie"),
        bien_id=bien_id, bien_adresse=bien_adresse,
        statut="propose", confidence=float(extracted.get("confidence", 0.3)),
    )


@router.post("/confirmer-facture")
async def confirmer_facture(
    payload: ConfirmerFactureRequest,
    current_user: AuthUserDep,
    db: DbDep,
) -> dict:
    """Proprio confirme/corrige l'affectation d'une dépense scannée."""
    from sqlalchemy import text as sa_text
    await db.execute(
        sa_text("""
            UPDATE depenses_scannees
            SET bien_id = :bien_id, categorie_oblf = :cat,
                montant = COALESCE(:montant, montant),
                description = COALESCE(:desc, description),
                statut = 'confirme', confirme_par_user = true, updated_at = now()
            WHERE id = :id AND owner_id = :uid
        """),
        {
            "id": str(payload.depense_id), "uid": str(current_user.id),
            "bien_id": str(payload.bien_id), "cat": payload.categorie_oblf,
            "montant": payload.montant, "desc": payload.description,
        },
    )
    await db.commit()
    return {"confirmed": True, "depense_id": str(payload.depense_id)}


@router.get("/depenses-scannees")
async def list_depenses_scannees(
    current_user: AuthUserDep,
    db: DbDep,
    bien_id: _uuid.UUID | None = None,
    statut: str | None = None,
) -> list[dict]:
    """Liste les factures scannées de l'utilisateur."""
    from sqlalchemy import text as sa_text
    where  = "WHERE owner_id = :uid"
    params: dict = {"uid": str(current_user.id)}
    if bien_id:
        where += " AND bien_id = :bid"
        params["bid"] = str(bien_id)
    if statut:
        where += " AND statut = :s"
        params["s"] = statut

    rows = (await db.execute(
        sa_text(f"SELECT id, montant, fournisseur, date_facture, description, categorie_oblf, statut, bien_id FROM depenses_scannees {where} ORDER BY created_at DESC LIMIT 50"),
        params,
    )).fetchall()

    return [
        {
            "id": str(r[0]), "montant": float(r[1]) if r[1] else None,
            "fournisseur": r[2], "date_facture": r[3].isoformat() if r[3] else None,
            "description": r[4], "categorie_oblf": r[5],
            "statut": r[6], "bien_id": str(r[7]) if r[7] else None,
        }
        for r in rows
    ]


@router.post("/generer-description", response_model=GenererDescriptionBienResponse)
async def generer_description_bien(
    payload: GenererDescriptionBienRequest,
    current_user: AuthUserDep,
    db: DbDep,
    _=rate_limit(10, 60),
):
    """Génère une description d'annonce + tags IA à partir des données du formulaire."""
    from anthropic import AsyncAnthropic
    from app.core.config import settings

    client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    equipements = []
    if payload.is_furnished:  equipements.append("meublé")
    if payload.has_parking:   equipements.append("parking")
    if payload.has_balcony:   equipements.append("balcon")
    if payload.has_terrace:   equipements.append("terrasse")
    if payload.has_garden:    equipements.append("jardin")
    if payload.pets_allowed:  equipements.append("animaux acceptés")

    type_fr = _TYPE_FR.get(payload.type, payload.type)
    tx_fr   = _TX_FR.get(payload.transaction_type, payload.transaction_type)

    prompt = f"""Tu es expert immobilier suisse. Génère pour cette annonce :

Bien : {type_fr} {tx_fr}
Ville : {payload.ville}
{'Surface : ' + str(payload.surface) + ' m²' if payload.surface else ''}
{'Pièces : ' + str(payload.pieces) if payload.pieces else ''}
{'Loyer : CHF ' + str(payload.prix) + '/mois' if payload.prix and payload.transaction_type != 'vente' else ''}
{'Prix : CHF ' + str(payload.prix) if payload.prix and payload.transaction_type == 'vente' else ''}
{'Équipements : ' + ', '.join(equipements) if equipements else ''}

Retourne UNIQUEMENT un JSON valide avec ce format exact :
{{
  "description": "Annonce attrayante de 120-200 mots en français, sans répéter les données brutes, avec un titre accrocheur en première ligne.",
  "tags_ia": ["tag1", "tag2", "tag3", "tag4", "tag5"]
}}

Les tags doivent être 5 adjectifs ou courtes expressions décrivant les atouts du bien.
Réponds UNIQUEMENT avec le JSON, aucun autre texte."""

    message = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=800,
        messages=[{"role": "user", "content": prompt}],
    )

    raw   = message.content[0].text.strip()  # type: ignore[union-attr]
    match = _re.search(r'\{.*\}', raw, _re.DOTALL)
    if not match:
        raise HTTPException(500, "Erreur de génération IA — réessayez")
    try:
        data = _json.loads(match.group())
    except _json.JSONDecodeError:
        raise HTTPException(500, "Erreur de parsing IA — réessayez")

    return GenererDescriptionBienResponse(
        description=data.get("description", ""),
        tags_ia=data.get("tags_ia", [])[:8],
    )
