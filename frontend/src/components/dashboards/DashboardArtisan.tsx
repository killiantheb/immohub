"use client";

import { useState } from "react";
import {
  ArrowRight, CheckCircle2, Clock, Euro, FileText,
  Navigation, RefreshCw, Send, TrendingUp, Wrench,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useArtisanDashboard, type Intervention, type Paiement } from "@/lib/hooks/useDashboardData";

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
function EmptyState({ icon: Icon, title, sub }: { icon: React.ElementType; title: string; sub?: string }) {
  return (
    <div style={{ textAlign: "center", padding: "3rem 1rem", color: S.text3 }}>
      <Icon size={32} style={{ margin: "0 auto 0.75rem", opacity: 0.35 }} />
      <p style={{ fontWeight: 600, color: S.text2, marginBottom: 4 }}>{title}</p>
      {sub && <p style={{ fontSize: 13 }}>{sub}</p>}
    </div>
  );
}

const CAT_LABELS: Record<string, string> = {
  plomberie: "Plomberie", electricite: "Électricité", menuiserie: "Menuiserie",
  peinture: "Peinture", serrurerie: "Serrurerie", chauffage: "Chauffage", autre: "Autre",
};
const STATUT_INTER: Record<string, { label: string; color: string; bg: string }> = {
  nouveau:  { label: "Nouveau",  color: S.blue,   bg: S.blueBg },
  en_cours: { label: "En cours", color: S.orange, bg: S.orangeBg },
  planifie: { label: "Planifié", color: S.amber,  bg: S.amberBg },
  resolu:   { label: "Résolu",   color: S.green,  bg: S.greenBg },
};

// ── Chantier card ─────────────────────────────────────────────────────────────
function ChantierCard({ inter, showDevisBtn = false }: { inter: Intervention; showDevisBtn?: boolean }) {
  const qc = useQueryClient();
  const update = useMutation({
    mutationFn: (avancement: number) =>
      api.patch(`/interventions-althy/${inter.id}`, { avancement }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dashboard", "artisan", "interventions"] }),
  });

  const s = STATUT_INTER[inter.statut] ?? { label: inter.statut, color: S.text3, bg: S.border };
  const [localAdv, setLocalAdv] = useState(inter.avancement);

  return (
    <Card>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: "0.75rem" }}>
        <div>
          <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
            <Badge label={CAT_LABELS[inter.categorie] ?? inter.categorie} color={S.orange} bg={S.orangeBg} />
            <Badge label={s.label} color={s.color} bg={s.bg} />
          </div>
          <p style={{ fontSize: 14, fontWeight: 700, color: S.text }}>{inter.titre}</p>
        </div>
      </div>

      {/* Info */}
      <p style={{ fontSize: 12, color: S.text3, marginBottom: "0.75rem" }}>
        Signalé le {fmtDate(inter.date_signalement ?? inter.created_at)} · Bien #{inter.bien_id.slice(0, 8)}
      </p>

      {/* Progress */}
      {inter.statut !== "nouveau" && (
        <div style={{ marginBottom: "0.75rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: S.text3 }}>Avancement</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: S.orange }}>{localAdv}%</span>
          </div>
          <input
            type="range" min={0} max={100} step={5}
            value={localAdv}
            onChange={e => setLocalAdv(Number(e.target.value))}
            onMouseUp={() => update.mutate(localAdv)}
            onTouchEnd={() => update.mutate(localAdv)}
            style={{ width: "100%", accentColor: S.orange, cursor: "pointer" }}
          />
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {inter.statut !== "nouveau" && (
          <button
            onClick={() => update.mutate(localAdv)}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 9, border: `1px solid ${S.border}`, background: S.surface, color: S.text2, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            <RefreshCw size={12} /> Mettre à jour
          </button>
        )}
        <a href={`https://maps.google.com/?q=bien+${inter.bien_id.slice(0, 8)}`} target="_blank" rel="noopener noreferrer"
          style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 9, border: `1px solid ${S.border}`, background: S.surface, color: S.blue, fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
          <Navigation size={12} /> Itinéraire
        </a>
        <button style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 9, border: "none", background: S.greenBg, color: S.green, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          <FileText size={12} /> Facturer
        </button>
        {showDevisBtn && (
          <button style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 9, border: "none", background: S.orangeBg, color: S.orange, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            <Send size={12} /> Envoyer devis
          </button>
        )}
      </div>
    </Card>
  );
}

// ── Tab: Chantiers ────────────────────────────────────────────────────────────
function TabChantiers({ enCours, nouveaux }: { enCours: Intervention[]; nouveaux: Intervention[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {enCours.length > 0 && (
        <section>
          <p style={{ fontSize: 12, fontWeight: 700, color: S.text3, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.75rem" }}>
            En cours ({enCours.length})
          </p>
          <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
            {enCours.map(i => <ChantierCard key={i.id} inter={i} />)}
          </div>
        </section>
      )}
      {nouveaux.length > 0 && (
        <section>
          <p style={{ fontSize: 12, fontWeight: 700, color: S.blue, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.75rem" }}>
            Appels d'offre — devis à envoyer ({nouveaux.length})
          </p>
          <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
            {nouveaux.map(i => <ChantierCard key={i.id} inter={i} showDevisBtn />)}
          </div>
        </section>
      )}
      {enCours.length === 0 && nouveaux.length === 0 && (
        <EmptyState icon={Wrench} title="Aucun chantier en cours" sub="Les nouvelles interventions apparaîtront ici." />
      )}
    </div>
  );
}

// ── Tab: Devis (stub — real data would come from /devis endpoint) ─────────────
const MOCK_DEVIS_STATUTS = ["accepte", "en_attente", "refuse"] as const;
const DEVIS_STATUT: Record<string, { label: string; color: string; bg: string }> = {
  accepte:    { label: "Accepté",    color: S.green,  bg: S.greenBg },
  en_attente: { label: "En attente", color: S.amber,  bg: S.amberBg },
  refuse:     { label: "Refusé",     color: S.red,    bg: S.redBg },
};
function TabDevis({ interventions }: { interventions: Intervention[] }) {
  if (!interventions.length) return <EmptyState icon={FileText} title="Aucun devis" sub="Envoyez un devis depuis la section Chantiers." />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {interventions.map(inter => {
        const statut = MOCK_DEVIS_STATUTS[Math.floor(Math.random() * 3)];
        const s = DEVIS_STATUT[statut];
        return (
          <div key={inter.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1rem", borderRadius: 12, border: `1px solid ${S.border}`, background: S.surface, gap: 12, flexWrap: "wrap" }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: S.text }}>{inter.titre}</p>
              <p style={{ fontSize: 11, color: S.text3 }}>
                {fmtDate(inter.created_at)} · {CAT_LABELS[inter.categorie] ?? inter.categorie}
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {inter.cout && <p style={{ fontSize: 13, fontWeight: 700, color: S.text }}>{fmtCHF(Number(inter.cout))}</p>}
              <Badge label={s.label} color={s.color} bg={s.bg} />
              {statut === "en_attente" && (
                <button style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 8, border: `1px solid ${S.border}`, background: S.surface, color: S.amber, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                  <RefreshCw size={10} /> Relancer
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Tab: Historique ───────────────────────────────────────────────────────────
function TabHistoriqueArtisan({ termines }: { termines: Intervention[] }) {
  const annee = new Date().getFullYear();
  const totalAnnee = termines.reduce((s, i) => s + Number(i.cout ?? 0), 0);
  return (
    <div>
      {/* Récap annuel */}
      <Card style={{ marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: S.greenBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <TrendingUp size={20} style={{ color: S.green }} />
        </div>
        <div>
          <p style={{ fontSize: 12, color: S.text3 }}>Récapitulatif {annee}</p>
          <p style={{ fontSize: 20, fontWeight: 800, color: S.green }}>{fmtCHF(totalAnnee)}</p>
          <p style={{ fontSize: 11, color: S.text3 }}>{termines.length} chantier{termines.length !== 1 ? "s" : ""} terminé{termines.length !== 1 ? "s" : ""}</p>
        </div>
      </Card>
      {!termines.length ? (
        <EmptyState icon={Clock} title="Aucun historique" sub="Les chantiers terminés apparaîtront ici." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {termines.map(i => (
            <div key={i.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1rem", borderRadius: 12, border: `1px solid ${S.border}`, background: S.surface }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <CheckCircle2 size={16} style={{ color: S.green, flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: S.text }}>{i.titre}</p>
                  <p style={{ fontSize: 11, color: S.text3 }}>{fmtDate(i.date_intervention)} · {CAT_LABELS[i.categorie]}</p>
                </div>
              </div>
              {i.cout && <p style={{ fontSize: 13, fontWeight: 700, color: S.green }}>{fmtCHF(Number(i.cout))}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tab: Paiements ────────────────────────────────────────────────────────────
function TabPaiementsArtisan({ paiements, metrics }: {
  paiements: Paiement[];
  metrics: { factureeMois: number; enAttentePaiement: number };
}) {
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        <Card style={{ textAlign: "center", padding: "1rem" }}>
          <p style={{ fontSize: 11, color: S.text3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Facturé ce mois</p>
          <p style={{ fontSize: 20, fontWeight: 800, color: S.green }}>{fmtCHF(metrics.factureeMois)}</p>
        </Card>
        <Card style={{ textAlign: "center", padding: "1rem" }}>
          <p style={{ fontSize: 11, color: S.text3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>En attente</p>
          <p style={{ fontSize: 20, fontWeight: 800, color: metrics.enAttentePaiement > 0 ? S.amber : S.text3 }}>
            {fmtCHF(metrics.enAttentePaiement)}
          </p>
        </Card>
      </div>
      {!paiements.length ? (
        <EmptyState icon={Euro} title="Aucun paiement" sub="Les paiements liés à vos chantiers apparaîtront ici." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {paiements.map(p => {
            const statusColor = p.statut === "recu" ? S.green : p.statut === "retard" ? S.red : S.amber;
            const statusLabel = p.statut === "recu" ? "Reçu" : p.statut === "retard" ? "Retard" : "En attente";
            return (
              <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1rem", borderRadius: 10, border: `1px solid ${S.border}`, background: S.surface }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor, flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: S.text }}>Paiement {p.mois}</p>
                    <p style={{ fontSize: 11, color: S.text3 }}>Éch. {fmtDate(p.date_echeance)}</p>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: S.text }}>{fmtCHF(Number(p.montant))}</p>
                  <Badge label={statusLabel} color={statusColor} bg={`${statusColor}18`} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DashboardArtisan
// ══════════════════════════════════════════════════════════════════════════════
type TabId = "chantiers" | "devis" | "historique" | "paiements";
const TABS: { id: TabId; label: string }[] = [
  { id: "chantiers",  label: "Chantiers" },
  { id: "devis",      label: "Devis" },
  { id: "historique", label: "Historique" },
  { id: "paiements",  label: "Paiements" },
];

export function DashboardArtisan({ firstName }: { firstName: string }) {
  const [tab, setTab] = useState<TabId>("chantiers");
  const { isLoading, chantiersEnCours, chantiersTermines, nouveauxAppels, paiements, metrics } = useArtisanDashboard();

  return (
    <div>
      {/* Greeting */}
      <div style={{ marginBottom: "1.75rem" }}>
        <p style={{ fontSize: 11, letterSpacing: "2px", textTransform: "uppercase", color: S.text3, marginBottom: 6 }}>Artisan</p>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: S.text, marginBottom: 4 }}>
          Bonjour{firstName ? `, ${firstName}` : ""} 👋
        </h1>
        <p style={{ fontSize: 13, color: S.text3 }}>
          {new Date().toLocaleDateString("fr-CH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "1rem", marginBottom: "1.75rem" }}>
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Card key={i}><Skel h={70} /></Card>)
        ) : (
          <>
            <Card style={{ textAlign: "center", padding: "1rem" }}>
              <p style={{ fontSize: 11, color: S.text3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Chantiers en cours</p>
              <p style={{ fontSize: 22, fontWeight: 800, color: S.orange }}>{chantiersEnCours.length}</p>
            </Card>
            <Card style={{ textAlign: "center", padding: "1rem" }}>
              <p style={{ fontSize: 11, color: S.text3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Devis envoyés</p>
              <p style={{ fontSize: 22, fontWeight: 800, color: S.blue }}>{nouveauxAppels.length}</p>
            </Card>
            <Card style={{ textAlign: "center", padding: "1rem" }}>
              <p style={{ fontSize: 11, color: S.text3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Facturé ce mois</p>
              <p style={{ fontSize: 22, fontWeight: 800, color: S.green }}>{fmtCHF(metrics.factureeMois)}</p>
            </Card>
            <Card style={{ textAlign: "center", padding: "1rem" }}>
              <p style={{ fontSize: 11, color: S.text3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>En attente paiement</p>
              <p style={{ fontSize: 22, fontWeight: 800, color: metrics.enAttentePaiement > 0 ? S.amber : S.text3 }}>
                {fmtCHF(metrics.enAttentePaiement)}
              </p>
            </Card>
          </>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, borderBottom: `1px solid ${S.border}`, marginBottom: "1.25rem", overflowX: "auto" }}>
        {TABS.map(t => {
          const active = tab === t.id;
          const count = t.id === "chantiers"
            ? chantiersEnCours.length + nouveauxAppels.length
            : t.id === "historique" ? chantiersTermines.length : 0;
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
          {tab === "chantiers"  && <TabChantiers enCours={chantiersEnCours} nouveaux={nouveauxAppels} />}
          {tab === "devis"      && <TabDevis interventions={[...chantiersEnCours, ...nouveauxAppels]} />}
          {tab === "historique" && <TabHistoriqueArtisan termines={chantiersTermines} />}
          {tab === "paiements"  && <TabPaiementsArtisan paiements={paiements} metrics={metrics} />}
        </>
      )}
    </div>
  );
}
