// src/components/dashboards/DashboardExpert.tsx
"use client";

import Link from "next/link";
import {
  ArrowRight,
  BarChart2,
  Euro,
  ExternalLink,
  FileText,
  MapPin,
  Star,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  DC,
  DCard,
  DKpi,
  DRoleHeader,
  DTopNav,
  DSectionTitle,
} from "@/components/dashboards/DashBoardShared";

// ── Mock data ─────────────────────────────────────────────────────────────────
const MISSIONS_MOCK = [
  {
    id: 1,
    bien: "Villa Bellevue, Nyon",
    type: "Estimation",
    client: "M. Dupont",
    deadline: "15 avr",
    statut: "en cours",
  },
  {
    id: 2,
    bien: "Appt 3p, Lausanne",
    type: "Expertise",
    client: "SCI Leman",
    deadline: "22 avr",
    statut: "en attente",
  },
  {
    id: 3,
    bien: "Local comm., Genève",
    type: "Valorisation",
    client: "UBS SA",
    deadline: "30 avr",
    statut: "en cours",
  },
];

const MARCHE_DATA = [
  { zone: "Genève Centre", prix_m2: 12400, tendance: "+2.1%" },
  { zone: "Lausanne",      prix_m2: 9800,  tendance: "+1.4%" },
  { zone: "Nyon",          prix_m2: 8200,  tendance: "+0.8%" },
  { zone: "Fribourg",      prix_m2: 5600,  tendance: "+1.2%" },
];

// ── Statut badge ──────────────────────────────────────────────────────────────
const STATUT_MAP: Record<string, { label: string; color: string; bg: string }> = {
  "en cours":   { label: "En cours",   color: DC.orange, bg: "rgba(232,96,44,0.10)" },
  "en attente": { label: "En attente", color: "#D97706", bg: "rgba(217,119,6,0.10)" },
  "terminé":    { label: "Terminé",    color: "var(--althy-green)", bg: "var(--althy-green-bg)" },
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

function TypeBadge({ type }: { type: string }) {
  const colorMap: Record<string, { color: string; bg: string }> = {
    "Estimation":   { color: "#7C3AED", bg: "rgba(124,58,237,0.10)" },
    "Expertise":    { color: "#0891B2", bg: "rgba(8,145,178,0.10)" },
    "Valorisation": { color: "#2563EB", bg: "rgba(37,99,235,0.10)" },
  };
  const c = colorMap[type] ?? { color: DC.muted, bg: DC.border };
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: "2px 9px",
        borderRadius: 20,
        color: c.color,
        background: c.bg,
      }}
    >
      {type}
    </span>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DashboardExpert
// ══════════════════════════════════════════════════════════════════════════════
interface Props {
  firstName: string;
}

export function DashboardExpert({ firstName }: Props) {
  const initials = firstName ? firstName.slice(0, 2).toUpperCase() : "EX";
  const isPro = false; // Placeholder — read from profile in real implementation

  return (
    <div style={{ minHeight: "100vh", background: DC.bg }}>
      <DTopNav />
          <DRoleHeader role="expert" initials={initials} />

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
          icon={Euro}
          iconColor="#7C3AED"
          iconBg="rgba(124,58,237,0.10)"
          value="CHF 4'200"
          label="Honoraires ce mois"
          sub="Rapports facturés"
          trend="up"
        />
        <DKpi
          icon={FileText}
          iconColor="var(--althy-green)"
          iconBg="var(--althy-green-bg)"
          value="7"
          label="Rapports rédigés"
          sub="Ce mois-ci"
          trend="neutral"
        />
        <DKpi
          icon={Star}
          iconColor="#D97706"
          iconBg="rgba(217,119,6,0.10)"
          value="4.8 ★"
          label="Note moyenne"
          sub="Sur 34 avis vérifiés"
          trend="up"
        />
        <DKpi
          icon={TrendingUp}
          iconColor={DC.orange}
          iconBg="rgba(232,96,44,0.10)"
          value="3"
          label="Missions en cours"
          sub="À finaliser"
          trend="neutral"
        />
      </div>

      {/* Missions en cours */}
      <div style={{ marginBottom: "2rem" }}>
        <DSectionTitle>Missions en cours</DSectionTitle>
        <DCard style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "rgba(26,22,18,0.02)" }}>
                  {["Bien", "Type", "Client", "Deadline", "Statut", ""].map((h) => (
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
                {MISSIONS_MOCK.map((m, i) => (
                  <tr
                    key={m.id}
                    style={{
                      borderBottom:
                        i < MISSIONS_MOCK.length - 1 ? `1px solid ${DC.border}` : "none",
                    }}
                  >
                    <td style={{ padding: "11px 16px", fontWeight: 600, color: DC.text }}>
                      {m.bien}
                    </td>
                    <td style={{ padding: "11px 16px" }}>
                      <TypeBadge type={m.type} />
                    </td>
                    <td style={{ padding: "11px 16px", color: DC.muted }}>{m.client}</td>
                    <td style={{ padding: "11px 16px", color: DC.muted }}>{m.deadline}</td>
                    <td style={{ padding: "11px 16px" }}>
                      <StatutBadge statut={m.statut} />
                    </td>
                    <td style={{ padding: "11px 16px" }}>
                      <Link
                        href="/app/biens"
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
                        Ouvrir <ExternalLink size={11} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DCard>
      </div>

      {/* Données marché */}
      <div style={{ marginBottom: "2rem" }}>
        <DSectionTitle>Données marché</DSectionTitle>
        <DCard style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "rgba(26,22,18,0.02)" }}>
                  {["Zone", "Prix/m²", "Tendance"].map((h) => (
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
                {MARCHE_DATA.map((row, i) => (
                  <tr
                    key={row.zone}
                    style={{
                      borderBottom:
                        i < MARCHE_DATA.length - 1 ? `1px solid ${DC.border}` : "none",
                    }}
                  >
                    <td
                      style={{
                        padding: "11px 16px",
                        fontWeight: 600,
                        color: DC.text,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <MapPin size={12} style={{ color: DC.muted }} />
                      {row.zone}
                    </td>
                    <td style={{ padding: "11px 16px", color: DC.text, fontWeight: 600 }}>
                      CHF {row.prix_m2.toLocaleString("fr-CH")}/m²
                    </td>
                    <td style={{ padding: "11px 16px" }}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: row.tendance.startsWith("+") ? "var(--althy-green)" : "var(--althy-red)",
                        }}
                      >
                        {row.tendance.startsWith("+") ? "▲" : "▼"} {row.tendance}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DCard>
      </div>

      {/* Upgrade banner */}
      {!isPro && (
        <div style={{ marginBottom: "2rem" }}>
          <DCard
            style={{
              background: `linear-gradient(135deg, rgba(124,58,237,0.08) 0%, rgba(124,58,237,0.03) 100%)`,
              border: "1px solid rgba(124,58,237,0.20)",
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
                  background: "rgba(124,58,237,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Zap size={18} style={{ color: "#7C3AED" }} />
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: DC.text, marginBottom: 2 }}>
                  Passez Expert Pro
                </p>
                <p style={{ fontSize: 12, color: DC.muted }}>
                  Profil premium visible, accès missions prioritaires · CHF 19/mois
                </p>
              </div>
            </div>
            <Link
              href="/app/abonnement"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 18px",
                borderRadius: 10,
                background: "#7C3AED",
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                textDecoration: "none",
                flexShrink: 0,
              }}
            >
              Découvrir Pro <ArrowRight size={13} />
            </Link>
          </DCard>
        </div>
      )}
    </div>
  );
}
