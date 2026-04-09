"use client";

import { Search, Heart, MessageSquare, TrendingUp } from "lucide-react";
import Link from "next/link";

const S = {
  surface: "var(--althy-surface)",
  border:  "var(--althy-border)",
  text:    "var(--althy-text)",
  text2:   "var(--althy-text-2)",
  text3:   "var(--althy-text-3)",
  orange:  "var(--althy-orange)",
  orangeBg:"var(--althy-orange-bg)",
  shadow:  "var(--althy-shadow)",
  shadowMd:"var(--althy-shadow-md)",
} as const;

interface Props { firstName: string }

export function DashboardAcheteur({ firstName }: Props) {
  const actions = [
    { icon: <Search size={20} />,      label: "Explorer les annonces",  href: "/app/listings",  desc: "Biens à acheter en Suisse" },
    { icon: <Heart size={20} />,       label: "Mes favoris",            href: "/app/listings",  desc: "Biens sauvegardés" },
    { icon: <TrendingUp size={20} />,  label: "Estimation gratuite",    href: "/estimation",    desc: "Valeur de marché IA" },
    { icon: <MessageSquare size={20} />, label: "Althy IA",             href: "/app/sphere",    desc: "Conseils et simulation" },
  ];

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 28, fontWeight: 300, color: S.text, margin: "0 0 6px" }}>
          Bonjour {firstName}
        </h1>
        <p style={{ color: S.text3, fontSize: 13.5, margin: 0 }}>
          Espace Acheteur Premium · Trouvez le bien de vos rêves
        </p>
      </div>

      {/* Hero CTA */}
      <div style={{
        background: `linear-gradient(135deg, #FAFAF8 0%, #FAE4D6 100%)`,
        border: `1px solid var(--althy-border)`,
        borderRadius: 16, padding: "28px 24px", marginBottom: 28,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 16,
      }}>
        <div>
          <p style={{ fontFamily: "var(--font-serif)", fontSize: 20, fontWeight: 300, color: S.text, margin: "0 0 6px" }}>
            Recherchez parmi les biens disponibles
          </p>
          <p style={{ fontSize: 13, color: S.text3, margin: 0 }}>
            Filtrez par ville, surface, prix · Faites une offre directement
          </p>
        </div>
        <Link href="/app/listings" style={{
          padding: "10px 22px", borderRadius: 9,
          background: S.orange, color: "white",
          fontWeight: 700, fontSize: 14, textDecoration: "none",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <Search size={15} /> Rechercher
        </Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        {actions.map(a => (
          <Link key={a.label} href={a.href} style={{ textDecoration: "none" }}>
            <div style={{
              background: S.surface, border: `1px solid ${S.border}`,
              borderRadius: 14, padding: "20px 18px",
              boxShadow: S.shadow, cursor: "pointer",
            }}>
              <div style={{ color: S.orange, marginBottom: 10 }}>{a.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: S.text, marginBottom: 3 }}>{a.label}</div>
              <div style={{ fontSize: 12, color: S.text3 }}>{a.desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
