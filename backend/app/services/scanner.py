"""
scanner.py — Cherche et importe TOUT ce qui existe sur un utilisateur Althy.

Principe fondamental :
  Claude lit le HTML de chaque page et extrait les données.
  Le code ne connaît pas la structure de chaque site.
  Claude s'adapte à tout automatiquement.
  Zéro code hardcodé pour un site spécifique.

Fonctionne pour :
  - Agences immobilières (cherche toutes leurs annonces sur tous les portails)
  - Propriétaires solos (cherche leurs annonces)
  - Ouvreurs (cherche leur profil, leurs missions passées)
  - Artisans (cherche leur profil, leurs réalisations)
  - Locataires / acheteurs (cherche leurs préférences si profil public)
"""
from __future__ import annotations
import asyncio, re, json
from dataclasses import dataclass, field
from typing import Optional
import httpx
from anthropic import AsyncAnthropic
from app.core.config import settings

claude = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Accept-Language": "fr-CH,fr;q=0.9",
}

# Portails immobiliers suisses à scanner
# IMPORTANT : ne jamais mettre ici le site propre de l'agence
# Le site propre est scanné séparément si fourni par l'utilisateur
PORTAILS_IMMO = [
    "https://www.homegate.ch/louer/immobilier/suisse?query={q}",
    "https://www.homegate.ch/acheter/immobilier/suisse?query={q}",
    "https://www.immoscout24.ch/fr/immobilier/louer/suisse?query={q}",
    "https://www.immoscout24.ch/fr/immobilier/acheter/suisse?query={q}",
    "https://www.immobilier.ch/fr/recherche?q={q}",
    "https://www.newhome.ch/fr/liste/louer?q={q}",
    "https://www.newhome.ch/fr/liste/acheter?q={q}",
    "https://flatfox.ch/fr/?query={q}",
    "https://www.anibis.ch/fr/s/immobilier?q={q}",
    "https://www.comparis.ch/immobilier/marche/offres/resultat?q={q}",
]

# Plateformes professionnelles pour ouvreurs / artisans
PORTAILS_PRO = [
    "https://www.local.ch/fr/q?what={q}&where=suisse",
    "https://www.search.ch/tel/?was={q}&wo=schweiz",
    "https://www.linkedin.com/pub/dir/{prenom}/{nom}",
    "https://www.monsite.ch/recherche?q={q}",
]


@dataclass
class ElementTrouve:
    """
    Représente n'importe quoi trouvé sur internet pour cet utilisateur.
    Peut être un bien immobilier, un profil, une réalisation, etc.
    On ne distingue pas par statut — tout est dans le même sac.
    L'utilisateur décidera quoi garder.
    """
    source_site:    str           # "Homegate", "ImmoScout24", "example.ch"...
    source_url:     str           # URL complète de la page
    source_id:      str           # ID trouvé dans l'URL ou généré
    type_element:   str           # "bien", "profil", "realisation", "article"
    titre:          str
    description:    str
    donnees_brutes: dict          # Tout ce que Claude a réussi à extraire
    photos:         list[str] = field(default_factory=list)
    confiance:      float = 1.0   # 0-1 : à quel point on est sûr que c'est lui


async def _fetch(client: httpx.AsyncClient, url: str) -> str:
    """Fetch HTML poli — attend entre chaque requête."""
    for attempt in range(3):
        try:
            await asyncio.sleep(0.8 + attempt * 0.5)
            r = await client.get(url, headers=HEADERS, timeout=15, follow_redirects=True)
            if r.status_code == 200:
                return r.text
            if r.status_code == 429:
                await asyncio.sleep(5)
        except Exception:
            await asyncio.sleep(2)
    return ""


async def _extraire_avec_claude(html: str, contexte_utilisateur: dict) -> dict:
    """
    Donne le HTML brut à Claude avec le contexte de l'utilisateur.
    Claude extrait TOUT ce qu'il trouve — sans filtre de statut, sans filtre de type.
    Si une info existe dans le HTML, Claude la sort.
    """
    # Nettoyer le HTML
    clean = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", html, flags=re.DOTALL | re.IGNORECASE)
    clean = re.sub(r"<!--.*?-->", "", clean, flags=re.DOTALL)
    clean = re.sub(r"\s+", " ", clean)
    clean = clean[:14000]  # Limite tokens

    nom_complet = f"{contexte_utilisateur.get('prenom', '')} {contexte_utilisateur.get('nom', '')}".strip()
    agence = contexte_utilisateur.get('agence_nom', '')
    identifiant = agence or nom_complet

    resp = await claude.messages.create(
        model      = "claude-sonnet-4-20250514",
        max_tokens = 3000,
        messages   = [{
            "role": "user",
            "content": f"""Tu analyses une page web pour trouver tout ce qui concerne : "{identifiant}".

Extrait ABSOLUMENT TOUT ce que tu trouves — annonces immobilières, profils,
descriptions, prix, photos, adresses, téléphones, emails, descriptions de biens,
caractéristiques, etc. Ne filtre rien. Même si le statut est "loué", "vendu",
"réservé" ou autre — inclure quand même.

Réponds UNIQUEMENT avec ce JSON (null si non trouvé) :
{{
  "elements_trouves": [
    {{
      "appartient_a_identifiant": true,
      "titre": "...",
      "description": "...",
      "prix": null,
      "prix_texte": "CHF 1'800 / mois",
      "surface": null,
      "pieces": null,
      "adresse": "...",
      "ville": "...",
      "type": "appartement|maison|studio|commercial|parking|terrain|profil|autre",
      "transaction": "location|vente|",
      "photos": ["url1", "url2"],
      "caracteristiques": ["balcon", "parking", "vue lac"],
      "contact": {{"telephone": null, "email": null}},
      "url_fiche": "...",
      "id_source": "...",
      "autres_infos": {{}}
    }}
  ],
  "profil_agence": {{
    "nom": null,
    "telephone": null,
    "email": null,
    "adresse_bureau": null,
    "description": null,
    "langues": [],
    "site_web": null
  }}
}}

HTML :
{clean}"""
        }]
    )

    text = resp.content[0].text.strip()
    text = re.sub(r"^```(?:json)?", "", text).rstrip("`").strip()
    try:
        return json.loads(text)
    except Exception:
        return {"elements_trouves": [], "profil_agence": {}}


async def _scraper_fiche(client: httpx.AsyncClient, url: str,
                          nom_site: str, contexte: dict) -> list[ElementTrouve]:
    """
    Scrape une fiche individuelle et extrait tout son contenu via Claude.
    """
    if not url or not url.startswith("http"):
        return []
    html = await _fetch(client, url)
    if not html:
        return []

    data = await _extraire_avec_claude(html, contexte)
    elements = []

    for el in data.get("elements_trouves", []):
        if not el.get("appartient_a_identifiant"):
            continue
        if not el.get("titre"):
            continue

        source_id = el.get("id_source") or ""
        if not source_id:
            m = re.search(r"/(\d+)/?$", url)
            source_id = m.group(1) if m else url[-20:].replace("/", "_")

        elements.append(ElementTrouve(
            source_site    = nom_site,
            source_url     = el.get("url_fiche") or url,
            source_id      = source_id,
            type_element   = "bien" if el.get("prix") or el.get("prix_texte") else "profil",
            titre          = el["titre"],
            description    = el.get("description") or "",
            donnees_brutes = el,
            photos         = el.get("photos") or [],
            confiance      = 1.0 if el.get("appartient_a_identifiant") else 0.6,
        ))

    return elements


async def scanner_tout(contexte: dict) -> list[ElementTrouve]:
    """
    Point d'entrée principal — scanner universel.

    contexte = {
        "prenom": "Jean",
        "nom": "Dupont",
        "agence_nom": "Agence Demo",       # optionnel
        "ville": "Genève",
        "site_web": "https://example.ch",  # optionnel — site propre
        "email": "jean@example.ch",        # optionnel
        "telephone": "+41 22 000 00 00",   # optionnel
        "role": "agence",                  # agence|proprio_solo|opener|artisan|locataire
    }
    """
    role       = contexte.get("role", "")
    agence_nom = contexte.get("agence_nom", "")
    prenom     = contexte.get("prenom", "")
    nom        = contexte.get("nom", "")
    ville      = contexte.get("ville", "")
    site_web   = contexte.get("site_web", "")

    # Construire les termes de recherche selon ce qu'on a
    queries = []
    if agence_nom:
        queries.append(agence_nom)
        queries.append(f"{agence_nom} {ville}")
    if prenom and nom:
        queries.append(f"{prenom} {nom}")
        queries.append(f"{prenom} {nom} {ville}")

    tous_les_elements: list[ElementTrouve] = []
    urls_deja_visitees: set[str] = set()

    async with httpx.AsyncClient() as client:

        # 1. Scanner le site propre en priorité (si fourni)
        if site_web:
            print(f"  🌐 Site propre : {site_web}")
            html = await _fetch(client, site_web)
            if html:
                data = await _extraire_avec_claude(html, contexte)

                # Extraire les URLs de fiches depuis la page d'accueil
                urls_fiches = []
                for el in data.get("elements_trouves", []):
                    if el.get("url_fiche") and el["url_fiche"] not in urls_deja_visitees:
                        urls_fiches.append(el["url_fiche"])

                # Pour les agences : scanner aussi les pages de listing
                if role in ("agence", "portail_proprio"):
                    pages_listing = [
                        f"{site_web.rstrip('/')}/fr/proprietes?type=1",
                        f"{site_web.rstrip('/')}/fr/proprietes?type=2",
                        f"{site_web.rstrip('/')}/location",
                        f"{site_web.rstrip('/')}/vente",
                        f"{site_web.rstrip('/')}/annonces",
                    ]
                    for page_url in pages_listing:
                        html_page = await _fetch(client, page_url)
                        if not html_page:
                            continue
                        data_page = await _extraire_avec_claude(html_page, contexte)
                        for el in data_page.get("elements_trouves", []):
                            if el.get("url_fiche") and el["url_fiche"] not in urls_deja_visitees:
                                urls_fiches.append(el["url_fiche"])

                # Scraper chaque fiche trouvée
                for url_fiche in list(dict.fromkeys(urls_fiches))[:100]:  # max 100 fiches
                    if url_fiche in urls_deja_visitees:
                        continue
                    urls_deja_visitees.add(url_fiche)
                    elements = await _scraper_fiche(client, url_fiche, site_web, contexte)
                    tous_les_elements.extend(elements)

        # 2. Scanner les portails immobiliers suisses
        # (uniquement pour agences, proprios, et si pas trop de résultats déjà)
        if role in ("agence", "proprio_solo", "portail_proprio") or len(tous_les_elements) < 5:
            for portail_url_template in PORTAILS_IMMO:
                for query in queries[:2]:  # max 2 queries par portail
                    url_recherche = portail_url_template.format(
                        q=query.replace(" ", "+")
                    )
                    print(f"  🔍 {url_recherche[:60]}...")
                    html = await _fetch(client, url_recherche)
                    if not html:
                        continue

                    data = await _extraire_avec_claude(html, contexte)
                    nom_portail = url_recherche.split("/")[2].replace("www.", "")

                    # Collecter les URLs de fiches et les scraper
                    for el in data.get("elements_trouves", []):
                        if not el.get("appartient_a_identifiant"):
                            continue
                        url_fiche = el.get("url_fiche", "")
                        if not url_fiche or url_fiche in urls_deja_visitees:
                            continue
                        urls_deja_visitees.add(url_fiche)
                        elements = await _scraper_fiche(client, url_fiche, nom_portail, contexte)
                        tous_les_elements.extend(elements)

        # 3. Scanner les plateformes pro (ouvreurs, artisans)
        if role in ("opener", "artisan", "expert"):
            for portail_url_template in PORTAILS_PRO:
                url = portail_url_template.format(
                    q=f"{prenom}+{nom}+{ville}",
                    prenom=prenom.lower(),
                    nom=nom.lower(),
                )
                html = await _fetch(client, url)
                if not html:
                    continue
                data = await _extraire_avec_claude(html, contexte)
                nom_portail = url.split("/")[2].replace("www.", "")
                for el in data.get("elements_trouves", []):
                    if el.get("appartient_a_identifiant"):
                        tous_les_elements.append(ElementTrouve(
                            source_site    = nom_portail,
                            source_url     = el.get("url_fiche") or url,
                            source_id      = el.get("id_source") or url[-15:],
                            type_element   = "profil",
                            titre          = el.get("titre") or f"{prenom} {nom}",
                            description    = el.get("description") or "",
                            donnees_brutes = el,
                            photos         = el.get("photos") or [],
                        ))

    # Dédupliquer
    vus = set()
    result = []
    for el in tous_les_elements:
        cle = f"{el.source_id}:{el.titre[:20]}"
        if cle not in vus:
            vus.add(cle)
            result.append(el)

    print(f"  ✅ Total trouvé : {len(result)} éléments")
    return result
