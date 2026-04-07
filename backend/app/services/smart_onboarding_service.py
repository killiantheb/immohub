"""
Smart Onboarding Service — Althy détecte et cherche tout
Deux modes : vocal (transcript) ou manuel (boutons)
"""

from __future__ import annotations

import asyncio
import json
import re

from anthropic import AsyncAnthropic
from app.core.config import settings

client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
MODEL = "claude-sonnet-4-5"


async def detect_profile_from_speech(transcript: str) -> dict:
    """Analyse ce que l'utilisateur a dit et extrait son profil."""
    response = await client.messages.create(
        model=MODEL,
        max_tokens=600,
        messages=[{"role": "user", "content": f"""
Tu es Althy, assistant immobilier suisse. Un nouvel utilisateur vient de parler.
Analyse et extrait les informations.

Texte : "{transcript}"

Retourne UNIQUEMENT ce JSON :
{{
  "role": "owner|agency|company|opener|tenant",
  "name": "nom ou nom entreprise extrait",
  "website": null,
  "email": null,
  "phone": null,
  "location": null,
  "uid_number": null,
  "confidence": 0.0,
  "althy_response": "réponse courte d'Althy confirmant en 1 phrase"
}}

Règles rôle :
- agence, gérance, portefeuille, biens gérés → agency
- artisan, électricien, plombier, peintre, entrepreneur → company
- ouvreur, je fais des visites → opener
- locataire, je loue → tenant
- sinon → owner
"""}]
    )
    text = response.content[0].text
    match = re.search(r'\{[\s\S]*?\}', text)
    if match:
        try:
            return json.loads(match.group())
        except Exception:
            pass
    return {
        "role": "owner",
        "name": None,
        "confidence": 0.0,
        "althy_response": "Pouvez-vous me donner votre nom ?",
    }


async def deep_search(
    role: str,
    name: str,
    website: str | None = None,
    uid: str | None = None,
    location: str | None = None,
    email: str | None = None,
    phone: str | None = None,
) -> dict:
    """
    Recherche exhaustive selon le rôle.
    Utilise web_search pour trouver toutes les infos publiques disponibles.
    """

    if role == "agency":
        search_prompt = f"""
Fais une recherche exhaustive sur cette agence immobilière suisse.

Agence : {name}
{f'Site web : {website}' if website else ''}
{f'UID/TVA : {uid}' if uid else ''}
{f'Localité : {location}' if location else ''}

Cherche dans cet ordre :
1. zefix.ch → UID officiel, forme juridique, adresse légale, date création, dirigeants
2. Leur site web → description, équipe, zones, spécialités, contact, logo
3. Google Maps → note, avis, adresse exacte, horaires, photos
4. ImmoScout24 + Homegate → annonces actives, types de biens, zones
5. LinkedIn → taille équipe, fondateurs
6. USPI ou associations professionnelles CH
7. local.ch + search.ch → coordonnées vérifiées

Retourne ce JSON complet (null si introuvable) :
{{
  "agency_name": null, "legal_form": null, "uid_number": null,
  "vat_number": null, "registration_date": null, "directors": [],
  "address": null, "city": null, "postal_code": null, "canton": null,
  "phone": null, "email": null, "website": null, "logo_url": null,
  "description": null, "team_size": null, "founding_year": null,
  "specialties": [], "zones_served": [], "active_listings_count": null,
  "portals_used": [], "google_rating": null, "google_reviews_count": null,
  "linkedin_url": null, "certifications": [], "languages": [],
  "confidence_score": 0.0, "sources_found": [], "notes": "résumé"
}}
UNIQUEMENT le JSON."""

    elif role == "company":
        search_prompt = f"""
Fais une recherche exhaustive sur cette entreprise artisanale suisse.

Entreprise : {name}
{f'Site : {website}' if website else ''}
{f'UID : {uid}' if uid else ''}
{f'Localité : {location}' if location else ''}

Cherche :
1. zefix.ch → données légales, UID, forme juridique
2. Google Maps → avis, note, photos, services
3. Leur site web
4. local.ch, search.ch
5. Annuaires métier suisses
6. suissetec.ch, electrosuisse.ch selon la spécialité

Retourne ce JSON :
{{
  "company_name": null, "legal_form": null, "uid_number": null,
  "vat_number": null, "registration_date": null,
  "address": null, "city": null, "postal_code": null, "canton": null,
  "phone": null, "email": null, "website": null, "logo_url": null,
  "description": null, "specialties": [], "service_radius_km": null,
  "service_zones": [], "google_rating": null, "google_reviews_count": null,
  "founding_year": null, "team_size": null, "certifications": [],
  "professional_associations": [], "insurance_verified": false,
  "confidence_score": 0.0, "sources_found": [], "notes": "résumé"
}}
UNIQUEMENT le JSON."""

    elif role == "owner":
        search_prompt = f"""
Recherche des informations PUBLIQUES sur ce propriétaire immobilier en Suisse.

Nom : {name}
{f'Email : {email}' if email else ''}
{f'Localité : {location}' if location else ''}

Cherche uniquement des sources publiques :
- LinkedIn profil public
- Pages jaunes / annuaires suisses
- Résultats Google publics

Retourne ce JSON :
{{
  "first_name": null, "last_name": null,
  "phone": null, "city": null, "postal_code": null, "canton": null,
  "language": "fr", "linkedin_url": null, "professional_background": null,
  "confidence_score": 0.0, "notes": "résumé"
}}
UNIQUEMENT le JSON."""

    else:  # opener, tenant
        parts = (name or "").strip().split()
        return {
            "first_name": parts[0] if parts else name,
            "last_name": parts[-1] if len(parts) > 1 else None,
            "phone": phone,
            "city": location,
            "languages": ["fr"],
            "radius_km": 10,
            "confidence_score": 0.5,
            "notes": "Profil créé — complétez vos disponibilités",
        }

    try:
        response = await asyncio.wait_for(
            client.messages.create(
                model=MODEL,
                max_tokens=3000,
                tools=[{"type": "web_search_20250305", "name": "web_search"}],
                messages=[{"role": "user", "content": search_prompt}],
            ),
            timeout=45,
        )
        full_text = "".join(b.text for b in response.content if hasattr(b, "text"))
    except Exception:
        # web_search unavailable or timeout → fallback without tool
        try:
            response = await asyncio.wait_for(
                client.messages.create(
                    model=MODEL,
                    max_tokens=1500,
                    messages=[{"role": "user", "content": search_prompt + "\n\nUtilise uniquement tes connaissances générales, sans recherche web."}],
                ),
                timeout=30,
            )
            full_text = "".join(b.text for b in response.content if hasattr(b, "text"))
        except Exception:
            return {"confidence_score": 0.1, "notes": "Recherche indisponible — complétez manuellement"}

    match = re.search(r'\{[\s\S]*\}', full_text)
    if match:
        try:
            return json.loads(match.group())
        except Exception:
            pass
    return {
        "confidence_score": 0.1,
        "notes": "Recherche partielle — complétez manuellement",
    }
