// src/components/dashboards/DashboardOpener.tsx
"use client";

import {
  Clock,
  Euro,
  MapPin,
  Star,
  CheckCircle2,
  Play,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { useOuvreurDashboard } from "@/lib/hooks/useDashboardData";
import {
  DC,
  DCard,
  DKpi,
  DRoleHeader,
  DTopNav,
  DSectionTitle,
  DEmptyState,
} from "@/components/dashboards/DashBoardShared";

// ── Mock notes data ───────────────────────────────────────────────────────────
const NOTES_DATA = [
  { note: "5★", count: 18 },
  { note: "4★", count: 7 },
  { note: "3★", count: 2 },
  { note: "2★", count: 0 },
  { note: "1★", count: 1 },
];

// ── Mock missions du jour ─────────────────────────────────────────────────────
const MISSIONS_MOCK = [
  { heure: "09:30", type: "Visite", adresse: "Rue de Rive 14, Genève", statut: "confirmée" },
  { heure: "11:00", type: "État des lieux", adresse: "Av. de la Gare 8, Lausanne", statut: "en cours" },
  { heure: "14:30", type: "Visite", adresse: "Chemin des Fleurs 3, Nyon", statut: "terminée" },
];

// ── Statut badge ──────────────────────────────────────────────────────────────
const STATUT_MAP: Record<string, { label: string; color: string; bg: string }> = {
  "confirmée":  { label: "Confirmée",  color: "var(--althy-green)", bg: "var(--althy-green-bg)" },
  "en cours":   { label: "En cours",   color: DC.orange, bg: "rgba(232,96,44,0.10)" },
  "terminée":   { label: "Terminée",   color: DC.muted,  bg: "rgba(107,94,82,0.10)" },
  "proposee":   { label: "Proposée",   color: "#2563EB", bg: "rgba(37,99,235,0.10)" },
  "acceptee":   { label: "Acceptée",   color: "var(--althy-green)", bg: "var(--althy-green-bg)" },
  "effectuee":  { label: "Effectuée",  color: DC.muted,  bg: "rgba(107,94,82,0.10)" },
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

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtCHF(n: number) {
  return `CHF ${n.toLocaleString("fr-CH")}`;
}

// ══════════════════════════════════════════════════════════════════════════════
// DashboardOpener
// ══════════════════════════════════════════════════════════════════════════════
interface Props {
  firstName: string;
}

export function DashboardOpener({ firstName }: Props) {
  const { isLoading, missionsDuJour, metrics } = useOuvreurDashboard();

  const initials = firstName ? firstName.slice(0, 2).toUpperCase() : "OU";

  // Use real missions if available, else mock
  const missionsAffichees =
    missionsDuJour.length > 0
      ? missionsDuJour.map((m) => ({
          heure: (m.creneau_debut as unknown as string)?.slice(0, 5) ?? "–",
          type: m.type === "edl_entree"
            ? "État des lieux entrée"
            : m.type === "edl_sortie"
            ? "État des lieux sortie"
            : m.type === "visite"
            ? "Visite"
            : m.type ?? "Mission",
          adresse: `Bien #${m.bien_id?.slice(0, 8) ?? "–"}`,
          statut: m.statut === "acceptee" ? "confirmée" : m.statut,
        }))
      : MISSIONS_MOCK;

  // KPI values
  const kpiRevenus = metrics.gainsMois;
  const kpiMissions = metrics.nbMissionsMois;
  const kpiNote = 4.8; // Placeholder — real rating from profile
  const kpiAttente = 0; // Placeholder

  return (
    <div style={{ minHeight: "100vh", background: DC.bg }}>
      {/* Role header */}
      <DTopNav />
          <DRoleHeader role="opener" initials={initials} />

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
        <p style={{ fontSize: 14, color: DC.muted }} suppressHydrationWarning>
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
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <DCard key={i}>
              <div style={{ height: 80, borderRadius: 8, background: DC.border, opacity: 0.5 }} />
            </DCard>
          ))
        ) : (
          <>
            <DKpi
              icon={Euro}
              iconColor="var(--althy-green)"
              iconBg="var(--althy-green-bg)"
              value={fmtCHF(kpiRevenus)}
              label="Revenus ce mois"
              sub="Missions effectuées"
              trend="up"
            />
            <DKpi
              icon={CheckCircle2}
              iconColor={DC.orange}
              iconBg="rgba(232,96,44,0.10)"
              value={String(kpiMissions)}
              label="Missions réalisées"
              sub="Ce mois-ci"
              trend="neutral"
            />
            <DKpi
              icon={Star}
              iconColor="#D97706"
              iconBg="rgba(217,119,6,0.10)"
              value={`${kpiNote.toFixed(1)} ★`}
              label="Note moyenne"
              sub="Sur 28 avis"
              trend="up"
            />
            <DKpi
              icon={Clock}
              iconColor={kpiAttente > 0 ? "#D97706" : "var(--althy-green)"}
              iconBg={kpiAttente > 0 ? "rgba(217,119,6,0.10)" : "var(--althy-green-bg)"}
              value={fmtCHF(kpiAttente)}
              label="Paiements en attente"
              sub="À recevoir"
              trend="neutral"
            />
          </>
        )}
      </div>

      {/* Missions du jour */}
      <div style={{ marginBottom: "2rem" }}>
        <DSectionTitle>Missions du jour</DSectionTitle>
        {missionsAffichees.length === 0 ? (
          <DEmptyState
            icon={CheckCircle2}
            title="Aucune mission aujourd'hui"
            subtitle="Profitez de votre journée !"
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {missionsAffichees.map((m, i) => (
              <DCard
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {/* Time pill */}
                  <span
                    style={{
                      flexShrink: 0,
                      fontSize: 12,
                      fontWeight: 700,
                      padding: "4px 10px",
                      borderRadius: 8,
                      background: "rgba(26,22,18,0.05)",
                      color: DC.muted,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {m.heure}
                  </span>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: DC.text, marginBottom: 2 }}>
                      {m.type}
                    </p>
                    <p style={{ fontSize: 12, color: DC.muted, display: "flex", alignItems: "center", gap: 4 }}>
                      <MapPin size={11} />
                      {m.adresse}
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <StatutBadge statut={m.statut} />
                  {m.statut === "confirmée" && (
                    <button
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        padding: "6px 14px",
                        borderRadius: 8,
                        border: "none",
                        background: DC.orange,
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      <Play size={11} />
                      Démarrer
                    </button>
                  )}
                </div>
              </DCard>
            ))}
          </div>
        )}
      </div>

      {/* Notes chart */}
      <div style={{ marginBottom: "2rem" }}>
        <DSectionTitle>Mes notes</DSectionTitle>
        <DCard>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart
              data={NOTES_DATA}
              layout="vertical"
              margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={DC.border} />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: DC.muted }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="note"
                tick={{ fontSize: 11, fill: DC.muted }}
                axisLine={false}
                tickLine={false}
                width={32}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 10,
                  border: `1px solid ${DC.border}`,
                  fontSize: 12,
                  background: DC.surface,
                }}
                formatter={(v) => [Number(v), "Avis"]}
              />
              <Bar
                dataKey="count"
                fill={DC.orange}
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </DCard>
      </div>
    </div>
  );
}
