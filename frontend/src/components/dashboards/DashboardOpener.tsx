"use client";

import { useState } from "react";
import {
  ArrowRight, CheckCircle2, Clock, Euro, Map, Navigation,
  ThumbsDown, ThumbsUp, TrendingUp, X,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useOuvreurDashboard, type MissionOuvreur } from "@/lib/hooks/useDashboardData";

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
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtCHF(n: number) {
  return `CHF ${n.toLocaleString("fr-CH")}`;
}
function fmtTime(t?: string | null) {
  if (!t) return "—";
  return t.slice(0, 5);
}
function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-CH", { day: "numeric", month: "short" });
}

// ── Atoms ─────────────────────────────────────────────────────────────────────
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: S.surface, borderRadius: 16, border: `1px solid ${S.border}`, boxShadow: S.shadow, padding: "1.25rem", ...style }}>
      {children}
    </div>
  );
}
function Skel({ h = 16 }: { h?: number }) {
  return <div style={{ height: h, borderRadius: 8, background: S.border, opacity: 0.5 }} />;
}
function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: 20, color, background: bg }}>{label}</span>;
}

const TYPE_LABEL: Record<string, string> = {
  visite: "Visite", edl_entree: "EDL entrée", edl_sortie: "EDL sortie",
  remise_cles: "Remise clés", expertise: "Expertise",
};
const STATUT_MAP: Record<string, { label: string; color: string; bg: string }> = {
  proposee:  { label: "Proposée",  color: S.blue,   bg: S.blueBg },
  acceptee:  { label: "Acceptée",  color: S.green,  bg: S.greenBg },
  effectuee: { label: "Effectuée", color: S.text3,  bg: S.border },
  annulee:   { label: "Annulée",   color: S.red,    bg: S.redBg },
};

// ── Mission card ──────────────────────────────────────────────────────────────
function MissionCard({ mission, showActions = false }: { mission: MissionOuvreur; showActions?: boolean }) {
  const qc = useQueryClient();
  const accept = useMutation({
    mutationFn: () => api.patch(`/ouvreurs/missions/${mission.id}`, { statut: "acceptee" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dashboard", "ouvreur", "missions"] }),
  });
  const refuse = useMutation({
    mutationFn: () => api.patch(`/ouvreurs/missions/${mission.id}`, { statut: "annulee" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dashboard", "ouvreur", "missions"] }),
  });

  const s = STATUT_MAP[mission.statut] ?? { label: mission.statut, color: S.text3, bg: S.border };
  const isToday = mission.date_mission === new Date().toISOString().slice(0, 10);
  return (
    <Card style={{ position: "relative" }}>
      {isToday && (
        <div style={{ position: "absolute", top: 14, right: 14, width: 8, height: 8, borderRadius: "50%", background: S.green }} />
      )}
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: "0.75rem" }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: S.orangeBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Map size={18} style={{ color: S.orange }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 3, flexWrap: "wrap" }}>
            <Badge label={TYPE_LABEL[mission.type] ?? mission.type} color={S.orange} bg={S.orangeBg} />
            <Badge label={s.label} color={s.color} bg={s.bg} />
          </div>
          <p style={{ fontSize: 13, color: S.text2 }}>
            {fmtDate(mission.date_mission)}
            {mission.creneau_debut && ` · ${fmtTime(mission.creneau_debut as unknown as string)} – ${fmtTime(mission.creneau_fin as unknown as string)}`}
          </p>
        </div>
      </div>

      {/* Info rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: "0.75rem" }}>
        <InfoPill icon={Map} text={`Bien #${mission.bien_id.slice(0, 8)}`} />
        {mission.nb_candidats > 0 && <InfoPill icon={TrendingUp} text={`${mission.nb_candidats} candidat${mission.nb_candidats !== 1 ? "s" : ""}`} />}
        {mission.remuneration != null && <InfoPill icon={Euro} text={fmtCHF(Number(mission.remuneration))} accent />}
      </div>

      {/* Actions */}
      {showActions && mission.statut === "proposee" ? (
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => accept.mutate()} disabled={accept.isPending}
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "8px", borderRadius: 10, border: "none", background: S.greenBg, color: S.green, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            <ThumbsUp size={13} /> Accepter
          </button>
          <button onClick={() => refuse.mutate()} disabled={refuse.isPending}
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "8px", borderRadius: 10, border: "none", background: S.redBg, color: S.red, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            <ThumbsDown size={13} /> Refuser
          </button>
        </div>
      ) : mission.statut === "acceptee" ? (
        <div style={{ display: "flex", gap: 6 }}>
          <button style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "8px", borderRadius: 10, border: `1px solid ${S.border}`, background: S.surface, color: S.text2, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            Brief mission
          </button>
          <a
            href={`https://maps.google.com/?q=${mission.bien_id}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "8px 12px", borderRadius: 10, border: `1px solid ${S.border}`, background: S.surface, color: S.blue, fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
            <Navigation size={13} /> Itinéraire
          </a>
        </div>
      ) : null}
    </Card>
  );
}

function InfoPill({ icon: Icon, text, accent }: { icon: React.ElementType; text: string; accent?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <Icon size={12} style={{ color: accent ? S.orange : S.text3, flexShrink: 0 }} />
      <span style={{ fontSize: 12, color: accent ? S.orange : S.text2, fontWeight: accent ? 700 : 400 }}>{text}</span>
    </div>
  );
}

// ── Tab content ───────────────────────────────────────────────────────────────
function TabAujourdhui({ missions, proposees }: { missions: MissionOuvreur[]; proposees: MissionOuvreur[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {missions.length > 0 && (
        <section>
          <p style={{ fontSize: 12, fontWeight: 700, color: S.text3, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.75rem" }}>
            Missions du jour ({missions.length})
          </p>
          <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
            {missions.map(m => <MissionCard key={m.id} mission={m} />)}
          </div>
        </section>
      )}
      {proposees.length > 0 && (
        <section>
          <p style={{ fontSize: 12, fontWeight: 700, color: S.text3, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.75rem" }}>
            Nouvelles propositions ({proposees.length})
          </p>
          <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
            {proposees.map(m => <MissionCard key={m.id} mission={m} showActions />)}
          </div>
        </section>
      )}
      {missions.length === 0 && proposees.length === 0 && (
        <EmptyState icon={CheckCircle2} title="Aucune mission aujourd'hui" sub="Profitez de votre journée libre !" />
      )}
    </div>
  );
}

function TabAVenir({ missions }: { missions: MissionOuvreur[] }) {
  if (!missions.length) return <EmptyState icon={Clock} title="Aucune mission à venir" sub="Les prochaines missions apparaîtront ici." />;
  return (
    <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
      {missions.map(m => <MissionCard key={m.id} mission={m} />)}
    </div>
  );
}

function TabHistorique({ missions }: { missions: MissionOuvreur[] }) {
  if (!missions.length) return <EmptyState icon={Clock} title="Aucun historique" sub="Vos missions effectuées apparaîtront ici." />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {missions.map(m => {
        const s = STATUT_MAP[m.statut] ?? { label: m.statut, color: S.text3, bg: S.border };
        return (
          <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1rem", borderRadius: 12, border: `1px solid ${S.border}`, background: S.surface }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: S.text }}>{TYPE_LABEL[m.type] ?? m.type}</p>
                <p style={{ fontSize: 11, color: S.text3 }}>{fmtDate(m.date_mission)} · Bien #{m.bien_id.slice(0, 8)}</p>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              {m.remuneration != null && <p style={{ fontSize: 13, fontWeight: 700, color: S.green }}>{fmtCHF(Number(m.remuneration))}</p>}
              <Badge label={s.label} color={s.color} bg={s.bg} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TabRevenus({ missions, metrics }: { missions: MissionOuvreur[]; metrics: { gainsMois: number; nbMissionsMois: number; tauxAcceptation: number } }) {
  const mois = new Date().toISOString().slice(0, 7);
  const paiees = missions.filter(m => m.statut === "effectuee" && m.date_mission?.startsWith(mois));
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        {[
          { label: "Gagné ce mois", val: fmtCHF(metrics.gainsMois), color: S.green },
          { label: "Missions du mois", val: String(metrics.nbMissionsMois), color: S.blue },
          { label: "Taux d'acceptation", val: `${metrics.tauxAcceptation}%`, color: S.orange },
        ].map(m => (
          <Card key={m.label} style={{ textAlign: "center", padding: "1rem" }}>
            <p style={{ fontSize: 11, color: S.text3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{m.label}</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: m.color }}>{m.val}</p>
          </Card>
        ))}
      </div>
      <p style={{ fontSize: 12, fontWeight: 700, color: S.text3, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.75rem" }}>
        Détail ce mois
      </p>
      {paiees.length === 0 ? (
        <EmptyState icon={Euro} title="Aucun paiement ce mois" sub="Les missions effectuées apparaîtront ici." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {paiees.map(m => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.7rem 1rem", borderRadius: 10, border: `1px solid ${S.border}`, background: S.surface }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: S.text }}>{TYPE_LABEL[m.type] ?? m.type}</p>
                <p style={{ fontSize: 11, color: S.text3 }}>{fmtDate(m.date_mission)}</p>
              </div>
              <p style={{ fontSize: 14, fontWeight: 700, color: S.green }}>{fmtCHF(Number(m.remuneration ?? 0))}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ icon: Icon, title, sub }: { icon: React.ElementType; title: string; sub?: string }) {
  return (
    <div style={{ textAlign: "center", padding: "3rem 1rem", color: S.text3 }}>
      <Icon size={32} style={{ margin: "0 auto 0.75rem", opacity: 0.35 }} />
      <p style={{ fontWeight: 600, color: S.text2, marginBottom: 4 }}>{title}</p>
      {sub && <p style={{ fontSize: 13 }}>{sub}</p>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DashboardOpener
// ══════════════════════════════════════════════════════════════════════════════
type TabId = "today" | "upcoming" | "history" | "revenus";
const TABS: { id: TabId; label: string }[] = [
  { id: "today",    label: "Aujourd'hui" },
  { id: "upcoming", label: "À venir" },
  { id: "history",  label: "Historique" },
  { id: "revenus",  label: "Revenus" },
];

export function DashboardOpener({ firstName }: { firstName: string }) {
  const [tab, setTab] = useState<TabId>("today");
  const { isLoading, missionsDuJour, missionsProches, missionsProposees, missionsHistorique, metrics } = useOuvreurDashboard();

  return (
    <div>
      {/* Greeting + badge */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: "1.75rem" }}>
        <div>
          <p style={{ fontSize: 12, letterSpacing: "2px", textTransform: "uppercase", color: S.text3, marginBottom: 6 }}>Ouvreur</p>
          <h1 style={{ fontSize: 32, fontWeight: 400, fontFamily: "var(--font-serif),'Cormorant Garamond',serif", color: S.text, marginBottom: 4, letterSpacing: "0.01em" }}>
            Bonjour{firstName ? `, ${firstName}` : ""}
          </h1>
          <p style={{ fontSize: 14, color: S.text3 }}>
            {new Date().toLocaleDateString("fr-CH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        {!isLoading && (
          <div style={{ padding: "0.65rem 1.1rem", borderRadius: 12, background: missionsDuJour.length > 0 ? S.orangeBg : S.surface2, border: `1px solid ${missionsDuJour.length > 0 ? S.orange + "40" : S.border}` }}>
            <p style={{ fontSize: 11, color: S.text3, marginBottom: 2 }}>Missions aujourd'hui</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: missionsDuJour.length > 0 ? S.orange : S.text3 }}>
              {missionsDuJour.length}
            </p>
          </div>
        )}
      </div>

      {/* Metrics */}
      {!isLoading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem", marginBottom: "1.75rem" }}>
          {[
            { label: "Gains ce mois", val: fmtCHF(metrics.gainsMois), color: S.green },
            { label: "Missions du mois", val: String(metrics.nbMissionsMois), color: S.blue },
            { label: "Taux d'acceptation", val: `${metrics.tauxAcceptation}%`, color: S.orange },
          ].map(m => (
            <Card key={m.label} style={{ textAlign: "center", padding: "1rem" }}>
              <p style={{ fontSize: 11, color: S.text3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{m.label}</p>
              <p style={{ fontSize: 20, fontWeight: 800, color: m.color }}>{m.val}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, borderBottom: `1px solid ${S.border}`, marginBottom: "1.25rem", overflowX: "auto" }}>
        {TABS.map(t => {
          const active = tab === t.id;
          const count = t.id === "today"
            ? missionsDuJour.length + missionsProposees.length
            : t.id === "upcoming" ? missionsProches.length
            : t.id === "history" ? missionsHistorique.length
            : 0;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "10px 16px", background: "none", border: "none",
              borderBottom: `2px solid ${active ? S.orange : "transparent"}`,
              color: active ? S.orange : S.text3,
              fontWeight: active ? 700 : 500, fontSize: 13,
              cursor: "pointer", whiteSpace: "nowrap",
            }}>
              {t.label}
              {count > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 10, background: active ? S.orange : S.border, color: active ? "#fff" : S.text3 }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {isLoading ? <Skel h={200} /> : (
        <>
          {tab === "today"    && <TabAujourdhui missions={missionsDuJour} proposees={missionsProposees} />}
          {tab === "upcoming" && <TabAVenir missions={missionsProches} />}
          {tab === "history"  && <TabHistorique missions={missionsHistorique} />}
          {tab === "revenus"  && <TabRevenus missions={[...missionsDuJour, ...missionsProches, ...missionsHistorique]} metrics={metrics} />}
        </>
      )}
    </div>
  );
}
