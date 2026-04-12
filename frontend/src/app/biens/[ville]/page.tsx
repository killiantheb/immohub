import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
const BASE = "https://althy.ch";

// ── Config par ville ──────────────────────────────────────────────────────────

interface VilleConfig {
  label: string;
  canton: string;
  description: string;
  hero: string;
}

const VILLES: Record<string, VilleConfig> = {
  geneve: {
    label: "Genève",
    canton: "GE",
    description:
      "Découvrez les appartements et maisons à louer ou à vendre à Genève. Althy répertorie les meilleures offres immobilières du canton de Genève.",
    hero: "Immobilier à Genève",
  },
  lausanne: {
    label: "Lausanne",
    canton: "VD",
    description:
      "Trouvez votre logement idéal à Lausanne. Appartements, studios et maisons à louer dans le canton de Vaud avec Althy.",
    hero: "Immobilier à Lausanne",
  },
  vaud: {
    label: "Vaud",
    canton: "VD",
    description:
      "Explorez l'ensemble des biens immobiliers du canton de Vaud : Lausanne, Morges, Nyon, Montreux et toute la Riviera vaudoise.",
    hero: "Immobilier dans le canton de Vaud",
  },
  fribourg: {
    label: "Fribourg",
    canton: "FR",
    description:
      "Appartements et maisons à louer ou à vendre à Fribourg. Découvrez les offres immobilières du canton bilingue de Fribourg sur Althy.",
    hero: "Immobilier à Fribourg",
  },
  valais: {
    label: "Valais",
    canton: "VS",
    description:
      "Biens immobiliers en Valais : appartements en ville, chalets de montagne et résidences à Sion, Sierre, Martigny et Verbier.",
    hero: "Immobilier en Valais",
  },
  neuchatel: {
    label: "Neuchâtel",
    canton: "NE",
    description:
      "Logements à louer et à vendre dans le canton de Neuchâtel. Appartements, studios et maisons listés sur Althy.",
    hero: "Immobilier à Neuchâtel",
  },
};

// ── Static params ─────────────────────────────────────────────────────────────

export async function generateStaticParams() {
  return Object.keys(VILLES).map((ville) => ({ ville }));
}

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: { ville: string };
}): Promise<Metadata> {
  const cfg = VILLES[params.ville];
  if (!cfg) return { title: "Biens immobiliers — Althy" };

  return {
    title: `Appartements à louer à ${cfg.label} | Althy`,
    description: cfg.description,
    alternates: { canonical: `${BASE}/biens/${params.ville}` },
    openGraph: {
      title: `Appartements à louer à ${cfg.label} | Althy`,
      description: cfg.description,
      url: `${BASE}/biens/${params.ville}`,
      siteName: "Althy",
      type: "website",
      locale: "fr_CH",
      images: [{ url: `${BASE}/og-default.jpg`, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: `Appartements à louer à ${cfg.label} | Althy`,
      description: cfg.description,
    },
  };
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface BienCard {
  id: string;
  titre: string;
  prix: number | null;
  surface: number | null;
  pieces: number | null;
  ville: string;
  cover: string | null;
  transaction_type: string;
  is_premium: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPrix(b: BienCard) {
  if (!b.prix) return null;
  const n = Number(b.prix).toLocaleString("fr-CH");
  return b.transaction_type === "vente" ? `CHF ${n}` : `CHF ${n}/mois`;
}

// ── Page (Server Component) ───────────────────────────────────────────────────

export default async function VillePage({
  params,
}: {
  params: { ville: string };
}) {
  const cfg = VILLES[params.ville];

  if (!cfg) {
    return (
      <div style={{ padding: "80px 24px", textAlign: "center" }}>
        <p style={{ color: "var(--althy-text-2)" }}>Ville non trouvée.</p>
        <Link
          href="/biens"
          style={{ color: "var(--althy-orange)", textDecoration: "none" }}
        >
          ← Voir tous les biens
        </Link>
      </div>
    );
  }

  // Fetch biens côté serveur (revalidate 60s)
  let biens: BienCard[] = [];
  let total = 0;
  try {
    const data = await fetch(
      `${API}/marketplace/biens?canton=${cfg.canton}&size=50`,
      { next: { revalidate: 60 } }
    ).then((r) => (r.ok ? r.json() : { items: [], total: 0 }));
    biens = data.items ?? [];
    total = data.total ?? 0;
  } catch {
    // Silently degrade — affiche page vide
  }

  // JSON-LD ItemList
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Biens immobiliers à ${cfg.label}`,
    description: cfg.description,
    url: `${BASE}/biens/${params.ville}`,
    numberOfItems: total,
    itemListElement: biens.slice(0, 10).map((b, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${BASE}/biens/${b.id}`,
      name: b.titre,
    })),
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--althy-bg)" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── Header minimal ──────────────────────────────────────────────── */}
      <header
        style={{
          background: "var(--althy-surface)",
          borderBottom: "1px solid var(--althy-border)",
          padding: "0 24px",
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <Link
          href="/"
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 22,
            fontWeight: 300,
            color: "var(--althy-text)",
            textDecoration: "none",
            letterSpacing: "-0.02em",
          }}
        >
          ALTHY
        </Link>

        <nav style={{ display: "flex", gap: 24, alignItems: "center" }}>
          <Link
            href="/biens"
            style={{
              fontSize: 14,
              color: "var(--althy-text-2)",
              textDecoration: "none",
            }}
          >
            Tous les biens
          </Link>
          <Link
            href="/login"
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: "var(--althy-orange)",
              textDecoration: "none",
            }}
          >
            Se connecter
          </Link>
        </nav>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section
        style={{
          background: "var(--althy-surface)",
          borderBottom: "1px solid var(--althy-border)",
          padding: "40px 24px",
        }}
      >
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          {/* Fil d'ariane */}
          <div
            style={{
              display: "flex",
              gap: 6,
              alignItems: "center",
              fontSize: 13,
              color: "var(--althy-text-3)",
              marginBottom: 16,
            }}
          >
            <Link
              href="/"
              style={{ color: "var(--althy-text-3)", textDecoration: "none" }}
            >
              Accueil
            </Link>
            <span>/</span>
            <Link
              href="/biens"
              style={{ color: "var(--althy-text-3)", textDecoration: "none" }}
            >
              Biens
            </Link>
            <span>/</span>
            <span style={{ color: "var(--althy-text)" }}>{cfg.label}</span>
          </div>

          <h1
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "clamp(28px, 5vw, 44px)",
              fontWeight: 300,
              color: "var(--althy-text)",
              margin: 0,
              lineHeight: 1.1,
            }}
          >
            {cfg.hero}
          </h1>
          <p
            style={{
              color: "var(--althy-text-2)",
              fontSize: 16,
              marginTop: 12,
              maxWidth: 600,
              lineHeight: 1.6,
            }}
          >
            {cfg.description}
          </p>

          <div
            style={{
              display: "flex",
              gap: 12,
              marginTop: 20,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <span
              style={{
                background: "var(--althy-orange-bg)",
                color: "var(--althy-orange)",
                fontSize: 13,
                fontWeight: 600,
                padding: "6px 14px",
                borderRadius: 20,
              }}
            >
              {total} bien{total !== 1 ? "s" : ""} disponible
              {total !== 1 ? "s" : ""}
            </span>

            <Link
              href={`/biens?canton=${cfg.canton}`}
              style={{
                fontSize: 13,
                color: "var(--althy-text-3)",
                textDecoration: "none",
              }}
            >
              Voir avec filtres →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Grille biens ────────────────────────────────────────────────── */}
      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "32px 24px" }}>
        {biens.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "80px 24px",
              color: "var(--althy-text-2)",
            }}
          >
            <p style={{ fontSize: 16, marginBottom: 16 }}>
              Aucun bien disponible à {cfg.label} pour le moment.
            </p>
            <Link
              href="/biens"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "var(--althy-orange)",
                color: "#fff",
                fontSize: 14,
                fontWeight: 500,
                padding: "10px 20px",
                borderRadius: "var(--radius-elem)",
                textDecoration: "none",
              }}
            >
              Voir tous les biens
            </Link>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: 20,
            }}
          >
            {biens.map((b) => (
              <BienCardComponent key={b.id} bien={b} />
            ))}
          </div>
        )}

        {/* CTA inscription */}
        <div
          style={{
            marginTop: 56,
            background: "var(--althy-surface)",
            border: "1px solid var(--althy-border)",
            borderRadius: "var(--radius-card)",
            padding: "32px 24px",
            textAlign: "center",
          }}
        >
          <h2
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 24,
              fontWeight: 300,
              color: "var(--althy-text)",
              margin: "0 0 10px",
            }}
          >
            Vous cherchez un bien à {cfg.label} ?
          </h2>
          <p
            style={{
              color: "var(--althy-text-2)",
              fontSize: 14,
              margin: "0 0 20px",
            }}
          >
            Créez votre dossier locataire gratuit et recevez les nouvelles
            annonces en temps réel.
          </p>
          <div
            style={{
              display: "flex",
              gap: 12,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <Link
              href="/register"
              style={{
                background: "var(--althy-orange)",
                color: "#fff",
                fontSize: 14,
                fontWeight: 500,
                padding: "12px 24px",
                borderRadius: "var(--radius-elem)",
                textDecoration: "none",
              }}
            >
              Commencer gratuitement
            </Link>
            <Link
              href="/biens/swipe"
              style={{
                background: "transparent",
                border: "1px solid var(--althy-border)",
                color: "var(--althy-text)",
                fontSize: 14,
                fontWeight: 500,
                padding: "12px 24px",
                borderRadius: "var(--radius-elem)",
                textDecoration: "none",
              }}
            >
              Mode swipe
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

// ── BienCard (Server component) ───────────────────────────────────────────────

function BienCardComponent({ bien }: { bien: BienCard }) {
  const prix = fmtPrix(bien);

  return (
    <Link
      href={`/biens/${bien.id}`}
      style={{ textDecoration: "none", display: "block" }}
    >
      <article
        style={{
          background: "var(--althy-surface)",
          border: "1px solid var(--althy-border)",
          borderRadius: "var(--radius-card)",
          overflow: "hidden",
          transition: "box-shadow 0.2s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.boxShadow =
            "0 4px 20px rgba(0,0,0,0.08)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.boxShadow = "none";
        }}
      >
        {/* Photo */}
        <div style={{ position: "relative", height: 180, background: "#f0ece4" }}>
          {bien.cover ? (
            <Image
              src={bien.cover}
              alt={bien.titre}
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              style={{ objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--althy-text-3)",
                fontSize: 13,
              }}
            >
              Pas de photo
            </div>
          )}
          {bien.is_premium && (
            <span
              style={{
                position: "absolute",
                top: 10,
                left: 10,
                background: "var(--althy-orange)",
                color: "#fff",
                fontSize: 11,
                fontWeight: 600,
                padding: "3px 8px",
                borderRadius: 4,
                letterSpacing: "0.03em",
              }}
            >
              PREMIUM
            </span>
          )}
          <span
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              background:
                bien.transaction_type === "vente"
                  ? "rgba(59,130,246,0.9)"
                  : bien.transaction_type === "colocation"
                  ? "rgba(139,92,246,0.9)"
                  : "rgba(232,96,44,0.9)",
              color: "#fff",
              fontSize: 11,
              fontWeight: 600,
              padding: "3px 8px",
              borderRadius: 4,
              letterSpacing: "0.03em",
            }}
          >
            {bien.transaction_type === "vente"
              ? "VENTE"
              : bien.transaction_type === "colocation"
              ? "COLOCATION"
              : "LOCATION"}
          </span>
        </div>

        {/* Infos */}
        <div style={{ padding: "16px" }}>
          <p
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 600,
              color: "var(--althy-text)",
              lineHeight: 1.3,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {bien.titre}
          </p>

          <div
            style={{
              display: "flex",
              gap: 8,
              marginTop: 8,
              flexWrap: "wrap",
              fontSize: 12,
              color: "var(--althy-text-3)",
            }}
          >
            {bien.surface && <span>{bien.surface}m²</span>}
            {bien.surface && bien.pieces && <span>·</span>}
            {bien.pieces && (
              <span>
                {bien.pieces} p.
              </span>
            )}
            {(bien.surface || bien.pieces) && <span>·</span>}
            <span>{bien.ville}</span>
          </div>

          {prix && (
            <p
              style={{
                margin: "10px 0 0",
                fontSize: 16,
                fontWeight: 700,
                color: "var(--althy-orange)",
              }}
            >
              {prix}
            </p>
          )}
        </div>
      </article>
    </Link>
  );
}
