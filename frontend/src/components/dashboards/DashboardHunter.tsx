// src/components/dashboards/DashboardHunter.tsx
"use client";

import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  ExternalLink,
  Network,
  PlusCircle,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  DC,
  DCard,
  DKpi,
  DRoleHeader,
  DTopNav,
  DSectionTitle,
} from "@/components/dashboards/DashBoardShared";

// ── Mock leads ────────────────────────────────────────────────────────────────
const LEADS_MOCK = [
  {
    id: 1,
    bien: "Villa 5p, Cologny",
    budget: "CHF 2.8M",
    statut: "négociation",
    contact: "M. Meyer",
  },
  {
    id: 2,
    bien: "Appt 4p, Lausanne",
    budget: "CHF 1.2M",
    statut: "qualification",
    contact: "Mme Blanc",
  },
  {
    id: 3,
    bien: "Immeuble 6 lots, Nyon",
    budget: "CHF 4.5M",
    statut: "offre envoyée",
    contact: "SCI Romande",
  },
];

// ── Statut badge ──────────────────────────────────────────────────────────────
const STATUT_MAP: Record<string, { label: string; color: string; bg: string }> = {
  "négociation":    { label: "Négociation",    color: DC.orange, bg: "rgba(232,96,44,0.10)" },
  "qualification":  { label: "Qualification",  color: "#D97706", bg: "rgba(217,119,6,0.10)" },
  "offre envoyée":  { label: "Offre envoyée",  color: "var(--althy-green)", bg: "var(--althy-green-bg)" },
  "perdu":          { label: "Perdu",           color: "var(--althy-red)", bg: "var(--althy-red-bg)" },
};

function StatutBadge({ statut }: { statut: string }) {
  const s = STATUT_MAP[statut] ?? { label: statut, color: DC.muted, bg: DC.border };
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: "2px 9px",
        borderRadius: 20,
        color: s.color,
        background: s.bg,
      }}
    >
      {s.label}
    </span>
  );
}

// ── Stats interface ───────────────────────────────────────────────────────────
interface HunterStats {
  fees_percus: number;
  pipeline_actif: number;
  leads_soumis: number;
  taux_conversion: number;
}

// ══════════════════════════════════════════════════════════════════════════════
// DashboardHunter
// ══════════════════════════════════════════════════════════════════════════════
interface Props {
  firstName: string;
}

export function DashboardHunter({ firstName }: Props) {
  const initials = firstName ? firstName.slice(0, 2).toUpperCase() : "HU";

  const { data: stats } = useQuery<HunterStats>({
    queryKey: ["hunters", "stats"],
    queryFn: async () => {
      const { data } = await api.get<HunterStats>("/hunters/stats");
      return data;
    },
    staleTime: 60_000,
  });

  // Fallback values
  const kpiFees = stats?.fees_percus ?? 18500;
  const kpiPipeline = stats?.pipeline_actif ?? 3;
  const kpiLeads = stats?.leads_soumis ?? 12;
  const kpiTaux = stats?.taux_conversion ?? 25;

  return (
    <div style={{ minHeight: "100vh", background: DC.bg }}>
      <DTopNav />
          <DRoleHeader role="hunter" initials={initials} />

      {/* Greeting */}
      <div style={{ marginBottom: "2rem" }}>
        <h1
          style={{
            fontSize: 30,
            fontWeight: 400,
            fontFamily: DC.serif,
            color: DC.text,
            marginBottom: 4,
            letterSpacing: "0.01em",
          }}
        >
          Bonjour{firstName ? `, ${firstName}` : ""}
        </h1>
        <p style={{ fontSize: 14, color: DC.muted }}>
          {new Date().toLocaleDateString("fr-CH", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      {/* 4 KPI cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        <DKpi
          icon={Banknote}
          iconColor="#D97706"
          iconBg="rgba(217,119,6,0.10)"
          value={`CHF ${kpiFees.toLocaleString("fr-CH")}`}
          label="Fees perçus"
          sub="Cumul annuel"
          trend="up"
        />
        <DKpi
          icon={Target}
          iconColor={DC.orange}
          iconBg="rgba(232,96,44,0.10)"
          value={String(kpiPipeline)}
          label="Pipeline actif"
          sub="Leads en cours"
          trend="neutral"
        />
        <DKpi
          icon={TrendingUp}
          iconColor="#2563EB"
          iconBg="rgba(37,99,235,0.10)"
          value={String(kpiLeads)}
          label="Leads soumis"
          sub="Total soumis"
          trend="up"
        />
        <DKpi
          icon={Users}
          iconColor="var(--althy-green)"
          iconBg="var(--althy-green-bg)"
          value={`${kpiTaux}%`}
          label="Taux conversion"
          sub="Leads → transactions"
          trend="up"
        />
      </div>

      {/* Leads en négociation */}
      <div style={{ marginBottom: "2rem" }}>
        <DSectionTitle>Leads en négociation</DSectionTitle>
        <DCard style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "rgba(26,22,18,0.02)" }}>
                  {["Bien", "Budget", "Contact", "Statut", ""].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "10px 16px",
                        fontSize: 11,
                        fontWeight: 700,
                        color: DC.muted,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        borderBottom: `1px solid ${DC.border}`,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {LEADS_MOCK.map((lead, i) => (
                  <tr
                    key={lead.id}
                    style={{
                      borderBottom:
                        i < LEADS_MOCK.length - 1 ? `1px solid ${DC.border}` : "none",
                    }}
                  >
                    <td style={{ padding: "11px 16px", fontWeight: 600, color: DC.text }}>
                      {lead.bien}
                    </td>
                    <td style={{ padding: "11px 16px", fontWeight: 600, color: DC.text }}>
                      {lead.budget}
                    </td>
                    <td style={{ padding: "11px 16px", color: DC.muted }}>{lead.contact}</td>
                    <td style={{ padding: "11px 16px" }}>
                      <StatutBadge statut={lead.statut} />
                    </td>
                    <td style={{ padding: "11px 16px" }}>
                      <Link
                        href="/app/hunters"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 12,
                          color: DC.orange,
                          textDecoration: "none",
                          fontWeight: 600,
                        }}
                      >
                        Détail <ExternalLink size={11} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DCard>
      </div>

      {/* Soumettre un lead */}
      <div style={{ marginBottom: "2rem" }}>
        <DSectionTitle>Soumettre un lead</DSectionTitle>
        <DCard
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <p style={{ fontSize: 15, fontWeight: 600, color: DC.text, marginBottom: 4 }}>
              Vous connaissez un bien off-market ?
            </p>
            <p style={{ fontSize: 13, color: DC.muted }}>
              Soumettez-le et percevez votre referral fee à la transaction.
              Votre track record améliore vos honoraires.
            </p>
          </div>
          <Link
            href="/app/hunters"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 20px",
              borderRadius: 10,
              background: DC.orange,
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              textDecoration: "none",
              flexShrink: 0,
            }}
          >
            <PlusCircle size={14} />
            Soumettre un lead
          </Link>
        </DCard>
      </div>

      {/* Réseau */}
      <div style={{ marginBottom: "2rem" }}>
        <DSectionTitle>Réseau — Mes contacts</DSectionTitle>
        <DCard
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: "rgba(217,119,6,0.10)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Network size={18} style={{ color: "#D97706" }} />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: DC.text, marginBottom: 2 }}>
                14 contacts actifs · 3 agences partenaires
              </p>
              <p style={{ fontSize: 12, color: DC.muted }}>
                Réseau qualifié Althy
              </p>
            </div>
          </div>
          <Link
            href="/app/hunters"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 13,
              color: DC.orange,
              textDecoration: "none",
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            Gérer <ArrowRight size={13} />
          </Link>
        </DCard>
      </div>
    </div>
  );
}
