/**
 * Composant serveur partagé pour les pages SEO par ville.
 * Utilisé par /biens/geneve, /biens/lausanne, /biens/fribourg,
 * /biens/neuchatel, /biens/sion, /biens/vaud, /biens/valais.
 * Pré-fetche les biens côté serveur pour le crawl Google.
 */

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { VilleMap } from "./VilleMap";
import { C } from "@/lib/design-tokens";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
const BASE = "https://althy.ch";

// ── Config villes ─────────────────────────────────────────────────────────────

export interface VilleConfig {
  slug: string;
  label: string;
  labelLong: string;
  searchTerm: string;
  canton: string;
  description: string;   // meta description courte
  stats: { nb: number; prixMoyen: number; typePrincipal: string };
  map: { lng: number; lat: number; zoom: number };
  quartiers: string[];
  texte_seo: string[];   // paragraphes ~200 mots au total
}

export const VILLES: Record<string, VilleConfig> = {
  geneve: {
    slug: "geneve",
    label: "Genève",
    labelLong: "Genève",
    searchTerm: "Genève",
    canton: "GE",
    description:
      "Trouvez votre appartement ou maison à louer à Genève. Biens vérifiés, dossier locataire IA, caution sécurisée.",
    stats: { nb: 47, prixMoyen: 2400, typePrincipal: "Appartements" },
    map: { lng: 6.143, lat: 46.204, zoom: 12.5 },
    quartiers: ["Pâquis", "Plainpalais", "Eaux-Vives", "Carouge", "Champel", "Meyrin"],
    texte_seo: [
      "Genève est l'une des villes les plus cosmopolites de Suisse, reconnue mondialement pour ses organisations internationales, son secteur bancaire et sa qualité de vie exceptionnelle. Le marché locatif genevois est parmi les plus tendus du pays : la demande dépasse constamment l'offre, notamment dans les quartiers des Pâquis, Plainpalais, Eaux-Vives et Carouge.",
      "Les appartements genevois se concentrent dans des immeubles de style haussmannien ou dans de nouvelles constructions aux standards énergétiques élevés. La rive gauche (Saint-Gervais, Plainpalais) est appréciée des jeunes actifs, tandis que Champel et Cologny attirent les familles. Le réseau TPG couvre l'ensemble de l'agglomération avec trams et bus, prolongé vers la France via le RER franco-suisse.",
      "Avec Althy, postulez à des logements genevois directement en ligne : dossier locataire IA validé en quelques secondes, caution simplifiée conforme au Code des obligations suisse (max. 3 mois de loyer), et ouvreurs disponibles pour organiser les visites.",
    ],
  },
  lausanne: {
    slug: "lausanne",
    label: "Lausanne",
    labelLong: "Lausanne",
    searchTerm: "Lausanne",
    canton: "VD",
    description:
      "Appartements et maisons à louer à Lausanne. Dossier digital, scoring IA, caution simplifiée — Althy, l'assistant immobilier suisse.",
    stats: { nb: 83, prixMoyen: 1950, typePrincipal: "Appartements" },
    map: { lng: 6.632, lat: 46.519, zoom: 12.5 },
    quartiers: ["Flon", "Ouchy", "Sauci", "Chailly", "Sébeillon", "Pully"],
    texte_seo: [
      "Lausanne, capitale olympique et ville estudiantine par excellence, offre un cadre de vie dynamique entre lac Léman et vignobles de Lavaux classés UNESCO. La demande locative est soutenue par les quelque 50 000 étudiants des hautes écoles (UNIL, EPFL, ECAL) et par les milliers d'actifs qui rejoignent la métropole vaudoise chaque année.",
      "Les quartiers du Flon et de Sébeillon concentrent une offre d'appartements modernes, tandis que Chailly et Pully séduisent les familles en quête de calme. Le métro m2 relie la gare CFF au bord du lac en quelques minutes, et le réseau TL couvre l'ensemble de l'agglomération avec des fréquences élevées.",
      "Grâce à Althy, trouvez votre appartement à Lausanne sans intermédiaire superflu : annonces vérifiées, dossier numérique complet, scoring IA instantané, et visite organisée avec un ouvreur local si le propriétaire est absent. Frais de dossier uniquement si vous êtes retenu.",
    ],
  },
  fribourg: {
    slug: "fribourg",
    label: "Fribourg",
    labelLong: "Fribourg",
    searchTerm: "Fribourg",
    canton: "FR",
    description:
      "Appartements et maisons à louer à Fribourg. Canton bilingue, prix accessibles — trouvez votre logement avec Althy.",
    stats: { nb: 31, prixMoyen: 1450, typePrincipal: "Appartements" },
    map: { lng: 7.161, lat: 46.806, zoom: 12.5 },
    quartiers: ["Vieille Ville", "Pérolles", "Beaumont", "Granges-Paccot", "Villars-sur-Glâne", "Givisiez"],
    texte_seo: [
      "Fribourg, cité bilingue au carrefour des cultures romande et alémanique, séduit par son charme médiéval, son université réputée et ses loyers parmi les plus accessibles de Suisse romande. La vieille ville, perchée sur un éperon rocheux dominant la Sarine, est classée au patrimoine suisse et attire résidents et touristes du monde entier.",
      "Les quartiers résidentiels de Pérolles, Beaumont et la commune de Villars-sur-Glâne offrent une large palette d'appartements familiaux à des prix raisonnables, bien en dessous des standards genevois ou lausannois. La gare CFF relie Berne en 23 minutes et Lausanne en 45 minutes — idéal pour les pendulaires.",
      "Althy répertorie les meilleures offres locatives de Fribourg, vérifiées directement auprès des propriétaires et agences certifiés. Que vous soyez étudiant, famille ou actif, notre assistant IA vous guide vers le logement idéal. Publiez votre bien gratuitement et touchez des milliers de candidats locataires scorés.",
    ],
  },
  neuchatel: {
    slug: "neuchatel",
    label: "Neuchâtel",
    labelLong: "Neuchâtel",
    searchTerm: "Neuchâtel",
    canton: "NE",
    description:
      "Logements à louer dans le canton de Neuchâtel. Appartements, studios et maisons disponibles — Althy, votre assistant immobilier suisse.",
    stats: { nb: 24, prixMoyen: 1350, typePrincipal: "Appartements" },
    map: { lng: 6.931, lat: 46.992, zoom: 12.5 },
    quartiers: ["La Coudre", "Le Mail", "Maladière", "Peseux", "Hauterive", "Auvernier"],
    texte_seo: [
      "Neuchâtel, joyau au bord du lac éponyme, combine patrimoine historique, industries high-tech (horlogerie, microtechnique, CSEM) et cadre naturel exceptionnel. La ville attire de jeunes actifs travaillant pour des entreprises de pointe comme Swatch Group, ou pour les institutions cantonales et l'Université de Neuchâtel.",
      "Le marché locatif est moins tendu qu'à Genève ou Lausanne, avec des appartements disponibles dans les quartiers de la Coudre, du Mail et à Hauterive. Les communes environnantes d'Auvernier et Peseux offrent des logements compétitifs avec vue sur le lac. Le train relie Berne en 45 minutes et Lausanne en 1h10.",
      "Avec Althy, parcourez les annonces locatives de Neuchâtel et postulez en ligne en 2 minutes : dossier numérique, scoring IA, visite facilitée par nos ouvreurs locaux. Propriétaires neuchâtelois — publiez gratuitement et trouvez votre locataire idéal rapidement.",
    ],
  },
  sion: {
    slug: "sion",
    label: "Sion",
    labelLong: "Sion",
    searchTerm: "Sion",
    canton: "VS",
    description:
      "Appartements à louer à Sion, capitale du Valais. Prix accessibles, soleil garanti, accès ski & nature — Althy, votre assistant immobilier suisse.",
    stats: { nb: 19, prixMoyen: 1350, typePrincipal: "Appartements" },
    map: { lng: 7.359, lat: 46.233, zoom: 12.5 },
    quartiers: ["La Planta", "Châteauneuf", "Uvrier", "Saint-Léonard", "Bramois", "Salins"],
    texte_seo: [
      "Sion, capitale ensoleillée du Valais (plus de 300 jours de soleil par an), est nichée entre les sommets alpins et les vignobles en terrasses classés UNESCO. Elle constitue une base idéale pour les amateurs de ski (Crans-Montana, Verbier, 4 Vallées) et de randonnée alpine, tout en offrant tous les services d'une ville cantonale dynamique.",
      "Le marché locatif sionois est accessible et diversifié, avec de nouveaux quartiers résidentiels en développement autour de la Planta et de Châteauneuf. La gare CFF relie Lausanne en 1h30 et Brig en 45 minutes via la ligne du Simplon. L'aéroport régional de Sion dessert quelques destinations européennes.",
      "Grâce à Althy, découvrez les appartements disponibles à Sion et dans les communes valaisannes alentour. Dossier locataire digitalisé, scoring IA en secondes, caution simplifiée — trouver un logement en Valais n'a jamais été aussi rapide. Estimez également votre bien immobilier gratuitement.",
    ],
  },
  vaud: {
    slug: "vaud",
    label: "Vaud",
    labelLong: "Canton de Vaud",
    searchTerm: "Vaud",
    canton: "VD",
    description:
      "Location immobilière dans le canton de Vaud. Lausanne, Morges, Nyon, Yverdon — trouvez votre logement avec Althy.",
    stats: { nb: 124, prixMoyen: 1800, typePrincipal: "Appartements & Maisons" },
    map: { lng: 6.632, lat: 46.519, zoom: 10 },
    quartiers: ["Morges", "Nyon", "Yverdon", "Aigle", "Vevey", "Montreux"],
    texte_seo: [
      "Le canton de Vaud, deuxième canton le plus peuplé de Suisse romande, offre une diversité immobilière exceptionnelle : appartements urbains à Lausanne, villas avec vue sur le lac à Morges ou Nyon, maisons familiales à Yverdon ou Aigle. Le marché vaudois séduit par son équilibre entre accessibilité des prix et qualité de vie.",
      "Les axes ferroviaires CFF relient rapidement les principales villes vaudoises à Genève, Lausanne et Berne, faisant du canton un choix privilégié pour les pendulaires. Les rives du lac Léman concentrent les loyers les plus élevés, tandis que l'arrière-pays offre des opportunités bien plus accessibles.",
      "Althy couvre l'ensemble du canton de Vaud avec des annonces vérifiées, un scoring locataire IA et des ouvreurs disponibles pour les visites. Publiez votre bien gratuitement et profitez d'une visibilité maximale auprès de milliers de candidats locataires.",
    ],
  },
  valais: {
    slug: "valais",
    label: "Valais",
    labelLong: "Valais",
    searchTerm: "Sion",
    canton: "VS",
    description:
      "Location immobilière en Valais. Sion, Sierre, Martigny, Verbier — appartements et chalets disponibles sur Althy.",
    stats: { nb: 19, prixMoyen: 1300, typePrincipal: "Appartements & Chalets" },
    map: { lng: 7.359, lat: 46.233, zoom: 10 },
    quartiers: ["Sion", "Sierre", "Martigny", "Monthey", "Verbier", "Crans-Montana"],
    texte_seo: [
      "Le Valais, canton alpin aux multiples facettes, conjugue culture latine et germanophone, vignobles réputés (Fendant, Pinot noir) et stations de ski de renommée mondiale. Le marché locatif valaisan est l'un des plus accessibles de Suisse romande, avec une forte demande saisonnière dans les stations et une offre permanente dans les plaines du Rhône.",
      "Sion, capitale cantonale, concentre l'essentiel de l'offre d'appartements permanents. Sierre et Martigny offrent des alternatives compétitives avec un accès direct aux autoroutes et aux lignes CFF. Les stations comme Verbier ou Crans-Montana proposent des locations saisonnières très recherchées.",
      "Avec Althy, trouvez votre logement en Valais facilement : annonces vérifiées, dossier numérique et caution conforme au droit suisse. Propriétaires valaisans — publiez gratuitement et gérez vos biens depuis votre téléphone, en français ou en allemand.",
    ],
  },
};

// ── Metadata factory ──────────────────────────────────────────────────────────

export function makeVilleMetadata(slug: string): Metadata {
  const cfg = VILLES[slug];
  if (!cfg) return {};
  const count = cfg.stats.nb;
  return {
    title: `Appartements à louer à ${cfg.labelLong} | Althy`,
    description: `Trouvez votre logement à ${cfg.labelLong}. ${count}+ biens disponibles sur Althy, l'assistant immobilier suisse.`,
    alternates: { canonical: `${BASE}/biens/${slug}` },
    openGraph: {
      title: `Appartements à louer à ${cfg.labelLong} — Althy`,
      description: `Trouvez votre logement à ${cfg.labelLong}. ${count}+ biens disponibles, dossier IA, caution simplifiée.`,
      url: `${BASE}/biens/${slug}`,
      siteName: "Althy",
      locale: "fr_CH",
      type: "website",
      images: [{ url: `${BASE}/og-default.jpg`, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: `Appartements à louer à ${cfg.labelLong} — Althy`,
      description: `${count}+ logements à louer à ${cfg.labelLong}. Althy, l'assistant immobilier suisse.`,
    },
    keywords: [
      `appartement à louer ${cfg.label}`,
      `location ${cfg.label}`,
      `logement ${cfg.label}`,
      `louer appartement ${cfg.label}`,
      `immobilier ${cfg.label}`,
      `logement ${cfg.label} Suisse`,
      `Althy ${cfg.label}`,
    ],
  };
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Bien {
  id: string;
  titre: string;
  transaction_type: string;
  prix: number | null;
  adresse_affichee: string;
  ville: string;
  surface: number | null;
  pieces: number | null;
  type_label: string;
  cover: string | null;
  tags_ia: string[];
  is_premium: boolean;
}

// ── BienCard ──────────────────────────────────────────────────────────────────

function BienCard({ bien }: { bien: Bien }) {
  const prixStr = bien.prix
    ? new Intl.NumberFormat("fr-CH", {
        style: "currency",
        currency: "CHF",
        maximumFractionDigits: 0,
      }).format(bien.prix)
    : "";

  return (
    <Link
      href={`/biens/${bien.id}`}
      style={{
        display: "block",
        background: "#fff",
        border: "1px solid var(--althy-border)",
        borderRadius: 12,
        overflow: "hidden",
        textDecoration: "none",
        transition: "box-shadow 0.15s",
      }}
    >
      <div style={{ position: "relative", height: 180 }}>
        {bien.cover ? (
          <Image
            src={bien.cover}
            alt={bien.titre}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            style={{ objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              height: "100%",
              background: "linear-gradient(135deg, #FEF2EB 0%, rgba(232,96,44,0.1) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 40,
            }}
          >
            🏠
          </div>
        )}
        {bien.is_premium && (
          <span style={{
            position: "absolute", top: 10, right: 10,
            background: "var(--althy-warning)", color: "#fff",
            fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 4,
          }}>
            ★ Premium
          </span>
        )}
        <span style={{
          position: "absolute", top: 10, left: 10,
          background: C.orange, color: "#fff",
          fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 4,
        }}>
          Location
        </span>
      </div>
      <div style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: "var(--althy-text-3)" }}>{bien.type_label}</span>
          {prixStr && (
            <span style={{ fontSize: 16, fontWeight: 700, color: C.orange }}>
              {prixStr}
              <span style={{ fontSize: 11, fontWeight: 400, color: "var(--althy-text-3)" }}>/mois</span>
            </span>
          )}
        </div>
        <p style={{
          fontSize: 14, fontWeight: 600, color: "var(--althy-text)",
          margin: "0 0 6px", overflow: "hidden",
          textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {bien.titre}
        </p>
        <div style={{ fontSize: 12, color: "var(--althy-text-3)", marginBottom: 8 }}>
          📍 {bien.adresse_affichee}
          {bien.surface && <span> · {bien.surface}m²</span>}
          {bien.pieces && <span> · {bien.pieces}p.</span>}
        </div>
        {bien.tags_ia.length > 0 && (
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {bien.tags_ia.slice(0, 3).map((t) => (
              <span key={t} style={{
                background: "rgba(232,96,44,0.08)", color: C.orange,
                fontSize: 10, padding: "2px 7px", borderRadius: 20,
              }}>
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

// ── Page principale (Server Component) ───────────────────────────────────────

export async function VillePageShared({ slug }: { slug: string }) {
  const cfg = VILLES[slug];
  if (!cfg) return null;

  let biens: Bien[] = [];
  let total = 0;
  try {
    const data = await fetch(
      `${API}/marketplace/biens?ville=${encodeURIComponent(cfg.searchTerm)}&size=20`,
      { next: { revalidate: 300 } }
    ).then((r) => r.json());
    biens = data.items ?? [];
    total = data.total ?? 0;
  } catch {
    // graceful degradation
  }

  // ── JSON-LD ──────────────────────────────────────────────────────────────────
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SearchResultsPage",
    "name": `Appartements et logements à louer à ${cfg.labelLong} — Althy`,
    "description": `Trouvez votre logement à ${cfg.labelLong}. ${total || cfg.stats.nb}+ biens disponibles sur Althy.`,
    "url": `${BASE}/biens/${slug}`,
    "breadcrumb": {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Accueil", "item": BASE },
        { "@type": "ListItem", "position": 2, "name": "Biens", "item": `${BASE}/biens` },
        { "@type": "ListItem", "position": 3, "name": cfg.labelLong, "item": `${BASE}/biens/${slug}` },
      ],
    },
    "mainEntity": {
      "@type": "ItemList",
      "numberOfItems": total,
      "itemListElement": biens.slice(0, 10).map((b, i) => ({
        "@type": "ListItem",
        "position": i + 1,
        "name": b.titre,
        "url": `${BASE}/biens/${b.id}`,
        "item": {
          "@type": "Accommodation",
          "name": b.titre,
          "url": `${BASE}/biens/${b.id}`,
          "numberOfRooms": b.pieces,
          ...(b.surface && {
            "floorSize": { "@type": "QuantitativeValue", "value": b.surface, "unitCode": "MTK" },
          }),
          "address": {
            "@type": "PostalAddress",
            "addressLocality": b.ville,
            "addressRegion": cfg.canton,
            "addressCountry": "CH",
          },
          ...(b.prix && {
            "offers": {
              "@type": "Offer",
              "price": b.prix, "priceCurrency": "CHF",
              "priceSpecification": {
                "@type": "UnitPriceSpecification",
                "price": b.prix, "priceCurrency": "CHF", "unitText": "MON",
              },
            },
          }),
        },
      })),
    },
  };

  return (
    <>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div style={{ minHeight: "100vh", background: "var(--althy-bg)" }}>

        {/* Header */}
        <header style={{
          background: "#fff", borderBottom: "1px solid var(--althy-border)",
          padding: "0 24px", height: 56,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <Link href="/" style={{ textDecoration: "none" }}>
            <span style={{
              fontFamily: "var(--font-serif)", fontSize: 20,
              fontWeight: 300, color: "var(--althy-text)", letterSpacing: "0.05em",
            }}>
              ALT<span style={{ color: C.orange }}>H</span>Y
            </span>
          </Link>
          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/biens" style={{
              fontSize: 13, padding: "6px 14px", borderRadius: 8,
              border: "1px solid var(--althy-border)", color: "var(--althy-text-2)", textDecoration: "none",
            }}>
              ← Tous les biens
            </Link>
            <Link href="/login" style={{
              fontSize: 13, padding: "6px 14px", borderRadius: 8,
              background: C.orange, color: "#fff", textDecoration: "none", fontWeight: 500,
            }}>
              Se connecter
            </Link>
          </div>
        </header>

        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 20px 80px" }}>

          {/* Breadcrumb */}
          <nav aria-label="Fil d'ariane" style={{ fontSize: 13, color: "var(--althy-text-3)", marginBottom: 24 }}>
            <Link href="/" style={{ color: "var(--althy-text-3)", textDecoration: "none" }}>Althy</Link>
            {" › "}
            <Link href="/biens" style={{ color: "var(--althy-text-3)", textDecoration: "none" }}>Biens</Link>
            {" › "}
            <span style={{ color: "var(--althy-text)" }}>{cfg.labelLong}</span>
          </nav>

          {/* H1 */}
          <h1 style={{
            fontFamily: "var(--font-serif)",
            fontSize: "clamp(26px, 5vw, 40px)",
            fontWeight: 300, color: "var(--althy-text)", marginBottom: 12,
          }}>
            Appartements et logements à louer à {cfg.labelLong} — Althy
          </h1>
          <p style={{ fontSize: 16, color: "var(--althy-text-2)", maxWidth: 640, marginBottom: 28, lineHeight: 1.6 }}>
            {cfg.description}
          </p>

          {/* Quartiers pills */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 32 }}>
            {cfg.quartiers.map((q) => (
              <span key={q} style={{
                fontSize: 12, padding: "5px 12px", borderRadius: 20,
                background: "rgba(232,96,44,0.07)", color: C.orange,
                border: "1px solid rgba(232,96,44,0.2)", fontWeight: 500,
              }}>
                {q}
              </span>
            ))}
          </div>

          {/* Stats */}
          <div style={{ display: "flex", gap: 14, marginBottom: 40, flexWrap: "wrap" }}>
            {[
              { label: "Biens disponibles", value: `${total || cfg.stats.nb}+` },
              { label: "Loyer moyen", value: `CHF ${cfg.stats.prixMoyen.toLocaleString("fr-CH")}/mois` },
              { label: "Type principal", value: cfg.stats.typePrincipal },
              { label: "Canton", value: cfg.canton },
            ].map((stat) => (
              <div key={stat.label} style={{
                background: "#fff", border: "1px solid var(--althy-border)",
                borderRadius: 12, padding: "16px 20px", minWidth: 140,
              }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: C.orange, marginBottom: 2 }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: 12, color: "var(--althy-text-3)" }}>{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Layout : biens + carte côte à côte (desktop) */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 32, alignItems: "start" }}>

            {/* Colonne gauche : grille biens */}
            <div>
              {biens.length > 0 ? (
                <>
                  <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--althy-text)", marginBottom: 20 }}>
                    {total} bien{total !== 1 ? "s" : ""} disponible{total !== 1 ? "s" : ""} à {cfg.labelLong}
                  </h2>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                    gap: 18, marginBottom: 28,
                  }}>
                    {biens.map((b) => <BienCard key={b.id} bien={b} />)}
                  </div>
                  {total > biens.length && (
                    <div style={{ textAlign: "center", marginBottom: 12 }}>
                      <Link href={`/biens?ville=${encodeURIComponent(cfg.searchTerm)}`} style={{
                        display: "inline-block", background: C.orange, color: "#fff",
                        padding: "12px 28px", borderRadius: 8, textDecoration: "none",
                        fontSize: 15, fontWeight: 600,
                      }}>
                        Voir tous les {total} biens →
                      </Link>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ textAlign: "center", padding: "40px 20px", background: "#fff", borderRadius: 12, border: "1px solid var(--althy-border)" }}>
                  <p style={{ color: "var(--althy-text-3)", marginBottom: 20 }}>
                    Aucun bien disponible pour le moment. Revenez bientôt !
                  </p>
                  <Link href="/biens" style={{
                    background: C.orange, color: "#fff", padding: "12px 24px",
                    borderRadius: 8, textDecoration: "none", fontWeight: 600,
                  }}>
                    Voir tous les biens
                  </Link>
                </div>
              )}
            </div>

            {/* Colonne droite : carte + CTA proprio */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 20 }}>

              {/* Carte Mapbox */}
              <div style={{
                background: "#fff", border: "1px solid var(--althy-border)",
                borderRadius: 12, overflow: "hidden",
              }}>
                <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--althy-border)" }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--althy-text)" }}>
                    Carte de {cfg.labelLong}
                  </p>
                </div>
                <VilleMap
                  lng={cfg.map.lng}
                  lat={cfg.map.lat}
                  zoom={cfg.map.zoom}
                  label={cfg.labelLong}
                />
              </div>

              {/* CTA Propriétaire */}
              <div style={{
                background: "#fff", border: "1.5px solid rgba(232,96,44,0.3)",
                borderRadius: 12, padding: "20px 18px",
              }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--althy-text)", margin: "0 0 6px" }}>
                  Vous êtes propriétaire à {cfg.labelLong} ?
                </p>
                <p style={{ fontSize: 12, color: "var(--althy-text-3)", margin: "0 0 14px", lineHeight: 1.5 }}>
                  Publiez votre bien gratuitement et trouvez un locataire scoré par IA en quelques jours.
                </p>
                <Link href="/register?role=proprio_solo" style={{
                  display: "block", textAlign: "center",
                  background: C.orange, color: "#fff",
                  padding: "10px 0", borderRadius: 8,
                  textDecoration: "none", fontSize: 13, fontWeight: 600,
                  marginBottom: 8,
                }}>
                  Publiez votre bien gratuitement →
                </Link>
                <Link href="/estimation" style={{
                  display: "block", textAlign: "center",
                  background: "#fff", border: "1px solid var(--althy-border)", color: "var(--althy-text)",
                  padding: "10px 0", borderRadius: 8,
                  textDecoration: "none", fontSize: 13,
                }}>
                  Estimez votre bien
                </Link>
              </div>
            </div>
          </div>

          {/* SEO text bloc */}
          <section style={{
            background: "#fff", border: "1px solid var(--althy-border)",
            borderRadius: 12, padding: "28px 32px", marginTop: 48,
          }}>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--althy-text)", marginBottom: 16 }}>
              Louer à {cfg.labelLong} avec Althy
            </h2>
            <div style={{ fontSize: 14, color: "var(--althy-text-2)", lineHeight: 1.85, display: "flex", flexDirection: "column", gap: 14 }}>
              {cfg.texte_seo.map((para, i) => (
                <p key={i} style={{ margin: 0 }}>{para}</p>
              ))}
            </div>

            {/* FAQ */}
            <div style={{ marginTop: 28, borderTop: "1px solid var(--althy-border)", paddingTop: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--althy-text)", marginBottom: 8 }}>
                Questions fréquentes
              </h3>
              {[
                {
                  q: `Quel est le loyer moyen à ${cfg.labelLong} ?`,
                  a: `D'après nos données, le loyer moyen à ${cfg.labelLong} est d'environ CHF ${cfg.stats.prixMoyen.toLocaleString("fr-CH")}/mois pour un appartement. Les prix varient selon le quartier, la surface et l'état du bien.`,
                },
                {
                  q: "Comment soumettre ma candidature ?",
                  a: "Créez votre compte gratuitement sur Althy, uploadez vos documents (pièce d'identité, fiches de salaire, extrait de l'office des poursuites, références), et soumettez votre dossier en 2 minutes. Notre IA le score instantanément.",
                },
                {
                  q: "Y a-t-il des frais pour chercher un logement ?",
                  a: "Non. La recherche et la candidature sont gratuites. Des frais de dossier de CHF 90 sont uniquement dus si votre candidature est acceptée par le propriétaire.",
                },
                {
                  q: "Comment publier un bien gratuitement ?",
                  a: "Créez un compte propriétaire sur Althy, ajoutez votre bien (photos, description, prix), et publiez en 5 minutes. Les candidats scorés par IA postulent directement. Aucun abonnement requis pour commencer.",
                },
              ].map((faq) => (
                <details key={faq.q} style={{ borderTop: "1px solid var(--althy-border)", padding: "12px 0" }}>
                  <summary style={{
                    fontSize: 14, fontWeight: 600, color: "var(--althy-text)",
                    cursor: "pointer", listStyle: "none",
                    display: "flex", justifyContent: "space-between",
                  }}>
                    {faq.q}
                    <span style={{ color: C.orange, marginLeft: 8, flexShrink: 0 }}>+</span>
                  </summary>
                  <p style={{ fontSize: 13, color: "var(--althy-text-2)", marginTop: 8, marginBottom: 0, lineHeight: 1.6 }}>
                    {faq.a}
                  </p>
                </details>
              ))}
            </div>
          </section>

          {/* CTA locataire bas de page */}
          <div style={{
            textAlign: "center", marginTop: 56, padding: "40px 24px",
            background: "linear-gradient(135deg, rgba(232,96,44,0.05) 0%, rgba(232,96,44,0.12) 100%)",
            borderRadius: 16, border: "1px solid rgba(232,96,44,0.2)",
          }}>
            <p style={{ fontSize: 18, fontWeight: 300, fontFamily: "var(--font-serif)", color: "var(--althy-text)", marginBottom: 8 }}>
              Vous cherchez un logement à {cfg.labelLong} ?
            </p>
            <p style={{ fontSize: 14, color: "var(--althy-text-3)", marginBottom: 24 }}>
              Créez votre dossier locataire gratuitement. Frais de CHF 90 uniquement si vous êtes retenu.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/register" style={{
                background: C.orange, color: "#fff",
                padding: "14px 32px", borderRadius: 8,
                textDecoration: "none", fontSize: 15, fontWeight: 600,
              }}>
                Créer mon dossier gratuit →
              </Link>
              <Link href="/biens/swipe" style={{
                background: "#fff", border: "1.5px solid var(--althy-border)", color: "var(--althy-text)",
                padding: "14px 32px", borderRadius: 8,
                textDecoration: "none", fontSize: 15,
              }}>
                Swiper les biens 🏠
              </Link>
              <Link href="/estimation" style={{
                background: "#fff", border: "1.5px solid var(--althy-border)", color: "var(--althy-text)",
                padding: "14px 32px", borderRadius: 8,
                textDecoration: "none", fontSize: 15,
              }}>
                Estimer mon bien
              </Link>
            </div>
          </div>

          {/* Liens villes voisines */}
          <div style={{ marginTop: 40, textAlign: "center" }}>
            <p style={{ fontSize: 13, color: "var(--althy-text-3)", marginBottom: 12 }}>
              Chercher dans d'autres villes :
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              {Object.values(VILLES)
                .filter((v) => v.slug !== slug)
                .map((v) => (
                  <Link key={v.slug} href={`/biens/${v.slug}`} style={{
                    fontSize: 13, padding: "6px 14px", borderRadius: 20,
                    border: "1px solid var(--althy-border)", color: "var(--althy-text-2)",
                    textDecoration: "none", background: "#fff",
                  }}>
                    {v.label}
                  </Link>
                ))}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
