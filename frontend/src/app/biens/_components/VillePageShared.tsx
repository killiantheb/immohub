/**
 * Composant serveur partagé pour les pages SEO par ville.
 * Utilisé par /biens/geneve, /biens/lausanne, /biens/vaud.
 * Pré-fetche les biens côté serveur pour le crawl Google.
 */

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
const BASE = "https://althy.ch";
const ORANGE = "#E8602C";

// ── Config villes ─────────────────────────────────────────────────────────────

export interface VilleConfig {
  slug: string;
  label: string;
  labelLong: string;   // "Canton de Vaud" vs "Genève"
  searchTerm: string;  // terme envoyé à l'API (ville=...)
  canton: string;
  description: string;
  stats: { nb: number; prixMoyen: number; typePrincipal: string };
}

export const VILLES: Record<string, VilleConfig> = {
  geneve: {
    slug: "geneve",
    label: "Genève",
    labelLong: "Genève",
    searchTerm: "Genève",
    canton: "GE",
    description:
      "Trouvez votre appartement ou maison à louer à Genève. Biens vérifiés par Althy, dossier locataire IA, caution sécurisée. Location au meilleur prix à Genève.",
    stats: { nb: 47, prixMoyen: 2400, typePrincipal: "Appartements" },
  },
  lausanne: {
    slug: "lausanne",
    label: "Lausanne",
    labelLong: "Lausanne",
    searchTerm: "Lausanne",
    canton: "VD",
    description:
      "Appartements et maisons à louer à Lausanne. Découvrez les biens immobiliers disponibles sur Althy — dossier digital, scoring IA, caution simplifiée.",
    stats: { nb: 83, prixMoyen: 1950, typePrincipal: "Appartements" },
  },
  vaud: {
    slug: "vaud",
    label: "Vaud",
    labelLong: "Canton de Vaud",
    searchTerm: "Vaud",
    canton: "VD",
    description:
      "Location immobilière dans le canton de Vaud. Lausanne, Morges, Nyon, Yverdon — trouvez votre logement avec Althy, l'assistant immobilier suisse.",
    stats: { nb: 124, prixMoyen: 1800, typePrincipal: "Appartements & Maisons" },
  },
  fribourg: {
    slug: "fribourg",
    label: "Fribourg",
    labelLong: "Fribourg",
    searchTerm: "Fribourg",
    canton: "FR",
    description:
      "Appartements et maisons à louer à Fribourg. Canton bilingue, prix accessibles — trouvez votre logement avec Althy, l'assistant immobilier suisse.",
    stats: { nb: 31, prixMoyen: 1450, typePrincipal: "Appartements" },
  },
  valais: {
    slug: "valais",
    label: "Valais",
    labelLong: "Valais",
    searchTerm: "Sion",
    canton: "VS",
    description:
      "Location immobilière en Valais. Sion, Sierre, Martigny, Verbier — appartements et chalets disponibles sur Althy, votre assistant immobilier suisse.",
    stats: { nb: 19, prixMoyen: 1300, typePrincipal: "Appartements & Chalets" },
  },
  neuchatel: {
    slug: "neuchatel",
    label: "Neuchâtel",
    labelLong: "Neuchâtel",
    searchTerm: "Neuchâtel",
    canton: "NE",
    description:
      "Logements à louer dans le canton de Neuchâtel. Appartements, studios et maisons disponibles — trouvez votre prochain chez-vous avec Althy.",
    stats: { nb: 24, prixMoyen: 1350, typePrincipal: "Appartements" },
  },
};

// ── Metadata factory ──────────────────────────────────────────────────────────

export function makeVilleMetadata(slug: string): Metadata {
  const cfg = VILLES[slug];
  if (!cfg) return {};
  return {
    title: `Location à ${cfg.labelLong} — Appartements & Maisons | Althy`,
    description: cfg.description,
    alternates: { canonical: `${BASE}/biens/${slug}` },
    openGraph: {
      title: `Location à ${cfg.labelLong} — Althy`,
      description: cfg.description,
      url: `${BASE}/biens/${slug}`,
      siteName: "Althy",
      locale: "fr_CH",
      type: "website",
      images: [{ url: `${BASE}/og-default.jpg`, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: `Location à ${cfg.labelLong} — Althy`,
      description: cfg.description,
    },
    keywords: [
      `location ${cfg.label}`,
      `appartement ${cfg.label}`,
      `louer ${cfg.label}`,
      `immobilier ${cfg.label}`,
      `logement ${cfg.label} Suisse`,
      `Althy ${cfg.label}`,
    ],
  };
}

// ── Bien type ─────────────────────────────────────────────────────────────────

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

// ── Sous-composants ───────────────────────────────────────────────────────────

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
        border: "1px solid #E8E4DC",
        borderRadius: 12,
        overflow: "hidden",
        textDecoration: "none",
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
          <span
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              background: "#F59E0B",
              color: "#fff",
              fontSize: 11,
              fontWeight: 700,
              padding: "3px 8px",
              borderRadius: 4,
            }}
          >
            ★ Premium
          </span>
        )}
        <span
          style={{
            position: "absolute",
            top: 10,
            left: 10,
            background: ORANGE,
            color: "#fff",
            fontSize: 11,
            fontWeight: 600,
            padding: "3px 8px",
            borderRadius: 4,
          }}
        >
          Location
        </span>
      </div>
      <div style={{ padding: "14px 16px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 4,
          }}
        >
          <span style={{ fontSize: 11, color: "#7A7469" }}>{bien.type_label}</span>
          {prixStr && (
            <span style={{ fontSize: 16, fontWeight: 700, color: ORANGE }}>
              {prixStr}
              <span style={{ fontSize: 11, fontWeight: 400, color: "#7A7469" }}>/mois</span>
            </span>
          )}
        </div>
        <p
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "#3D3830",
            margin: "0 0 6px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {bien.titre}
        </p>
        <div style={{ fontSize: 12, color: "#7A7469", marginBottom: 8 }}>
          📍 {bien.adresse_affichee}
          {bien.surface && <span> · {bien.surface}m²</span>}
          {bien.pieces && <span> · {bien.pieces}p.</span>}
        </div>
        {bien.tags_ia.length > 0 && (
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {bien.tags_ia.slice(0, 3).map((t) => (
              <span
                key={t}
                style={{
                  background: "rgba(232,96,44,0.08)",
                  color: ORANGE,
                  fontSize: 10,
                  padding: "2px 7px",
                  borderRadius: 20,
                }}
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export async function VillePageShared({ slug }: { slug: string }) {
  const cfg = VILLES[slug];

  // Fetch server-side pour SSR/SEO
  let biens: Bien[] = [];
  let total = 0;
  try {
    const data = await fetch(
      `${API}/marketplace/biens?ville=${encodeURIComponent(cfg.searchTerm)}&size=24`,
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
    "name": `Location à ${cfg.labelLong} — Althy`,
    "description": cfg.description,
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
          "floorSize": b.surface
            ? { "@type": "QuantitativeValue", "value": b.surface, "unitCode": "MTK" }
            : undefined,
          "address": {
            "@type": "PostalAddress",
            "addressLocality": b.ville,
            "addressRegion": cfg.canton,
            "addressCountry": "CH",
          },
          ...(b.prix && {
            "offers": {
              "@type": "Offer",
              "price": b.prix,
              "priceCurrency": "CHF",
              "priceSpecification": {
                "@type": "UnitPriceSpecification",
                "price": b.prix,
                "priceCurrency": "CHF",
                "unitText": "MON",
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

      <div style={{ minHeight: "100vh", background: "#FAFAF8" }}>
        {/* Header */}
        <header
          style={{
            background: "#fff",
            borderBottom: "1px solid #E8E4DC",
            padding: "0 24px",
            height: 56,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Link href="/" style={{ textDecoration: "none" }}>
            <span
              style={{
                fontFamily: "Georgia, serif",
                fontSize: 20,
                fontWeight: 300,
                color: "#3D3830",
                letterSpacing: "0.05em",
              }}
            >
              ALT<span style={{ color: ORANGE }}>H</span>Y
            </span>
          </Link>
          <div style={{ display: "flex", gap: 8 }}>
            <Link
              href="/biens"
              style={{
                fontSize: 13,
                padding: "6px 14px",
                borderRadius: 8,
                border: "1px solid #E8E4DC",
                color: "#5C5650",
                textDecoration: "none",
              }}
            >
              ← Tous les biens
            </Link>
            <Link
              href="/login"
              style={{
                fontSize: 13,
                padding: "6px 14px",
                borderRadius: 8,
                background: ORANGE,
                color: "#fff",
                textDecoration: "none",
                fontWeight: 500,
              }}
            >
              Se connecter
            </Link>
          </div>
        </header>

        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 20px 80px" }}>
          {/* Breadcrumb */}
          <nav style={{ fontSize: 13, color: "#7A7469", marginBottom: 24 }}>
            <Link href="/" style={{ color: "#7A7469", textDecoration: "none" }}>Althy</Link>
            {" › "}
            <Link href="/biens" style={{ color: "#7A7469", textDecoration: "none" }}>Biens</Link>
            {" › "}
            <span style={{ color: "#3D3830" }}>{cfg.labelLong}</span>
          </nav>

          {/* H1 + description */}
          <h1
            style={{
              fontFamily: "Georgia, serif",
              fontSize: "clamp(28px, 5vw, 42px)",
              fontWeight: 300,
              color: "#3D3830",
              marginBottom: 12,
            }}
          >
            Location à {cfg.labelLong}
          </h1>
          <p style={{ fontSize: 16, color: "#5C5650", maxWidth: 640, marginBottom: 32, lineHeight: 1.6 }}>
            {cfg.description}
          </p>

          {/* Stats */}
          <div
            style={{
              display: "flex",
              gap: 16,
              marginBottom: 40,
              flexWrap: "wrap",
            }}
          >
            {[
              { label: "Biens disponibles", value: `${total || cfg.stats.nb}+` },
              {
                label: "Prix moyen",
                value: `CHF ${cfg.stats.prixMoyen.toLocaleString("fr-CH")}/mois`,
              },
              { label: "Type principal", value: cfg.stats.typePrincipal },
            ].map((stat) => (
              <div
                key={stat.label}
                style={{
                  background: "#fff",
                  border: "1px solid #E8E4DC",
                  borderRadius: 12,
                  padding: "16px 20px",
                  minWidth: 160,
                }}
              >
                <div style={{ fontSize: 22, fontWeight: 700, color: ORANGE, marginBottom: 2 }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: 12, color: "#7A7469" }}>{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Biens grid */}
          {biens.length > 0 ? (
            <>
              <h2
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  color: "#3D3830",
                  marginBottom: 20,
                }}
              >
                {total} bien{total !== 1 ? "s" : ""} disponible{total !== 1 ? "s" : ""} à {cfg.labelLong}
              </h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                  gap: 20,
                  marginBottom: 40,
                }}
              >
                {biens.map((b) => (
                  <BienCard key={b.id} bien={b} />
                ))}
              </div>

              {total > biens.length && (
                <div style={{ textAlign: "center", marginBottom: 40 }}>
                  <Link
                    href={`/biens?ville=${encodeURIComponent(cfg.searchTerm)}`}
                    style={{
                      display: "inline-block",
                      background: ORANGE,
                      color: "#fff",
                      padding: "12px 28px",
                      borderRadius: 8,
                      textDecoration: "none",
                      fontSize: 15,
                      fontWeight: 600,
                    }}
                  >
                    Voir tous les {total} biens →
                  </Link>
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <p style={{ color: "#7A7469", marginBottom: 20 }}>
                Aucun bien disponible pour le moment. Revenez bientôt !
              </p>
              <Link
                href="/biens"
                style={{
                  background: ORANGE,
                  color: "#fff",
                  padding: "12px 24px",
                  borderRadius: 8,
                  textDecoration: "none",
                  fontWeight: 600,
                }}
              >
                Voir tous les biens
              </Link>
            </div>
          )}

          {/* SEO text bloc */}
          <section
            style={{
              background: "#fff",
              border: "1px solid #E8E4DC",
              borderRadius: 12,
              padding: "28px 32px",
              marginTop: 40,
            }}
          >
            <h2
              style={{ fontSize: 20, fontWeight: 600, color: "#3D3830", marginBottom: 12 }}
            >
              Louer à {cfg.labelLong} avec Althy
            </h2>
            <div style={{ fontSize: 14, color: "#5C5650", lineHeight: 1.8 }}>
              <p>
                Althy simplifie la recherche de logement à {cfg.labelLong} en proposant
                des biens vérifiés directement par des propriétaires et agences certifiés.
                Grâce à notre scoring IA, votre dossier locataire est analysé en quelques
                secondes, augmentant vos chances d'être retenu.
              </p>
              <p>
                Les frais de dossier ne sont perçus (CHF 90) qu'en cas de succès — vous ne
                payez rien tant que vous n'avez pas été retenu. La caution est gérée de
                manière transparente, conforme au Code des obligations suisse (maximum
                3 mois de loyer).
              </p>
              <p>
                <strong>Pourquoi choisir Althy à {cfg.labelLong} ?</strong> Biens mis en
                ligne le jour J, dossier 100% digital, notifications instantanées, ouvreurs
                disponibles pour les visites si le propriétaire est absent.
              </p>
            </div>

            {/* FAQ mini */}
            <div style={{ marginTop: 24 }}>
              {[
                {
                  q: `Quel est le loyer moyen à ${cfg.labelLong} ?`,
                  a: `Le loyer moyen pour un appartement à ${cfg.labelLong} est d'environ CHF ${cfg.stats.prixMoyen.toLocaleString("fr-CH")}/mois selon nos données.`,
                },
                {
                  q: "Comment postuler à un bien ?",
                  a: "Créez votre compte gratuitement, uploadez vos documents (CNI, fiches salaire, référence), et soumettez votre dossier en 2 minutes. Althy IA le score automatiquement.",
                },
                {
                  q: "Y a-t-il des frais pour chercher un logement ?",
                  a: "Non. La recherche est gratuite. CHF 90 de frais de dossier sont dus uniquement si votre candidature est acceptée par le propriétaire.",
                },
              ].map((faq) => (
                <details
                  key={faq.q}
                  style={{
                    borderTop: "1px solid #E8E4DC",
                    padding: "14px 0",
                  }}
                >
                  <summary
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#3D3830",
                      cursor: "pointer",
                      listStyle: "none",
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    {faq.q}
                    <span style={{ color: ORANGE, marginLeft: 8 }}>+</span>
                  </summary>
                  <p style={{ fontSize: 13, color: "#5C5650", marginTop: 8, marginBottom: 0 }}>
                    {faq.a}
                  </p>
                </details>
              ))}
            </div>
          </section>

          {/* CTA bas de page */}
          <div style={{ textAlign: "center", marginTop: 48 }}>
            <p style={{ fontSize: 16, color: "#5C5650", marginBottom: 16 }}>
              Vous cherchez un logement à {cfg.labelLong} ?
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <Link
                href="/register"
                style={{
                  background: ORANGE,
                  color: "#fff",
                  padding: "13px 28px",
                  borderRadius: 8,
                  textDecoration: "none",
                  fontSize: 15,
                  fontWeight: 600,
                }}
              >
                Créer mon dossier gratuit →
              </Link>
              <Link
                href="/biens/swipe"
                style={{
                  background: "#fff",
                  border: "1.5px solid #E8E4DC",
                  color: "#3D3830",
                  padding: "13px 28px",
                  borderRadius: 8,
                  textDecoration: "none",
                  fontSize: 15,
                }}
              >
                Swiper les biens 🏠
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
