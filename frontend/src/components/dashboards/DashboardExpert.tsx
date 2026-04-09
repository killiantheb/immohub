"use client";

import { FileSearch, TrendingUp, Star, MessageSquare } from "lucide-react";
import Link from "next/link";

const S = {
  bg:      "var(--althy-bg)",
  surface: "var(--althy-surface)",
  border:  "var(--althy-border)",
  text:    "var(--althy-text)",
  text2:   "var(--althy-text-2)",
  text3:   "var(--althy-text-3)",
  orange:  "var(--althy-orange)",
  orangeBg:"var(--althy-orange-bg)",
  shadow:  "var(--althy-shadow)",
} as const;

interface Props { firstName: string }

export function DashboardExpert({ firstName }: Props) {
  const actions = [
    { icon: <FileSearch size={20} />, label: "Missions d'expertise",  href: "/app/biens",           desc: "Évaluations en attente" },
    { icon: <TrendingUp size={20} />, label: "Analyses de marché",    href: "/app/finances",         desc: "Données & rapports" },
    { icon: <Star size={20} />,       label: "Mes évaluations",       href: "/app/profile",          desc: "Avis et historique" },
    { icon: <MessageSquare size={20} />, label: "Althy IA",           href: "/app/sphere",           desc: "Conseil et assistance" },
  ];

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 28, fontWeight: 300, color: S.text, margin: "0 0 6px" }}>
          Bonjour {firstName}
        </h1>
        <p style={{ color: S.text3, fontSize: 13.5, margin: 0 }}>
          Espace expert · Missions d&apos;évaluation et conseil immobilier
        </p>
      </div>

      {/* CTA Pro */}
      <div style={{
        background: `linear-gradient(135deg, ${S.orange} 0%, #9E4D28 100%)`,
        borderRadius: 14, padding: "20px 24px", marginBottom: 28,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 12,
      }}>
        <div>
          <div style={{ color: "white", fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Passez Expert Pro</div>
          <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 13 }}>Accédez à plus de missions · CHF 19/mois</div>
        </div>
        <Link href="/app/abonnement" style={{
          padding: "8px 20px", borderRadius: 8, background: "white",
          color: S.orange, fontWeight: 700, fontSize: 13, textDecoration: "none",
        }}>
          Voir les plans
        </Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        {actions.map((a) => (
          <Link key={a.label} href={a.href} style={{ textDecoration: "none" }}>
            <div style={{
              background: S.surface, border: `1px solid ${S.border}`,
              borderRadius: 14, padding: "20px 18px",
              boxShadow: S.shadow, cursor: "pointer", transition: "box-shadow 0.15s",
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
