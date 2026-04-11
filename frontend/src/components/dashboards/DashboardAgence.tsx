// src/components/dashboards/DashboardAgence.tsx
"use client";

import { useState } from "react";
import {
  Building2,
  TrendingUp,
  Users,
  Globe,
  Send,
  Bell,
  CheckCircle2,
  Info,
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
const AGENTS_MOCK = [
  { nom: "Sophie R.", missions: 12, taux: 94, ca: 8400 },
  { nom: "Marc D.",   missions: 9,  taux: 88, ca: 6200 },
  { nom: "Julie P.",  missions: 15, taux: 97, ca: 11800 },
];

const ALERTES_MOCK = [
  { type: "urgent", text: "3 baux expirent dans 30 jours" },
  { type: "info",   text: "2 proprios clients en attente d'activation" },
  { type: "ok",     text: "Portails synchronisés · Homegate, ImmoScout" },
];

// ── Taux badge ────────────────────────────────────────────────────────────────
function TauxBadge({ taux }: { taux: number }) {
  const color = taux >= 90 ? "var(--althy-green)" : taux >= 75 ? "#D97706" : "var(--althy-red)";
  const bg    = taux >= 90 ? "var(--althy-green-bg)" : taux >= 75 ? "rgba(217,119,6,0.10)" : "var(--althy-red-bg)";
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        padding: "2px 9px",
        borderRadius: 20,
        color,
        background: bg,
      }}
    >
      {taux}%
    </span>
  );
}

// ── Alerte colors ─────────────────────────────────────────────────────────────
const ALERTE_STYLE: Record<string, { border: string; icon: React.ElementType; iconColor: string }> = {
  urgent: { border: "var(--althy-red)", icon: Bell,         iconColor: "var(--althy-red)" },
  info:   { border: "#2563EB", icon: Info,         iconColor: "#2563EB" },
  ok:     { border: "var(--althy-green)", icon: CheckCircle2, iconColor: "var(--althy-green)" },
};

// ══════════════════════════════════════════════════════════════════════════════
// DashboardAgence
// ══════════════════════════════════════════════════════════════════════════════
interface Props {
  firstName: string;
}

export function DashboardAgence({ firstName }: Props) {
  const [email, setEmail] = useState("");

  const initials = firstName ? firstName.slice(0, 2).toUpperCase() : "AG";

  return (
    <div style={{ minHeight: "100vh", background: DC.bg }}>
      {/* Role header */}
      <DTopNav />
          <DRoleHeader role="agence" initials={initials} />

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
          icon={TrendingUp}
          iconColor="var(--althy-green)"
          iconBg="var(--althy-green-bg)"
          value="CHF 26'400"
          label="CA mensuel"
          sub="Ce mois-ci"
          trend="up"
        />
        <DKpi
          icon={Building2}
          iconColor="#2563EB"
          iconBg="rgba(37,99,235,0.10)"
          value="91%"
          label="Occupation"
          sub="Taux du portefeuille"
          trend="up"
        />
        <DKpi
          icon={Users}
          iconColor={DC.orange}
          iconBg="rgba(232,96,44,0.10)"
          value="3"
          label="Nouvelles entrées"
          sub="Ce mois-ci"
          trend="up"
        />
        <DKpi
          icon={Globe}
          iconColor="#0891B2"
          iconBg="rgba(8,145,178,0.10)"
          value="2"
          label="Portails actifs"
          sub="Homegate · ImmoScout"
          trend="neutral"
        />
      </div>

      {/* Équipe performance */}
      <div style={{ marginBottom: "2rem" }}>
        <DSectionTitle>Équipe — Performance agents</DSectionTitle>
        <DCard style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "rgba(26,22,18,0.02)" }}>
                  {["Agent", "Missions", "Taux", "CA CHF"].map((h) => (
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
                {AGENTS_MOCK.map((agent, i) => (
                  <tr
                    key={agent.nom}
                    style={{
                      borderBottom:
                        i < AGENTS_MOCK.length - 1
                          ? `1px solid ${DC.border}`
                          : "none",
                    }}
                  >
                    <td
                      style={{
                        padding: "12px 16px",
                        fontWeight: 600,
                        color: DC.text,
                      }}
                    >
                      {agent.nom}
                    </td>
                    <td style={{ padding: "12px 16px", color: DC.muted }}>
                      {agent.missions}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <TauxBadge taux={agent.taux} />
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        fontWeight: 600,
                        color: DC.text,
                      }}
                    >
                      CHF {agent.ca.toLocaleString("fr-CH")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DCard>
      </div>

      {/* Alertes */}
      <div style={{ marginBottom: "2rem" }}>
        <DSectionTitle>Alertes</DSectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {ALERTES_MOCK.map((alerte, i) => {
            const st = ALERTE_STYLE[alerte.type] ?? ALERTE_STYLE.info;
            const IconComp = st.icon;
            return (
              <DCard
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  borderLeft: `3px solid ${st.border}`,
                  paddingLeft: "1rem",
                }}
              >
                <IconComp size={16} style={{ color: st.iconColor, flexShrink: 0 }} />
                <p style={{ fontSize: 14, color: DC.text }}>{alerte.text}</p>
              </DCard>
            );
          })}
        </div>
      </div>

      {/* Intégration rapide */}
      <div style={{ marginBottom: "2rem" }}>
        <DSectionTitle>Intégration rapide</DSectionTitle>
        <DCard>
          <p style={{ fontSize: 14, color: DC.muted, marginBottom: "1rem" }}>
            Invitez un propriétaire client à accéder à son portail Althy en
            quelques secondes.
          </p>
          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              flexWrap: "wrap",
              marginBottom: "0.75rem",
            }}
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email du propriétaire client"
              style={{
                flex: 1,
                minWidth: 220,
                padding: "9px 14px",
                borderRadius: 10,
                border: `1px solid ${DC.border}`,
                fontSize: 13,
                color: DC.text,
                background: DC.bg,
                outline: "none",
              }}
            />
            <button
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "9px 20px",
                borderRadius: 10,
                border: "none",
                background: DC.orange,
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <Send size={14} />
              Envoyer l'invitation
            </button>
          </div>
          <p style={{ fontSize: 11, color: DC.muted }}>
            CHF 9/mois · Portail activé en 2 min
          </p>
        </DCard>
      </div>
    </div>
  );
}
