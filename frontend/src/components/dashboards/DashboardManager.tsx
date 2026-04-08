"use client";

import Link from "next/link";
import {
  AlertTriangle, ArrowRight, Building2, CheckCircle2,
  Clock, Sparkles, TrendingDown, TrendingUp, Wrench,
} from "lucide-react";
import { useManagerDashboard, type BienWithLocataire } from "@/lib/hooks/useDashboardData";
import type { AppRole } from "@/lib/hooks/useRole";

// ── Design tokens ─────────────────────────────────────────────────────────────
const S = {
  bg:       "var(--althy-bg)",
  surface:  "var(--althy-surface)",
  surface2: "var(--althy-surface-2)",
  border:   "var(--althy-border)",
  text:     "var(--althy-text)",
  text2:    "var(--althy-text-2)",
  text3:    "var(--althy-text-3)",
  orange:   "var(--althy-orange)",
  orangeBg: "var(--althy-orange-bg)",
  green:    "var(--althy-green)",
  greenBg:  "var(--althy-green-bg)",
  red:      "var(--althy-red)",
  redBg:    "var(--althy-red-bg)",
  amber:    "var(--althy-amber)",
  amberBg:  "var(--althy-amber-bg)",
  blue:     "var(--althy-blue)",
  blueBg:   "var(--althy-blue-bg)",
  shadow:   "var(--althy-shadow)",
  shadowMd: "var(--althy-shadow-md)",
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtCHF(n: number) {
  return `CHF ${n.toLocaleString("fr-CH")}`;
}

// ── Atoms ─────────────────────────────────────────────────────────────────────
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: S.surface, borderRadius: 16, border: `1px solid ${S.border}`, boxShadow: S.shadow, padding: "1.25rem", ...style }}>
      {children}
    </div>
  );
}
function Skel({ h = 16, w = "100%" }: { h?: number; w?: string | number }) {
  return <div style={{ height: h, width: w, borderRadius: 8, background: S.border, opacity: 0.5 }} />;
}
function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: 20, color, background: bg }}>
      {label}
    </span>
  );
}

// ── Metric card ───────────────────────────────────────────────────────────────
interface MetricProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  trend?: "up" | "down" | "neutral";
}
function MetricCard({ label, value, sub, icon: Icon, color, bg, trend }: MetricProps) {
  return (
    <Card>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "0.75rem" }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={18} style={{ color }} />
        </div>
        {trend && trend !== "neutral" && (
          trend === "up"
            ? <TrendingUp size={14} style={{ color: S.green }} />
            : <TrendingDown size={14} style={{ color: S.red }} />
        )}
      </div>
      <p style={{ fontSize: 22, fontWeight: 800, color: S.text, marginBottom: 2, letterSpacing: "-0.02em" }}>{value}</p>
      <p style={{ fontSize: 13, color: S.text2, fontWeight: 500 }}>{label}</p>
      {sub && <p style={{ fontSize: 12, color: S.text3, marginTop: 2 }}>{sub}</p>}
    </Card>
  );
}

// ── Briefing IA ───────────────────────────────────────────────────────────────
function BriefingIA({ biensVacants, loyersAttente, interOuvertes }: {
  biensVacants: number;
  loyersAttente: number;
  interOuvertes: number;
}) {
  const items: string[] = [];
  if (biensVacants > 0) items.push(`${biensVacants} bien${biensVacants > 1 ? "s" : ""} vacant${biensVacants > 1 ? "s" : ""} — publication recommandée`);
  if (loyersAttente > 0) items.push(`${fmtCHF(loyersAttente)} de loyers en attente de réception`);
  if (interOuvertes > 0) items.push(`${interOuvertes} intervention${interOuvertes > 1 ? "s" : ""} ouverte${interOuvertes > 1 ? "s" : ""} à suivre`);
  const summary = items.length === 0
    ? "Tout est en ordre — aucune action urgente aujourd'hui."
    : items.join(" · ");

  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 14,
      padding: "1rem 1.25rem",
      background: `linear-gradient(135deg, ${S.orangeBg} 0%, ${S.surface2} 100%)`,
      border: `1px solid ${S.orange}30`,
      borderRadius: 16, marginBottom: "1.5rem",
    }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: S.orange, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Sparkles size={16} style={{ color: "#fff" }} />
      </div>
      <div>
        <p style={{ fontSize: 12, fontWeight: 700, color: S.orange, marginBottom: 3, letterSpacing: "0.04em", textTransform: "uppercase" }}>
          Briefing Althy · {new Date().toLocaleDateString("fr-CH", { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <p style={{ fontSize: 14, color: S.text2, lineHeight: 1.55 }}>{summary}</p>
      </div>
    </div>
  );
}

// ── Bien card ─────────────────────────────────────────────────────────────────
const STATUT_MAP: Record<string, { label: string; color: string; bg: string }> = {
  loue:       { label: "Loué",       color: S.green,  bg: S.greenBg },
  vacant:     { label: "Vacant",     color: S.amber,  bg: S.amberBg },
  en_travaux: { label: "En travaux", color: S.blue,   bg: S.blueBg },
};
const TYPE_MAP: Record<string, string> = {
  appartement: "Apt", villa: "Villa", studio: "Studio", maison: "Maison",
  commerce: "Commerce", bureau: "Bureau", parking: "Parking", garage: "Garage",
  cave: "Cave", autre: "Autre",
};

function BienCard({ bien }: { bien: BienWithLocataire }) {
  const s = STATUT_MAP[bien.statut] ?? { label: bien.statut, color: S.text3, bg: S.border };
  const loc = bien.locataire_actif;
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
            <Badge label={TYPE_MAP[bien.type] ?? bien.type} color={S.orange} bg={S.orangeBg} />
            <Badge label={s.label} color={s.color} bg={s.bg} />
          </div>
          <p style={{ fontSize: 14, fontWeight: 700, color: S.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {bien.adresse}
          </p>
          <p style={{ fontSize: 11, color: S.text3 }}>{bien.cp} {bien.ville}{bien.surface ? ` · ${bien.surface} m²` : ""}</p>
        </div>
      </div>

      {/* Locataire info */}
      <div style={{ padding: "0.65rem 0.85rem", borderRadius: 10, background: S.surface2, border: `1px solid ${S.border}` }}>
        {loc ? (
          <div>
            <p style={{ fontSize: 12, color: S.text2, fontWeight: 600 }}>
              Loyer · {bien.loyer ? `CHF ${Number(bien.loyer).toLocaleString("fr-CH")}` : "—"}/mois
            </p>
            {loc.date_sortie && (() => {
              const d = Math.round((new Date(loc.date_sortie).getTime() - Date.now()) / 86_400_000);
              return d <= 60 ? (
                <p style={{ fontSize: 11, color: S.red, display: "flex", alignItems: "center", gap: 3, marginTop: 2 }}>
                  <AlertTriangle size={10} /> Bail expire dans {d}j
                </p>
              ) : null;
            })()}
          </div>
        ) : (
          <p style={{ fontSize: 12, color: S.amber, fontWeight: 600 }}>
            Vacant
          </p>
        )}
      </div>

      {/* CTA */}
      <Link
        href={`/app/biens/${bien.id}`}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          padding: "8px 0", borderRadius: 10,
          border: `1px solid ${S.orange}30`, background: S.orangeBg,
          color: S.orange, fontSize: 12, fontWeight: 700, textDecoration: "none",
          transition: "background 0.15s",
        }}
      >
        Ouvrir fiche bien <ArrowRight size={12} />
      </Link>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DashboardManager
// ══════════════════════════════════════════════════════════════════════════════
interface Props {
  firstName: string;
  role: AppRole;
}

export function DashboardManager({ firstName, role }: Props) {
  const { isLoading, metrics, biens } = useManagerDashboard();

  const roleLabel = role === "super_admin" ? "Administrateur" : role === "agency" ? "Agence" : "Propriétaire";

  return (
    <div>
      {/* Greeting */}
      <div style={{ marginBottom: "1.75rem" }}>
        <p style={{ fontSize: 12, letterSpacing: "2px", textTransform: "uppercase", color: S.text3, marginBottom: 6 }}>
          {roleLabel}
        </p>
        <h1 style={{ fontSize: 32, fontWeight: 400, fontFamily: "var(--font-serif),'Cormorant Garamond',serif", color: S.text, marginBottom: 4, letterSpacing: "0.01em" }}>
          Bonjour{firstName ? `, ${firstName}` : ""}
        </h1>
        <p style={{ fontSize: 14, color: S.text3 }}>
          {new Date().toLocaleDateString("fr-CH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Briefing IA */}
      {!isLoading && (
        <BriefingIA
          biensVacants={metrics.biensVacants}
          loyersAttente={metrics.loyersAttente}
          interOuvertes={metrics.interOuvertes}
        />
      )}

      {/* Metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Card key={i}><Skel h={80} /></Card>)
        ) : (
          <>
            <MetricCard
              label="Loyers encaissés"
              value={fmtCHF(metrics.loyersMois)}
              sub="Ce mois-ci"
              icon={CheckCircle2}
              color={S.green}
              bg={S.greenBg}
              trend="up"
            />
            <MetricCard
              label="Loyers en attente"
              value={fmtCHF(metrics.loyersAttente)}
              sub="À recevoir"
              icon={Clock}
              color={metrics.loyersAttente > 0 ? S.amber : S.green}
              bg={metrics.loyersAttente > 0 ? S.amberBg : S.greenBg}
              trend={metrics.loyersAttente > 0 ? "down" : "neutral"}
            />
            <MetricCard
              label="Interventions ouvertes"
              value={String(metrics.interOuvertes)}
              sub="Travaux & incidents"
              icon={Wrench}
              color={metrics.interOuvertes > 0 ? S.orange : S.green}
              bg={metrics.interOuvertes > 0 ? S.orangeBg : S.greenBg}
              trend={metrics.interOuvertes > 0 ? "down" : "neutral"}
            />
            <MetricCard
              label="Biens vacants"
              value={String(metrics.biensVacants)}
              sub={`sur ${biens.length} bien${biens.length !== 1 ? "s" : ""}`}
              icon={Building2}
              color={metrics.biensVacants > 0 ? S.red : S.green}
              bg={metrics.biensVacants > 0 ? S.redBg : S.greenBg}
              trend={metrics.biensVacants > 0 ? "down" : "neutral"}
            />
          </>
        )}
      </div>

      {/* Biens list */}
      <div style={{ marginBottom: "0.75rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: S.text }}>Mes biens</h2>
        <Link href="/app/biens" style={{ fontSize: 12, color: S.orange, textDecoration: "none", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
          Voir tous <ArrowRight size={12} />
        </Link>
      </div>

      {isLoading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "1rem" }}>
          {Array.from({ length: 3 }).map((_, i) => <Card key={i}><Skel h={150} /></Card>)}
        </div>
      ) : biens.length === 0 ? (
        <Card style={{ textAlign: "center", padding: "2.5rem" }}>
          <Building2 size={32} style={{ margin: "0 auto 0.75rem", color: S.text3, opacity: 0.4 }} />
          <p style={{ fontWeight: 600, color: S.text2, marginBottom: 4 }}>Aucun bien enregistré</p>
          <p style={{ fontSize: 13, color: S.text3 }}>Commencez par ajouter votre premier bien.</p>
          <Link href="/app/properties/new" style={{
            display: "inline-flex", alignItems: "center", gap: 6, marginTop: "1rem",
            padding: "8px 18px", borderRadius: 10, background: S.orange, color: "#fff",
            fontSize: 13, fontWeight: 700, textDecoration: "none",
          }}>
            Ajouter un bien
          </Link>
        </Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "1rem" }}>
          {biens.map(b => <BienCard key={b.id} bien={b} />)}
        </div>
      )}
    </div>
  );
}
