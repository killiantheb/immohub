"use client";

import { Target, PlusCircle, TrendingUp, Banknote } from "lucide-react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

const S = {
  bg:      "var(--althy-bg)",
  surface: "var(--althy-surface)",
  border:  "var(--althy-border)",
  text:    "var(--althy-text)",
  text2:   "var(--althy-text-2)",
  text3:   "var(--althy-text-3)",
  orange:  "var(--althy-orange)",
  orangeBg:"var(--althy-orange-bg)",
  green:   "var(--althy-green)",
  greenBg: "var(--althy-green-bg)",
  shadow:  "var(--althy-shadow)",
  shadowMd:"var(--althy-shadow-md)",
} as const;

interface Props { firstName: string }

interface HunterStats { total: number; new: number; contacted: number; paid: number; total_earned: number }

export function DashboardHunter({ firstName }: Props) {
  const { data: stats } = useQuery<HunterStats>({
    queryKey: ["hunter-stats"],
    queryFn: () => api.get<HunterStats>("/hunters/stats").then(r => r.data),
  });

  const kpis = [
    { label: "Leads soumis",   value: stats?.total ?? "—",      color: S.text },
    { label: "Nouveaux",       value: stats?.new ?? "—",         color: S.orange },
    { label: "En contact",     value: stats?.contacted ?? "—",   color: S.green },
    { label: "Gains perçus",   value: stats?.total_earned
        ? `CHF ${stats.total_earned}`
        : "—",                                                    color: S.green },
  ];

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 28, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 28, fontWeight: 300, color: S.text, margin: "0 0 6px" }}>
            Bonjour {firstName}
          </h1>
          <p style={{ color: S.text3, fontSize: 13.5, margin: 0 }}>
            Espace Hunter · Signaler des biens off-market et gagner des referral fees
          </p>
        </div>
        <Link href="/app/hunters" style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "9px 18px", borderRadius: 9,
          background: S.orange, color: "white",
          fontWeight: 600, fontSize: 13, textDecoration: "none",
        }}>
          <PlusCircle size={15} /> Soumettre un lead
        </Link>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 28 }}>
        {kpis.map(k => (
          <div key={k.label} style={{
            background: S.surface, border: `1px solid ${S.border}`,
            borderRadius: 14, padding: "16px",
            boxShadow: S.shadow,
          }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 11, color: S.text3, marginTop: 2 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Comment ça marche */}
      <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 16, padding: 24, marginBottom: 20 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: S.text }}>Comment gagner des referral fees ?</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
          {[
            { num: "1", label: "Signalez un bien",   desc: "Adresse + contact vendeur" },
            { num: "2", label: "Althy contacte",     desc: "Notre équipe prend contact" },
            { num: "3", label: "Transaction réussie", desc: "CHF 50–500 automatiquement" },
          ].map(s => (
            <div key={s.num} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: S.orangeBg, color: S.orange,
                fontWeight: 800, fontSize: 13,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>{s.num}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: S.text }}>{s.label}</div>
                <div style={{ fontSize: 12, color: S.text3 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <Link href="/app/hunters" style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          padding: 16, borderRadius: 12,
          background: S.surface, border: `1px solid ${S.border}`,
          color: S.text2, fontSize: 14, fontWeight: 600, textDecoration: "none",
        }}>
          <Target size={16} /> Mes leads
        </Link>
        <Link href="/app/sphere" style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          padding: 16, borderRadius: 12,
          background: S.orangeBg, border: `1px solid ${S.orange}`,
          color: S.orange, fontSize: 14, fontWeight: 600, textDecoration: "none",
        }}>
          <Banknote size={16} /> Mes gains
        </Link>
      </div>
    </div>
  );
}
