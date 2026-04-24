// src/app/app/(dashboard)/biens/[id]/_shared.tsx
// Composants et utilitaires partagés entre les sous-pages de la fiche bien
"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, CheckCircle2, ChevronRight,
  Clock, Download, Eye, FileText, Lightbulb, Loader2, MapPin,
  PiggyBank, Plus, RefreshCw, Sparkles, TrendingUp, User, Wrench, XCircle,
} from "lucide-react";
import {
  useBien, useDocuments, useInterventions, useLocataireActuel,
  useLocataires, usePaiements, useScoring, useCreateIntervention,
  type DocumentAlthy, type Locataire, type Paiement,
} from "@/lib/hooks/useBiens";
import { usePotentielIA } from "@/lib/hooks/useDashboardData";
import { api } from "@/lib/api";
import { C } from "@/lib/design-tokens";

// ── Design tokens ──────────────────────────────────────────────────────────────

// ── Helpers ────────────────────────────────────────────────────────────────────
export function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-CH", { day: "numeric", month: "short", year: "numeric" });
}
export function fmtMois(yyyyMM?: string | null) {
  if (!yyyyMM) return "—";
  const [y, m] = yyyyMM.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleDateString("fr-CH", { month: "long", year: "numeric" });
}
export function fmtCHF(n?: number | null) {
  if (n == null) return "—";
  return `CHF ${Number(n).toLocaleString("fr-CH")}`;
}
export function daysUntil(iso?: string | null): number | null {
  if (!iso) return null;
  return Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);
}
export function initials(str?: string | null) {
  if (!str) return "?";
  return str.trim().split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

// ── Atoms ──────────────────────────────────────────────────────────────────────
export function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 20, color, background: bg, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}
export function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, boxShadow: C.shadow, padding: "1.25rem", ...style }}>
      {children}
    </div>
  );
}
export function Skel({ h = 16, w = "100%" }: { h?: number; w?: string | number }) {
  return <div style={{ height: h, width: w, borderRadius: 6, background: C.border, opacity: 0.6 }} />;
}
export function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round((value / 10) * 100);
  const color = value >= 7 ? C.green : value >= 5 ? C.amber : C.red;
  return (
    <div style={{ marginBottom: "0.65rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 12, color: C.text2 }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>{value.toFixed(1)}/10</span>
      </div>
      <div style={{ height: 5, borderRadius: 99, background: C.border }}>
        <div style={{ height: "100%", width: `${pct}%`, borderRadius: 99, background: color, transition: "width 0.5s ease" }} />
      </div>
    </div>
  );
}
export function Empty({ icon: Icon, title, sub }: { icon: React.ElementType; title: string; sub?: string }) {
  return (
    <div style={{ textAlign: "center", padding: "3rem 1rem", color: C.text3 }}>
      <Icon size={34} style={{ margin: "0 auto 0.75rem", opacity: 0.35 }} />
      <p style={{ fontWeight: 600, color: C.text2, marginBottom: 4 }}>{title}</p>
      {sub && <p style={{ fontSize: 13 }}>{sub}</p>}
    </div>
  );
}
export function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
      <span style={{ fontSize: 12, color: C.text3 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: C.text, textAlign: "right" }}>{value}</span>
    </div>
  );
}

// ── Button styles ──────────────────────────────────────────────────────────────
export const btnP: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "8px 16px", borderRadius: 9, border: "none",
  background: C.orange, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
};
export const btnS: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "8px 16px", borderRadius: 9,
  border: `1px solid ${C.border}`, background: C.surface,
  color: C.text, fontSize: 13, fontWeight: 600, cursor: "pointer",
};
export const iconBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  width: 30, height: 30, borderRadius: 8,
  border: `1px solid ${C.border}`, background: C.surface,
  color: C.text2, textDecoration: "none",
};

// ── Statut maps ────────────────────────────────────────────────────────────────
export const BIEN_STATUT: Record<string, { label: string; color: string; bg: string }> = {
  loue:       { label: "Loué",       color: C.green,  bg: C.greenBg },
  vacant:     { label: "Vacant",     color: C.amber,  bg: C.amberBg },
  en_travaux: { label: "En travaux", color: C.blue,   bg: C.blueBg },
};
export const INTER_STATUT: Record<string, { label: string; color: string; bg: string }> = {
  nouveau:  { label: "Nouveau",  color: C.blue,   bg: C.blueBg },
  en_cours: { label: "En cours", color: C.orange, bg: C.orangeBg },
  planifie: { label: "Planifié", color: C.amber,  bg: C.amberBg },
  resolu:   { label: "Résolu",   color: C.green,  bg: C.greenBg },
};
export const INTER_URGENCE: Record<string, string> = {
  faible: C.green, moderee: C.amber, urgente: C.orange, tres_urgente: C.red,
};
export const PAI_STATUT: Record<string, { label: string; color: string; bg: string }> = {
  recu:       { label: "Reçu",       color: C.green, bg: C.greenBg },
  en_attente: { label: "En attente", color: C.amber, bg: C.amberBg },
  retard:     { label: "En retard",  color: C.red,   bg: C.redBg },
};
export const DOC_LABELS: Record<string, string> = {
  bail: "Bail", edl_entree: "EDL entrée", edl_sortie: "EDL sortie",
  quittance: "Quittance", attestation_assurance: "Attestation assurance",
  contrat_travail: "Contrat travail", fiche_salaire: "Fiche de salaire",
  extrait_poursuites: "Extrait poursuites", attestation_caution: "Att. caution", autre: "Autre",
};
export const CAT_LABELS: Record<string, string> = {
  plomberie: "Plomberie", electricite: "Électricité", menuiserie: "Menuiserie",
  peinture: "Peinture", serrurerie: "Serrurerie", chauffage: "Chauffage", autre: "Autre",
};
export const BIEN_TYPE_LABELS: Record<string, string> = {
  appartement: "Appartement", villa: "Villa", studio: "Studio", maison: "Maison",
  commerce: "Commerce", bureau: "Bureau", parking: "Parking", garage: "Garage", cave: "Cave", autre: "Autre",
};

// ══════════════════════════════════════════════════════════════════════════════
// BienHeader
// ══════════════════════════════════════════════════════════════════════════════
export function BienHeader({ bienId }: { bienId: string }) {
  const { data: bien, isLoading } = useBien(bienId);
  if (isLoading) return (
    <Card style={{ marginBottom: "1.5rem" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Skel h={26} w="55%" /><Skel h={16} w="40%" /><Skel h={14} w="30%" />
      </div>
    </Card>
  );
  if (!bien) return null;
  const s = BIEN_STATUT[bien.statut] ?? { label: bien.statut, color: C.text2, bg: C.border };
  return (
    <Card style={{ marginBottom: "1rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "1.25rem", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <Badge label={BIEN_TYPE_LABELS[bien.type] ?? bien.type} color={C.orange} bg={C.orangeBg} />
            <Badge label={s.label} color={s.color} bg={s.bg} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 3 }}>{bien.adresse}</h1>
          <p style={{ fontSize: 14, color: C.text2, display: "flex", alignItems: "center", gap: 4 }}>
            <MapPin size={13} />{bien.cp} {bien.ville}
          </p>
          {bien.surface && (
            <p style={{ fontSize: 12, color: C.text3, marginTop: 2 }}>
              {bien.surface} m²{bien.etage != null ? ` · Étage ${bien.etage}` : ""}
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
          {[
            { label: "Loyer", val: bien.loyer },
            { label: "Charges", val: bien.charges },
          ].filter(m => m.val != null).map(m => (
            <div key={m.label} style={{ textAlign: "center" }}>
              <p style={{ fontSize: 10, color: C.text3, textTransform: "uppercase", letterSpacing: "0.06em" }}>{m.label}</p>
              <p style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{fmtCHF(m.val)}</p>
              <p style={{ fontSize: 10, color: C.text3 }}>/ mois</p>
            </div>
          ))}
          {bien.loyer && bien.loyer > 0 && (
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 10, color: C.text3, textTransform: "uppercase", letterSpacing: "0.06em" }}>Rendement</p>
              <p style={{ fontSize: 18, fontWeight: 700, color: C.green }}>
                {(((bien.loyer - (bien.charges ?? 0)) * 12) / (bien.loyer * 266.67) * 100).toFixed(1)}%
              </p>
              <p style={{ fontSize: 10, color: C.text3 }}>brut estimé</p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TabLocataire
// ══════════════════════════════════════════════════════════════════════════════
export function TabLocataire({ bienId }: { bienId: string }) {
  const { data: locataire, isLoading } = useLocataireActuel(bienId);
  const { data: scoring, isLoading: loadScore } = useScoring(locataire?.id);
  const { data: paiements } = usePaiements(bienId);
  const moisCourant = new Date().toISOString().slice(0, 7);
  const pMois = paiements?.find(p => p.mois === moisCourant);
  const daysFin = daysUntil(locataire?.date_sortie);

  if (isLoading) return (
    <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))" }}>
      <Card><Skel h={180} /></Card><Card><Skel h={120} /></Card><Card><Skel h={160} /></Card>
    </div>
  );
  if (!locataire) return <Empty icon={User} title="Aucun locataire actuel" sub="Ce bien est vacant." />;

  const ps = pMois ? PAI_STATUT[pMois.statut] : null;
  return (
    <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))" }}>
      {/* Contact & bail */}
      <Card>
        <p style={{ fontSize: 11, fontWeight: 700, color: C.text3, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "1rem" }}>Contact & bail</p>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1rem" }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: C.orangeBg, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: C.orange }}>
            {initials(locataire.id)}
          </div>
          <div>
            <p style={{ fontWeight: 600, color: C.text }}>Locataire</p>
            <p style={{ fontSize: 11, color: C.text3 }}>#{locataire.id.slice(0, 8)}</p>
          </div>
        </div>
        <InfoRow label="Statut" value={<Badge label="Actif" color={C.green} bg={C.greenBg} />} />
        <InfoRow label="Entrée" value={fmtDate(locataire.date_entree)} />
        <InfoRow label="Sortie prévue" value={
          locataire.date_sortie
            ? <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {fmtDate(locataire.date_sortie)}
                {daysFin !== null && daysFin <= 60 && (
                  <span style={{ fontSize: 11, color: C.red, fontWeight: 700, display: "flex", alignItems: "center", gap: 2 }}>
                    <AlertTriangle size={10} />{daysFin}j
                  </span>
                )}
              </span>
            : "—"
        } />
        <InfoRow label="Loyer" value={fmtCHF(locataire.loyer)} />
        <InfoRow label="Charges" value={fmtCHF(locataire.charges)} />
        <InfoRow label="Dépôt garantie" value={fmtCHF(locataire.depot_garantie)} />
        {locataire.type_caution && <InfoRow label="Caution" value={locataire.type_caution.replace("_", " ")} />}
        {daysFin !== null && daysFin <= 60 && (
          <div style={{ marginTop: "0.75rem", padding: "0.65rem 0.9rem", borderRadius: 10, background: C.redBg, display: "flex", gap: 8, alignItems: "flex-start" }}>
            <AlertTriangle size={14} style={{ color: C.red, flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 12, color: C.red, lineHeight: 1.4 }}>
              Bail se termine dans <strong>{daysFin} jour{daysFin !== 1 ? "s" : ""}</strong>. Pensez au renouvellement ou à la résiliation.
            </p>
          </div>
        )}
        <button style={{ ...btnP, marginTop: "1rem" }}>
          <RefreshCw size={12} /> Proposer renouvellement
        </button>
      </Card>

      {/* Paiement du mois */}
      <Card>
        <p style={{ fontSize: 11, fontWeight: 700, color: C.text3, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "1rem" }}>
          Paiement · {fmtMois(moisCourant)}
        </p>
        {ps && pMois ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "1rem" }}>
              {pMois.statut === "recu"
                ? <CheckCircle2 size={30} style={{ color: C.green }} />
                : pMois.statut === "retard"
                ? <XCircle size={30} style={{ color: C.red }} />
                : <Clock size={30} style={{ color: C.amber }} />}
              <div>
                <p style={{ fontSize: 22, fontWeight: 800, color: C.text }}>{fmtCHF(pMois.montant)}</p>
                <Badge label={ps.label} color={ps.color} bg={ps.bg} />
              </div>
            </div>
            <InfoRow label="Échéance" value={fmtDate(pMois.date_echeance)} />
            {pMois.date_paiement && <InfoRow label="Reçu le" value={fmtDate(pMois.date_paiement)} />}
            {pMois.jours_retard > 0 && <InfoRow label="Retard" value={`${pMois.jours_retard} jours`} />}
          </>
        ) : (
          <Empty icon={Clock} title="Aucun paiement" sub={`Pour ${fmtMois(moisCourant)}`} />
        )}
      </Card>

      {/* Scoring IA */}
      <Card>
        <p style={{ fontSize: 11, fontWeight: 700, color: C.text3, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "1rem" }}>
          Scoring IA
        </p>
        {loadScore ? <Skel h={140} /> : scoring ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "1rem" }}>
              <div style={{
                width: 52, height: 52, borderRadius: "50%",
                background: scoring.score_global >= 7 ? C.greenBg : scoring.score_global >= 5 ? C.amberBg : C.redBg,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ fontSize: 19, fontWeight: 800, color: scoring.score_global >= 7 ? C.green : scoring.score_global >= 5 ? C.amber : C.red }}>
                  {scoring.score_global.toFixed(1)}
                </span>
              </div>
              <div>
                <p style={{ fontWeight: 600, color: C.text }}>Score global</p>
                <p style={{ fontSize: 12, color: C.text3 }}>{scoring.nb_retards} retard{scoring.nb_retards !== 1 ? "s" : ""} enregistré{scoring.nb_retards !== 1 ? "s" : ""}</p>
              </div>
            </div>
            <ScoreBar label="Ponctualité" value={scoring.ponctualite} />
            <ScoreBar label="Solvabilité" value={scoring.solvabilite} />
            <ScoreBar label="Communication" value={scoring.communication} />
            <ScoreBar label="État du logement" value={scoring.etat_logement} />
          </>
        ) : (
          <Empty icon={TrendingUp} title="Scoring non disponible" sub="Aucun historique de scoring." />
        )}
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TabHistorique
// ══════════════════════════════════════════════════════════════════════════════
export function TabHistorique({ bienId }: { bienId: string }) {
  const { data: anciens, isLoading } = useLocataires(bienId, "sorti");
  if (isLoading) return <Card><Skel h={120} /></Card>;
  if (!anciens?.length) return <Empty icon={User} title="Aucun historique" sub="Aucun ancien locataire enregistré." />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {anciens.map(loc => (
        <Card key={loc.id}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "space-between", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: C.surface2, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, color: C.text2, flexShrink: 0 }}>
                L
              </div>
              <div>
                <p style={{ fontWeight: 600, color: C.text }}>Locataire #{loc.id.slice(0, 8)}</p>
                <p style={{ fontSize: 12, color: C.text2 }}>
                  {fmtDate(loc.date_entree)} → {fmtDate(loc.date_sortie)}
                </p>
                {loc.motif_depart && (
                  <p style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>Motif: {loc.motif_depart}</p>
                )}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {loc.loyer && <span style={{ fontSize: 13, color: C.text3 }}>{fmtCHF(loc.loyer)}/m</span>}
              <Badge label="Sortie propre" color={C.green} bg={C.greenBg} />
              <Link
                href={`/app/biens/${bienId}/historique/${loc.id}`}
                style={{ ...btnS, marginTop: 0, textDecoration: "none", fontSize: 12 }}
              >
                Voir dossier <ChevronRight size={11} />
              </Link>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TabDocuments
// ══════════════════════════════════════════════════════════════════════════════
export function TabDocuments({ bienId }: { bienId: string }) {
  const { data: docs, isLoading } = useDocuments(bienId);
  if (isLoading) return <Card><Skel h={200} /></Card>;
  const grouped = (docs ?? []).reduce<Record<string, DocumentAlthy[]>>((acc, d) => {
    (acc[d.type] ??= []).push(d);
    return acc;
  }, {});
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem" }}>
        <button style={btnS}>
          <Plus size={13} /> Générer document IA
        </button>
      </div>
      {!docs?.length
        ? <Empty icon={FileText} title="Aucun document" sub="Déposez ou générez vos premiers documents." />
        : Object.entries(grouped).map(([type, items]) => (
          <div key={type} style={{ marginBottom: "1.25rem" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: C.text3, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
              {DOC_LABELS[type] ?? type}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {items.map(doc => (
                <div key={doc.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.7rem 1rem", borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <FileText size={15} style={{ color: doc.genere_par_ia ? C.orange : C.text3, flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{DOC_LABELS[doc.type] ?? doc.type}</p>
                      <p style={{ fontSize: 11, color: C.text3 }}>
                        {fmtDate(doc.date_document ?? doc.created_at)}
                        {doc.genere_par_ia && <span style={{ marginLeft: 6, color: C.orange, fontWeight: 600 }}>· IA</span>}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <a href={doc.url_storage} target="_blank" rel="noopener noreferrer" style={iconBtn}><Eye size={13} /></a>
                    <a href={doc.url_storage} download style={iconBtn}><Download size={13} /></a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      }
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TabInterventions
// ══════════════════════════════════════════════════════════════════════════════
export function TabInterventions({ bienId }: { bienId: string }) {
  const { data: interventions, isLoading } = useInterventions(bienId);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ titre: "", categorie: "autre", urgence: "moderee", description: "" });
  const create = useCreateIntervention();

  const handleCreate = async () => {
    if (!form.titre.trim()) return;
    await create.mutateAsync({
      ...form, bien_id: bienId, statut: "nouveau", avancement: 0,
    } as Parameters<typeof create.mutateAsync>[0]);
    setShowForm(false);
    setForm({ titre: "", categorie: "autre", urgence: "moderee", description: "" });
  };

  if (isLoading) return <Card><Skel h={200} /></Card>;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem" }}>
        <button style={btnP} onClick={() => setShowForm(v => !v)}>
          <Plus size={13} /> Nouvelle intervention
        </button>
      </div>
      {showForm && (
        <Card style={{ marginBottom: "1rem" }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: "1rem" }}>Nouvelle intervention</p>
          <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "1fr 1fr" }}>
            <div style={{ gridColumn: "1/-1" }}>
              <label style={{ fontSize: 12, color: C.text2, display: "block", marginBottom: 4 }}>Titre *</label>
              <input className="input" value={form.titre} onChange={e => setForm(f => ({ ...f, titre: e.target.value }))} placeholder="Ex: Fuite robinet cuisine" />
            </div>
            <div>
              <label style={{ fontSize: 12, color: C.text2, display: "block", marginBottom: 4 }}>Catégorie</label>
              <select className="input" value={form.categorie} onChange={e => setForm(f => ({ ...f, categorie: e.target.value }))}>
                {Object.entries(CAT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: C.text2, display: "block", marginBottom: 4 }}>Urgence</label>
              <select className="input" value={form.urgence} onChange={e => setForm(f => ({ ...f, urgence: e.target.value }))}>
                <option value="faible">Faible</option>
                <option value="moderee">Modérée</option>
                <option value="urgente">Urgente</option>
                <option value="tres_urgente">Très urgente</option>
              </select>
            </div>
            <div style={{ gridColumn: "1/-1" }}>
              <label style={{ fontSize: 12, color: C.text2, display: "block", marginBottom: 4 }}>Description</label>
              <textarea className="input" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Décrivez le problème…" />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: "1rem" }}>
            <button style={btnP} onClick={handleCreate} disabled={create.isPending}>
              {create.isPending && <Loader2 size={12} className="animate-spin" />} Créer
            </button>
            <button style={btnS} onClick={() => setShowForm(false)}>Annuler</button>
          </div>
        </Card>
      )}
      {!interventions?.length
        ? <Empty icon={Wrench} title="Aucune intervention" sub="Aucun travaux ou incident signalé." />
        : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {interventions.map(inter => {
              const s = INTER_STATUT[inter.statut] ?? { label: inter.statut, color: C.text2, bg: C.border };
              const uColor = INTER_URGENCE[inter.urgence] ?? C.text2;
              return (
                <Card key={inter.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: uColor, flexShrink: 0 }} />
                        <p style={{ fontWeight: 600, color: C.text }}>{inter.titre}</p>
                        <Badge label={s.label} color={s.color} bg={s.bg} />
                      </div>
                      <p style={{ fontSize: 12, color: C.text2 }}>
                        {CAT_LABELS[inter.categorie] ?? inter.categorie} · {fmtDate(inter.date_signalement ?? inter.created_at)}
                      </p>
                      {inter.artisan_id && <p style={{ fontSize: 12, color: C.blue, marginTop: 2 }}>Artisan assigné</p>}
                      {inter.cout != null && <p style={{ fontSize: 12, color: C.text3 }}>Coût estimé: {fmtCHF(inter.cout)}</p>}
                    </div>
                    <div style={{ textAlign: "right", minWidth: 100 }}>
                      <p style={{ fontSize: 11, color: C.text3, marginBottom: 4 }}>{inter.avancement}%</p>
                      <div style={{ width: 100, height: 4, borderRadius: 99, background: C.border }}>
                        <div style={{ height: "100%", width: `${inter.avancement}%`, borderRadius: 99, background: inter.avancement === 100 ? C.green : C.orange }} />
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )
      }
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TabFinances
// ══════════════════════════════════════════════════════════════════════════════
export function TabFinances({ bienId }: { bienId: string }) {
  const { data: bien } = useBien(bienId);
  const { data: paiements, isLoading } = usePaiements(bienId);
  const [qLoading, setQLoading] = useState(false);
  const [qError, setQError] = useState<string | null>(null);

  async function handleQuittance() {
    setQLoading(true);
    setQError(null);
    try {
      const mois = new Date().toISOString().slice(0, 7);
      const { data } = await api.post("/loyers/quittance", { bien_id: bienId, mois });
      if (data.download_url) {
        window.open(data.download_url, "_blank");
      } else {
        const bin = atob(data.pdf_base64);
        const buf = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
        const blob = new Blob([buf], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setQError(msg ?? "Erreur lors de la génération de la quittance");
    } finally {
      setQLoading(false);
    }
  }

  if (isLoading) return <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}><Skel h={80} /><Skel h={300} /></div>;
  const recus = (paiements ?? []).filter(p => p.statut === "recu");
  const totalEncaisse = recus.reduce((s, p) => s + Number(p.montant), 0);
  const totalCharges = recus.length * (bien?.charges ?? 0);
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        {[
          { label: "Encaissé", val: fmtCHF(totalEncaisse), color: C.green },
          { label: "Charges", val: fmtCHF(totalCharges), color: C.amber },
          { label: "Net", val: fmtCHF(totalEncaisse - totalCharges), color: (totalEncaisse - totalCharges) >= 0 ? C.green : C.red },
        ].map(m => (
          <Card key={m.label} style={{ textAlign: "center", padding: "1rem" }}>
            <p style={{ fontSize: 10, color: C.text3, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{m.label}</p>
            <p style={{ fontSize: 20, fontWeight: 800, color: m.color }}>{m.val}</p>
          </Card>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
        <button
          style={{ ...btnP, opacity: qLoading ? 0.6 : 1 }}
          onClick={handleQuittance}
          disabled={qLoading}
        >
          {qLoading ? <><Loader2 size={13} className="animate-spin" /> Génération…</> : <><FileText size={13} /> Générer quittance</>}
        </button>
        {qError && <p style={{ fontSize: 12, color: C.red, margin: 0 }}>{qError}</p>}
      </div>
      {!paiements?.length
        ? <Empty icon={TrendingUp} title="Aucun mouvement" sub="Aucun paiement enregistré pour ce bien." />
        : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[...paiements].sort((a, b) => b.mois.localeCompare(a.mois)).map(p => {
              const ps = PAI_STATUT[p.statut] ?? { label: p.statut, color: C.text2, bg: C.border };
              return (
                <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1rem", borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: ps.color, flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{fmtMois(p.mois)}</p>
                      <p style={{ fontSize: 11, color: C.text3 }}>Éch. {fmtDate(p.date_echeance)}{p.jours_retard > 0 ? ` · ${p.jours_retard}j retard` : ""}</p>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{fmtCHF(p.montant)}</p>
                    <Badge label={ps.label} color={ps.color} bg={ps.bg} />
                  </div>
                </div>
              );
            })}
          </div>
        )
      }
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TabPotentielIA
// ══════════════════════════════════════════════════════════════════════════════
function ScoreRing({ score }: { score: number }) {
  const color = score >= 7 ? C.green : score >= 5 ? C.amber : C.red;
  const bg = score >= 7 ? C.greenBg : score >= 5 ? C.amberBg : C.redBg;
  return (
    <div style={{
      width: 72, height: 72, borderRadius: "50%",
      background: bg, border: `3px solid ${color}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      flexDirection: "column",
    }}>
      <span style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 300, color, lineHeight: 1 }}>
        {score.toFixed(1)}
      </span>
      <span style={{ fontSize: 9, color, textTransform: "uppercase", letterSpacing: "0.05em" }}>/10</span>
    </div>
  );
}

function PotentielBloc({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <p style={{ fontSize: 11, fontWeight: 700, color: C.text3, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.85rem" }}>
        {title}
      </p>
      {children}
    </Card>
  );
}

export function TabPotentielIA({ bienId }: { bienId: string }) {
  const { data, isLoading, error, refetch, isFetching } = usePotentielIA(bienId);

  if (isLoading) {
    return (
      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))" }}>
        {Array.from({ length: 7 }).map((_, i) => <Card key={i}><Skel h={100} /></Card>)}
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card style={{ textAlign: "center", padding: "2.5rem" }}>
        <Sparkles size={32} style={{ margin: "0 auto 0.75rem", color: C.text3, opacity: 0.4 }} />
        <p style={{ fontWeight: 600, color: C.text2, marginBottom: 4 }}>Analyse non disponible</p>
        <p style={{ fontSize: 13, color: C.text3, marginBottom: "1rem" }}>
          L&apos;analyse IA nécessite un loyer renseigné pour ce bien.
        </p>
        <button style={btnP} onClick={() => refetch()} disabled={isFetching}>
          {isFetching && <Loader2 size={12} className="animate-spin" />}
          Générer l&apos;analyse
        </button>
      </Card>
    );
  }

  const fCHF = (n: number) => n > 0 ? `CHF ${Math.round(n).toLocaleString("fr-CH")}` : "—";
  const fPct = (n: number) => `${n.toFixed(2)} %`;

  return (
    <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
      <PotentielBloc title="Valeur estimée du bien">
        <div style={{ display: "flex", gap: "1.5rem", alignItems: "flex-end" }}>
          <div>
            <p style={{ fontSize: 11, color: C.text3, marginBottom: 2 }}>Fourchette</p>
            <p style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 300, color: C.text }}>
              {fCHF(data.valeur_min)} – {fCHF(data.valeur_max)}
            </p>
          </div>
        </div>
        <p style={{ fontSize: 11, color: C.text3, marginTop: 6 }}>
          Estimation basée sur multiplicateur 200–260× loyer mensuel (marché CH)
        </p>
      </PotentielBloc>

      <PotentielBloc title="Rendement locatif">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            { label: "Brut", val: fPct(data.rendement_brut), color: C.green },
            { label: "Net charges", val: fPct(data.rendement_net), color: C.text2 },
          ].map(m => (
            <div key={m.label} style={{ padding: "0.75rem", borderRadius: 10, background: C.surface2, border: `1px solid ${C.border}`, textAlign: "center" }}>
              <p style={{ fontSize: 10, color: C.text3, textTransform: "uppercase", letterSpacing: "0.06em" }}>{m.label}</p>
              <p style={{ fontFamily: "var(--font-serif)", fontSize: 20, fontWeight: 300, color: m.color }}>{m.val}</p>
            </div>
          ))}
        </div>
      </PotentielBloc>

      <PotentielBloc title="Loyer vs marché">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div>
            <p style={{ fontSize: 11, color: C.text3 }}>Actuel</p>
            <p style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{fCHF(data.loyer_actuel)}/m</p>
          </div>
          <div style={{ fontSize: 20, color: C.text3 }}>→</div>
          <div>
            <p style={{ fontSize: 11, color: C.text3 }}>Marché estimé</p>
            <p style={{ fontSize: 18, fontWeight: 700, color: C.orange }}>{fCHF(data.loyer_marche)}/m</p>
          </div>
        </div>
        {data.ecart_marche_pct > 0 && (
          <div style={{ padding: "6px 10px", borderRadius: 8, background: C.greenBg, fontSize: 12, color: C.green, fontWeight: 600 }}>
            +{data.ecart_marche_pct}% de potentiel de revalorisation
          </div>
        )}
      </PotentielBloc>

      <PotentielBloc title="Score investissement">
        <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
          <ScoreRing score={data.score_investissement} />
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
              {data.score_investissement >= 7 ? "Excellent" : data.score_investissement >= 5 ? "Correct" : "À améliorer"}
            </p>
            <p style={{ fontSize: 12, color: C.text3 }}>Score global Althy IA</p>
            <p style={{ fontSize: 11, color: C.text3, marginTop: 3 }}>
              Basé sur rendement, statut, surface et loyer marché
            </p>
          </div>
        </div>
      </PotentielBloc>

      <PotentielBloc title="Recommandations IA">
        {data.recommandations.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.recommandations.map((rec, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <div style={{
                  width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                  background: C.orangeBg, color: C.orange,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, fontWeight: 800,
                }}>{i + 1}</div>
                <p style={{ fontSize: 13, color: C.text2, lineHeight: 1.45 }}>{rec}</p>
              </div>
            ))}
          </div>
        ) : (
          <Empty icon={Lightbulb} title="Aucune recommandation" />
        )}
      </PotentielBloc>

      <PotentielBloc title="Optimisation fiscale CH">
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <PiggyBank size={18} style={{ color: C.green, flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: 13, color: C.text2, lineHeight: 1.55 }}>
            {data.conseil_fiscal || "—"}
          </p>
        </div>
      </PotentielBloc>

      <PotentielBloc title="Prochaine action prioritaire">
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            background: C.orangeBg, color: C.orange,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <TrendingUp size={14} />
          </div>
          <p style={{ fontSize: 14, fontWeight: 600, color: C.text, lineHeight: 1.45 }}>
            {data.prochaine_action || "—"}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          style={{ ...btnS, marginTop: "1rem", fontSize: 12 }}
        >
          {isFetching ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          Régénérer l&apos;analyse
        </button>
      </PotentielBloc>
    </div>
  );
}
