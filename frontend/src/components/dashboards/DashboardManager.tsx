// src/components/dashboards/DashboardManager.tsx
"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wrench,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  useManagerDashboard,
  useBriefing,
} from "@/lib/hooks/useDashboardData";
import type { AppRole } from "@/lib/hooks/useRole";
import {
  DC,
  DCard,
  DKpi,
  DRoleHeader,
  DTopNav,
  DSectionTitle,
  DEmptyState,
} from "@/components/dashboards/DashBoardShared";

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtCHF(n: number) {
  return `CHF ${n.toLocaleString("fr-CH")}`;
}

function initials(firstName: string) {
  return firstName ? firstName.slice(0, 2).toUpperCase() : "–";
}

// ── Mock revenue data ─────────────────────────────────────────────────────────
const REVENUE_MOCK = [
  { mois: "Nov", revenus: 8400 },
  { mois: "Déc", revenus: 9100 },
  { mois: "Jan", revenus: 7800 },
  { mois: "Fév", revenus: 9600 },
  { mois: "Mar", revenus: 10200 },
  { mois: "Avr", revenus: 9800 },
];

// ── Statut badge helper ───────────────────────────────────────────────────────
const STATUT_MAP: Record<string, { label: string; color: string; bg: string }> = {
  loue:       { label: "Loué",       color: "var(--althy-green)", bg: "var(--althy-green-bg)" },
  vacant:     { label: "Vacant",     color: "#D97706", bg: "rgba(217,119,6,0.10)" },
  en_vente:   { label: "En vente",   color: "#2563EB", bg: "rgba(37,99,235,0.10)" },
  en_travaux: { label: "En travaux", color: "#0891B2", bg: "rgba(8,145,178,0.10)" },
};

function StatusBadge({ statut }: { statut: string }) {
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

// ── Urgence dot ───────────────────────────────────────────────────────────────
const URGENCE_COLOR: Record<string, string> = {
  haute: "var(--althy-red)",
  moyenne: "#D97706",
  basse: "var(--althy-green)",
};

// ══════════════════════════════════════════════════════════════════════════════
// DashboardManager
// ══════════════════════════════════════════════════════════════════════════════
interface Props {
  firstName: string;
  role: AppRole;
}

export function DashboardManager({ firstName, role }: Props) {
  const { isLoading, metrics, biens } = useManagerDashboard();
  const { data: briefing } = useBriefing();

  const kpiRevenu = metrics.loyersMois;
  const kpiOccupation =
    biens.length > 0
      ? Math.round(
          (biens.filter((b) => b.statut === "loue").length / biens.length) * 100
        )
      : 0;
  const kpiAttente = metrics.loyersAttente;
  const kpiUrgentes = metrics.interOuvertes;

  // Briefing actions (from API or synthesised)
  const briefingActions: Array<{ urgence: string; texte: string }> = briefing?.is_today
    ? [{ urgence: "moyenne", texte: briefing.message }]
    : [
        ...(metrics.biensVacants > 0
          ? [{ urgence: "haute", texte: `${metrics.biensVacants} bien(s) vacant(s) — publication recommandée` }]
          : []),
        ...(kpiAttente > 0
          ? [{ urgence: "moyenne", texte: `${fmtCHF(kpiAttente)} de loyers en attente` }]
          : []),
        ...(kpiUrgentes > 0
          ? [{ urgence: "basse", texte: `${kpiUrgentes} intervention(s) ouverte(s) à suivre` }]
          : []),
      ];

  return (
    <div style={{ minHeight: "100vh", background: DC.bg, padding: "0" }}>
      {/* Role header */}
      <DTopNav />
          <DRoleHeader role={role === "agence" || role === "agency" ? "agence" : "proprio_solo"} initials={initials(firstName)} />

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

      {/* 4 KPI Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <DCard key={i}>
              <div
                style={{
                  height: 80,
                  borderRadius: 8,
                  background: DC.border,
                  opacity: 0.5,
                }}
              />
            </DCard>
          ))
        ) : (
          <>
            <DKpi
              icon={CheckCircle2}
              iconColor="var(--althy-green)"
              iconBg="var(--althy-green-bg)"
              value={fmtCHF(kpiRevenu)}
              label="Revenus du mois"
              sub="Loyers encaissés"
              trend={kpiRevenu > 0 ? "up" : "neutral"}
            />
            <DKpi
              icon={Building2}
              iconColor={kpiOccupation >= 80 ? "var(--althy-green)" : "var(--althy-red)"}
              iconBg={kpiOccupation >= 80 ? "var(--althy-green-bg)" : "var(--althy-red-bg)"}
              value={`${kpiOccupation}%`}
              label="Taux d'occupation"
              sub={`${biens.length} bien(s) au total`}
              trend={kpiOccupation >= 80 ? "up" : "down"}
            />
            <DKpi
              icon={Clock}
              iconColor={kpiAttente > 0 ? "#D97706" : "var(--althy-green)"}
              iconBg={kpiAttente > 0 ? "rgba(217,119,6,0.10)" : "var(--althy-green-bg)"}
              value={fmtCHF(kpiAttente)}
              label="Loyers en attente"
              sub="À recevoir"
              trend={kpiAttente > 0 ? "down" : "neutral"}
            />
            <DKpi
              icon={AlertTriangle}
              iconColor={kpiUrgentes > 0 ? "var(--althy-red)" : "var(--althy-green)"}
              iconBg={kpiUrgentes > 0 ? "var(--althy-red-bg)" : "var(--althy-green-bg)"}
              value={String(kpiUrgentes)}
              label="Actions urgentes"
              sub="Interventions ouvertes"
              trend={kpiUrgentes > 0 ? "down" : "neutral"}
            />
          </>
        )}
      </div>

      {/* Briefing actions */}
      <div style={{ marginBottom: "2rem" }}>
        <DSectionTitle>Actions urgentes Sphère</DSectionTitle>
        {briefingActions.length === 0 ? (
          <DEmptyState
            icon={Sparkles}
            title="Aucune action urgente"
            subtitle="Tout est en ordre — profitez de votre journée !"
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {briefingActions.slice(0, 3).map((action, i) => (
              <DCard
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: URGENCE_COLOR[action.urgence] ?? DC.muted,
                      flexShrink: 0,
                    }}
                  />
                  <p style={{ fontSize: 14, color: DC.text }}>{action.texte}</p>
                </div>
                <Link
                  href="/app/sphere"
                  style={{
                    flexShrink: 0,
                    padding: "6px 14px",
                    borderRadius: 8,
                    background: DC.orange,
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  Valider
                </Link>
              </DCard>
            ))}
          </div>
        )}
      </div>

      {/* Mes biens */}
      <div style={{ marginBottom: "2rem" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "1rem",
          }}
        >
          <DSectionTitle style={{ marginBottom: 0 }}>Mes biens</DSectionTitle>
          <Link
            href="/app/biens"
            style={{
              fontSize: 12,
              color: DC.orange,
              textDecoration: "none",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            Voir tout <ArrowRight size={12} />
          </Link>
        </div>

        {isLoading ? (
          <DCard>
            <div style={{ height: 120, borderRadius: 8, background: DC.border, opacity: 0.5 }} />
          </DCard>
        ) : biens.length === 0 ? (
          <DEmptyState
            icon={Building2}
            title="Aucun bien enregistré"
            subtitle="Commencez par ajouter votre premier bien."
            ctaLabel="Ajouter un bien"
            ctaHref="/app/biens/nouveau"
          />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["Bien", "Adresse", "Statut", "Loyer"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "8px 12px",
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
                {biens.slice(0, 5).map((b) => (
                  <tr
                    key={b.id}
                    style={{ borderBottom: `1px solid ${DC.border}` }}
                  >
                    <td style={{ padding: "10px 12px", fontWeight: 600, color: DC.text }}>
                      {b.type ?? "Bien"}
                    </td>
                    <td style={{ padding: "10px 12px", color: DC.muted }}>
                      {b.adresse}, {b.ville}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <StatusBadge statut={b.statut} />
                    </td>
                    <td style={{ padding: "10px 12px", color: DC.text, fontWeight: 600 }}>
                      {b.loyer ? fmtCHF(Number(b.loyer)) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Revenue chart */}
      <div style={{ marginBottom: "2rem" }}>
        <DSectionTitle>Revenus — 6 derniers mois</DSectionTitle>
        <DCard>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={REVENUE_MOCK} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={DC.orange} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={DC.orange} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="mois"
                tick={{ fontSize: 11, fill: DC.muted }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: DC.muted }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 10,
                  border: `1px solid ${DC.border}`,
                  fontSize: 12,
                  background: DC.surface,
                }}
                formatter={(v) => [fmtCHF(Number(v)), "Revenus"]}
              />
              <Area
                type="monotone"
                dataKey="revenus"
                stroke={DC.orange}
                strokeWidth={2}
                fill="url(#revGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </DCard>
      </div>

      {/* Bottom CTA */}
      <div style={{ textAlign: "center", paddingBottom: "2rem" }}>
        <Link
          href="/app/sphere"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 24px",
            borderRadius: 24,
            background: DC.orange,
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          <TrendingUp size={14} />
          ← Sphère IA
        </Link>
      </div>
    </div>
  );
}
