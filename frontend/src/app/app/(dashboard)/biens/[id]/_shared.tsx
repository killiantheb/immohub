// src/app/app/(dashboard)/biens/[id]/_shared.tsx
// Composants et utilitaires partagés entre les sous-pages de la fiche bien
"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, Award, Building2, Calculator, CheckCircle2,
  ChevronDown, ChevronRight,
  Clock, Download, Eye, FileText, Lightbulb, Loader2, MapPin,
  PiggyBank, Plus, Sparkles, TrendingUp, User, UserPlus, Wrench, XCircle,
} from "lucide-react";
import { InviterLocataireModal } from "@/components/biens/InviterLocataireModal";
import {
  useBien, useDocuments, useInterventions, useLocataireActuel,
  useLocataires, usePaiements, useScoring, useCreateIntervention,
  type DocumentAlthy, type Locataire, type Paiement,
} from "@/lib/hooks/useBiens";
import { useEstimationEnrichie } from "@/lib/hooks/useDashboardData";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { C } from "@/lib/design-tokens";
import {
  TYPO_BADGE,
  TYPO_CAPTION,
  TYPO_LABEL_MEDIUM,
  TYPO_LABEL_SMALL,
} from "@/lib/typography";
import { bienLinks } from "@/lib/bien-links";
import type {
  EstimationIAEnrichie,
  EstimationLocation as EstimationLocationT,
} from "@/lib/types";

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

/**
 * Sprint 6 K1 — affichage humain du locataire à partir de sa relation `user`.
 * Fallback en cascade : nom complet → prénom → nom → préfixe email →
 * placeholder « Locataire à compléter » (cas user_id NULL ou profil vide).
 *
 * Doctrine §B.10 : si aucune donnée disponible, on l'annonce honnêtement
 * (« Locataire à compléter ») plutôt que d'afficher un hash UUID qui ne dit
 * rien à personne et démolit la crédibilité produit côté Sunimmo.
 */
export function formatLocataireName(loc?: Locataire | null): string {
  const u = loc?.user;
  if (!u) return "Locataire à compléter";
  const fn = u.first_name?.trim();
  const ln = u.last_name?.trim();
  if (fn && ln) return `${fn} ${ln}`;
  if (fn) return fn;
  if (ln) return ln;
  const email = u.email?.trim();
  if (email) return email.split("@")[0];
  return "Locataire à compléter";
}

// ── Atoms ──────────────────────────────────────────────────────────────────────
export function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{ ...TYPO_BADGE, color, background: bg }}>
      {label}
    </span>
  );
}
export function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  // Sprint 4A (2026-05-12) — height:100% + flex column par défaut pour que les
  // cards d'une même grid CSS (items-stretch) s'alignent visuellement à la
  // hauteur de la plus grande. Sans contrainte du parent (cards isolées), le
  // height:100% est inerte → effet bénin partout.
  return (
    <div style={{
      background: C.surface,
      borderRadius: 14,
      border: `1px solid ${C.border}`,
      boxShadow: C.shadow,
      padding: "1.25rem",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      ...style,
    }}>
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
export function Empty({ icon: Icon, title, sub, action }: { icon: React.ElementType; title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div style={{ textAlign: "center", padding: "3rem 1rem", color: C.text3 }}>
      <Icon size={34} style={{ margin: "0 auto 0.75rem", opacity: 0.35 }} />
      <p style={{ fontWeight: 600, color: C.text2, marginBottom: 4 }}>{title}</p>
      {sub && <p style={{ fontSize: 13 }}>{sub}</p>}
      {action && <div style={{ marginTop: "1rem" }}>{action}</div>}
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
  background: C.prussian, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
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
  en_cours: { label: "En cours", color: C.prussian, bg: C.prussianBg },
  planifie: { label: "Planifié", color: C.amber,  bg: C.amberBg },
  resolu:   { label: "Résolu",   color: C.green,  bg: C.greenBg },
};
export const INTER_URGENCE: Record<string, string> = {
  faible: C.green, moderee: C.amber, urgente: C.prussian, tres_urgente: C.red,
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
            <Badge label={BIEN_TYPE_LABELS[bien.type] ?? bien.type} color={C.prussian} bg={C.prussianBg} />
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
              <p style={{ ...TYPO_LABEL_SMALL, color: C.text2, margin: 0 }}>{m.label}</p>
              <p style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: "2px 0" }}>{fmtCHF(m.val)}</p>
              <p style={{ ...TYPO_CAPTION, color: C.text2, margin: 0 }}>/ mois</p>
            </div>
          ))}
          {bien.loyer && bien.loyer > 0 && (
            <div style={{ textAlign: "center" }}>
              <p style={{ ...TYPO_LABEL_SMALL, color: C.text2, margin: 0 }}>Rendement</p>
              <p style={{ fontSize: 18, fontWeight: 700, color: C.green, margin: "2px 0" }}>
                {(((bien.loyer - (bien.charges ?? 0)) * 12) / (bien.loyer * 266.67) * 100).toFixed(1)}%
              </p>
              <p style={{ ...TYPO_CAPTION, color: C.text2, margin: 0 }}>brut estimé</p>
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
  const { data: bien } = useBien(bienId);
  const [inviteOpen, setInviteOpen] = useState(false);
  const moisCourant = new Date().toISOString().slice(0, 7);
  const pMois = paiements?.find(p => p.mois === moisCourant);
  const daysFin = daysUntil(locataire?.date_sortie);

  const bienAdresseCourte = bien
    ? [bien.adresse, [bien.cp, bien.ville].filter(Boolean).join(" ")].filter(Boolean).join(", ")
    : undefined;

  if (isLoading) return (
    <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))" }}>
      <Card><Skel h={180} /></Card><Card><Skel h={120} /></Card><Card><Skel h={160} /></Card>
    </div>
  );
  if (!locataire) {
    return (
      <>
        <Empty
          icon={User}
          title="Aucun locataire actuel"
          sub="Ce bien est vacant. Invitez votre locataire pour qu'il accède à son espace dédié."
          action={
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 20px",
                borderRadius: 10,
                background: C.prussian,
                color: "#fff",
                border: "none",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              <UserPlus size={16} />
              Inviter le locataire
            </button>
          }
        />
        {inviteOpen && (
          <InviterLocataireModal
            bienId={bienId}
            bienAdresseCourte={bienAdresseCourte}
            onClose={() => setInviteOpen(false)}
          />
        )}
      </>
    );
  }

  const ps = pMois ? PAI_STATUT[pMois.statut] : null;
  return (
    <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))" }}>
      {/* Contact & bail */}
      <Card>
        <p style={{ ...TYPO_LABEL_MEDIUM, color: C.text2, margin: "0 0 1rem" }}>Contact &amp; bail</p>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1rem" }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: C.prussianBg, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: C.prussian }}>
            {initials(formatLocataireName(locataire))}
          </div>
          <div>
            <p style={{ fontWeight: 600, color: C.text }}>{formatLocataireName(locataire)}</p>
            {locataire.user?.email && (
              <p style={{ fontSize: 11, color: C.text3 }}>{locataire.user.email}</p>
            )}
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
        {/* TODO Phase 1.1 — Module Renouvellement de bail.
            Activer ce bouton quand le module sera développé.
            Workflow attendu :
              - 3 mois avant date_sortie_prevue : afficher le bouton
              - Clic → modal date + commentaire
              - Envoi proposition au locataire (Module Proposition Dates
                existe déjà depuis Sprint 4B, à étendre pour renouvellement)
              - Locataire accepte / contre-propose / refuse
              - Si accepté : update date_sortie_prevue + créer nouvel
                enregistrement bail
            Sprint 6 K3 (2026-05-13) : bouton désactivé Phase 1.0 car ne
            menait qu'à /app/sphere sans logique métier dédiée — clic mort. */}
        {/* {daysFin !== null && daysFin > 0 && daysFin <= 90 && (
          <Link
            href="/app/sphere"
            style={{ ...btnP, marginTop: "1rem", textDecoration: "none" }}
          >
            <RefreshCw size={12} /> Proposer renouvellement
          </Link>
        )} */}
      </Card>

      {/* Paiement du mois */}
      <Card>
        <p style={{ ...TYPO_LABEL_MEDIUM, color: C.text2, margin: "0 0 1rem" }}>
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
        <p style={{ ...TYPO_LABEL_MEDIUM, color: C.text2, margin: "0 0 1rem" }}>
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
                {initials(formatLocataireName(loc))}
              </div>
              <div>
                <p style={{ fontWeight: 600, color: C.text }}>{formatLocataireName(loc)}</p>
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
                href={bienLinks.historiqueLocataire(bienId, loc.id)}
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
        {/*
          P0.4 fix : ce bouton était décoratif. Pointe désormais vers
          /app/documents qui héberge déjà DocumentQuickGenerator (composant
          réutilisable, voir frontend/src/components/DocumentQuickGenerator.tsx).
          Phase 2 : intégrer le générateur en modal dans cette même tab.
        */}
        <Link href="/app/documents" style={{ ...btnS, textDecoration: "none" }}>
          <Plus size={13} /> Générer document IA
        </Link>
      </div>
      {!docs?.length
        ? <Empty icon={FileText} title="Aucun document" sub="Déposez ou générez vos premiers documents." />
        : Object.entries(grouped).map(([type, items]) => (
          <div key={type} style={{ marginBottom: "1.25rem" }}>
            <p style={{ ...TYPO_LABEL_MEDIUM, color: C.text2, margin: "0 0 8px" }}>
              {DOC_LABELS[type] ?? type}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {items.map(doc => (
                <div key={doc.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.7rem 1rem", borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <FileText size={15} style={{ color: doc.genere_par_ia ? C.prussian : C.text3, flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{DOC_LABELS[doc.type] ?? doc.type}</p>
                      <p style={{ fontSize: 11, color: C.text3 }}>
                        {fmtDate(doc.date_document ?? doc.created_at)}
                        {doc.genere_par_ia && <span style={{ marginLeft: 6, color: C.prussian, fontWeight: 600 }}>· IA</span>}
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
  // P1.7 — ouvre auto le form si ?action=new dans l'URL (CTA depuis la
  // card overview de la fiche bien).
  const searchParams = useSearchParams();
  const initialOpen = searchParams.get("action") === "new";
  const [showForm, setShowForm] = useState(initialOpen);
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
                        <div style={{ height: "100%", width: `${inter.avancement}%`, borderRadius: 99, background: inter.avancement === 100 ? C.green : C.prussian }} />
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

// ── Helpers Estimation IA enrichie (PR-A9.2) ──────────────────────────────────

const fCHF = (n: number) => (n > 0 ? `CHF ${Math.round(n).toLocaleString("fr-CH")}` : "—");
const fPct = (n: number) => `${Number(n).toFixed(1)} %`;

function ExpandableSection({
  title,
  icon: Icon,
  isOpen,
  onToggle,
  summary,
  children,
}: {
  title: string;
  icon: React.ElementType;
  isOpen: boolean;
  onToggle: () => void;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        borderRadius: 14,
        border: `1px solid ${C.border}`,
        background: C.surface,
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 18px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          fontFamily: "inherit",
        }}
        aria-expanded={isOpen}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ color: C.prussian, lineHeight: 0 }}>
            <Icon size={20} />
          </div>
          <div>
            <p style={{ fontFamily: "var(--font-serif)", fontSize: 15, color: C.text, margin: 0 }}>
              {title}
            </p>
            <p style={{ fontSize: 12, color: C.text3, margin: "2px 0 0" }}>{summary}</p>
          </div>
        </div>
        <ChevronDown
          size={20}
          style={{
            color: C.text3,
            transition: "transform 0.2s",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>
      {isOpen && (
        <div
          style={{
            padding: "12px 18px 18px",
            borderTop: `1px solid ${C.border2}`,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p
        style={{
          fontSize: 10,
          color: C.text3,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          margin: 0,
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: 18,
          fontWeight: 300,
          color: C.text,
          margin: "2px 0 0",
        }}
      >
        {value}
      </p>
    </div>
  );
}

function LocationCard({
  location,
  isRecommended,
}: {
  location: EstimationLocationT;
  isRecommended: boolean;
}) {
  return (
    <div
      style={{
        borderRadius: 10,
        border: `1px solid ${isRecommended ? C.gold : C.border}`,
        background: isRecommended ? C.goldBg : C.surface,
        padding: 12,
      }}
    >
      <p
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: 14,
          color: C.text,
          textTransform: "capitalize",
          margin: "0 0 8px",
        }}
      >
        {location.type}
        {isRecommended && <span style={{ color: C.gold, marginLeft: 6 }}>★</span>}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
        <p style={{ color: C.text2, margin: 0 }}>
          {fCHF(location.revenu_brut_an_chf_min)} – {fCHF(location.revenu_brut_an_chf_max)}/an
        </p>
        <p style={{ fontSize: 11, color: C.green, margin: 0 }}>
          Rendement net : {fPct(location.rendement_net_estime_pct)}
        </p>
        <p style={{ fontSize: 11, color: C.text3, margin: 0 }}>
          Occupation : {fPct(location.taux_occupation_estime_pct)}
        </p>
      </div>
      {location.warnings.length > 0 && (
        <div
          style={{
            marginTop: 8,
            paddingTop: 8,
            borderTop: `1px solid ${C.amber}33`,
          }}
        >
          <p style={{ fontSize: 11, color: C.amber, fontWeight: 600, margin: "0 0 4px" }}>
            ⚠ Contraintes légales
          </p>
          <ul style={{ margin: 0, padding: "0 0 0 14px", fontSize: 11, color: C.text2 }}>
            {location.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}
      {location.recommandation && (
        <p style={{ fontSize: 11, color: C.text3, fontStyle: "italic", margin: "8px 0 0" }}>
          {location.recommandation}
        </p>
      )}
    </div>
  );
}

function ListBlock({
  title,
  items,
  icon,
  color,
}: {
  title: string;
  items: string[];
  icon: string;
  color: string;
}) {
  return (
    <div>
      <p
        style={{
          fontSize: 11,
          color: C.text3,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          margin: "0 0 8px",
        }}
      >
        {title}
      </p>
      {items.length === 0 ? (
        <p style={{ fontSize: 12, color: C.text3, fontStyle: "italic", margin: 0 }}>—</p>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
          {items.map((item, i) => (
            <li key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13 }}>
              <span style={{ color, flexShrink: 0 }}>{icon}</span>
              <span style={{ color: C.text2, lineHeight: 1.4 }}>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ScoreCard({ label, score }: { label: string; score: number }) {
  const color = score >= 7 ? C.green : score >= 5 ? C.amber : C.red;
  return (
    <div
      style={{
        textAlign: "center",
        padding: 16,
        borderRadius: 12,
        background: C.surface2,
        border: `1px solid ${C.border}`,
      }}
    >
      <p
        style={{
          fontSize: 11,
          color: C.text3,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          margin: 0,
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: 32,
          fontWeight: 300,
          color,
          margin: "8px 0 0",
        }}
      >
        {score}
        <span style={{ fontSize: 14, color: C.text3 }}>/10</span>
      </p>
    </div>
  );
}

function EstimationLoading() {
  return (
    <Card style={{ textAlign: "center", padding: "2.5rem" }}>
      <Sparkles size={36} style={{ margin: "0 auto 0.75rem", color: C.gold, opacity: 0.85 }} />
      <p style={{ fontFamily: "var(--font-serif)", fontSize: 18, color: C.text, margin: 0 }}>
        Analyse IA en cours…
      </p>
      <p style={{ fontSize: 13, color: C.text3, margin: "6px 0 0" }}>
        Estimation valeur, marché local, scénarios de location, fiscalité…
      </p>
      <p style={{ fontSize: 11, color: C.text3, margin: "10px 0 0" }}>~5-10 secondes</p>
    </Card>
  );
}

function EstimationError({
  onRetry,
  isFetching,
}: {
  onRetry: () => void;
  isFetching: boolean;
}) {
  return (
    <Card style={{ textAlign: "center", padding: "2.5rem" }}>
      <AlertTriangle size={32} style={{ margin: "0 auto 0.75rem", color: C.red, opacity: 0.85 }} />
      <p style={{ fontWeight: 600, color: C.text, margin: 0 }}>Estimation indisponible</p>
      <p style={{ fontSize: 13, color: C.text3, margin: "6px 0 1rem" }}>
        Une erreur est survenue lors de l&apos;analyse IA. Veuillez réessayer.
      </p>
      <button style={btnP} onClick={onRetry} disabled={isFetching}>
        {isFetching && <Loader2 size={12} className="animate-spin" />}
        Réessayer
      </button>
    </Card>
  );
}

export function TabPotentielIA({ bienId }: { bienId: string }) {
  const { data, isLoading, error, refetch, isFetching } = useEstimationEnrichie(bienId);
  // Ouvert par défaut : valeur, localité, locations (les sections critiques).
  // Les 3 autres (fiscalité, recommandations, scores) sont collapsées.
  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set(["valeur", "localite", "locations"]),
  );

  const toggle = (key: string) =>
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  if (isLoading) return <EstimationLoading />;
  if (error || !data) return <EstimationError onRetry={refetch} isFetching={isFetching} />;

  const estim: EstimationIAEnrichie = data;
  // Sprint 4A (2026-05-12) — Phase 1.0 doctrine "IA = enrichissement, pas
  // béquille". Quand le backend retourne `model_used="fallback-static"` (API
  // Claude KO ou parsing échoué), on n'affiche QUE les calculs déterministes
  // (valeur × multiplicateur marché, moyennes canton). Les blocs orientés
  // "analyse IA" (Recommandations IA, Scores investissement/locatif/revente)
  // sont cachés pour ne pas afficher de chiffres random génériques sous
  // couvert d'IA. Banner honnête en tête.
  const isFallback = estim.model_used === "fallback-static";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {isFallback && (
        <div
          role="status"
          style={{
            borderRadius: 10,
            border: `1px solid ${C.gold}`,
            background: C.goldBg,
            padding: "10px 14px",
            display: "flex",
            gap: 8,
            alignItems: "flex-start",
          }}
        >
          <AlertTriangle size={16} style={{ color: C.gold, flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: 12, color: C.text2, margin: 0, lineHeight: 1.5 }}>
            <strong>Analyse IA temporairement indisponible.</strong> Les données
            ci-dessous sont des estimations génériques calculées à partir des
            multiplicateurs marché Suisse romand (loyer × 200–260, moyennes
            cantonales). Les blocs « Recommandations IA » et « Scores » seront
            réaffichés au retour de l&apos;analyse Claude.
          </p>
        </div>
      )}

      {/* Disclaimer LSFin permanent */}
      <div
        style={{
          borderRadius: 10,
          border: `1px solid ${C.amber}55`,
          background: C.amberBg,
          padding: "10px 14px",
          display: "flex",
          gap: 8,
          alignItems: "flex-start",
        }}
      >
        <AlertTriangle size={16} style={{ color: C.amber, flexShrink: 0, marginTop: 2 }} />
        <p style={{ fontSize: 12, color: C.text2, margin: 0, lineHeight: 1.5 }}>
          {estim.disclaimer}
        </p>
      </div>

      {/* SECTION 1 — VALEUR */}
      <ExpandableSection
        title="Valeur estimée du bien"
        icon={Building2}
        isOpen={openSections.has("valeur")}
        onToggle={() => toggle("valeur")}
        summary={`${fCHF(estim.valeur_estimee_chf_min)} – ${fCHF(estim.valeur_estimee_chf_max)}`}
      >
        <div
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          }}
        >
          <Stat label="Min estimé" value={fCHF(estim.valeur_estimee_chf_min)} />
          <Stat label="Max estimé" value={fCHF(estim.valeur_estimee_chf_max)} />
          <Stat label="Prix au m²" value={fCHF(estim.valeur_par_m2_estimee_chf)} />
          <Stat label="Confiance IA" value={`${Number(estim.confidence_score).toFixed(1)}/10`} />
        </div>
      </ExpandableSection>

      {/* SECTION 2 — LOCALITÉ */}
      <ExpandableSection
        title="Analyse du marché local"
        icon={TrendingUp}
        isOpen={openSections.has("localite")}
        onToggle={() => toggle("localite")}
        summary={`${estim.localite.ville} (${estim.localite.canton}) · Tendance ${estim.localite.tendance_12_mois}`}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            }}
          >
            <Stat label="Vente m²" value={fCHF(estim.localite.prix_moyen_m2_vente_chf)} />
            <Stat label="Loyer m²/an" value={fCHF(estim.localite.prix_moyen_m2_loyer_an_chf)} />
            <Stat label="Délai vente" value={`${estim.localite.delai_vente_moyen_jours} j`} />
            <Stat label="Attractivité" value={`${estim.localite.note_attractivite}/10`} />
          </div>
          {estim.localite.notes_locales && (
            <p
              style={{
                fontSize: 13,
                color: C.text2,
                lineHeight: 1.5,
                fontStyle: "italic",
                borderLeft: `3px solid ${C.prussianBorder}`,
                padding: "4px 0 4px 12px",
                margin: 0,
              }}
            >
              {estim.localite.notes_locales}
            </p>
          )}
        </div>
      </ExpandableSection>

      {/* SECTION 3 — LOCATIONS (3 scénarios) */}
      <ExpandableSection
        title="Scénarios de location"
        icon={Sparkles}
        isOpen={openSections.has("locations")}
        onToggle={() => toggle("locations")}
        summary={`Recommandé : ${estim.location_recommandee}`}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div
            style={{
              borderRadius: 8,
              border: `1px solid ${C.gold}55`,
              background: C.goldBg,
              padding: "10px 14px",
            }}
          >
            <p style={{ fontSize: 13, color: C.text, margin: 0 }}>
              <strong>Recommandation Althy : </strong>
              <span style={{ textTransform: "capitalize" }}>{estim.location_recommandee}</span>
            </p>
            <p style={{ fontSize: 12, color: C.text2, margin: "4px 0 0", lineHeight: 1.5 }}>
              {estim.raison_recommandation}
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            }}
          >
            <LocationCard
              location={estim.location_annuelle}
              isRecommended={estim.location_recommandee === "annuelle"}
            />
            <LocationCard
              location={estim.location_saisonniere}
              isRecommended={estim.location_recommandee === "saisonniere"}
            />
            <LocationCard
              location={estim.location_semaine}
              isRecommended={estim.location_recommandee === "semaine"}
            />
          </div>
        </div>
      </ExpandableSection>

      {/* SECTION 4 — FISCALITÉ */}
      <ExpandableSection
        title="Optimisation fiscale CH"
        icon={Calculator}
        isOpen={openSections.has("fiscalite")}
        onToggle={() => toggle("fiscalite")}
        summary={`Impôt estimé : ${fCHF(estim.fiscalite.impot_revenu_locatif_estime_chf_an)}/an`}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            }}
          >
            <Stat
              label="Impôt annuel estimé"
              value={fCHF(estim.fiscalite.impot_revenu_locatif_estime_chf_an)}
            />
            {estim.fiscalite.valeur_locative_estimee_chf != null && (
              <Stat
                label="Valeur locative"
                value={fCHF(estim.fiscalite.valeur_locative_estimee_chf)}
              />
            )}
          </div>

          <ListBlock
            title="Déductions possibles"
            items={estim.fiscalite.deductions_possibles}
            icon="✓"
            color={C.gold}
          />

          {estim.fiscalite.conseil_fiscal_principal && (
            <div
              style={{
                fontSize: 13,
                color: C.text2,
                lineHeight: 1.5,
                background: C.goldBg,
                borderLeft: `3px solid ${C.gold}`,
                padding: "8px 12px",
                borderRadius: 6,
              }}
            >
              <strong>Conseil :</strong> {estim.fiscalite.conseil_fiscal_principal}
            </div>
          )}
        </div>
      </ExpandableSection>

      {/* SECTION 5 — RECOMMANDATIONS (cachée en fallback — Phase 1.0) */}
      {!isFallback && (
      <ExpandableSection
        title="Recommandations IA"
        icon={Lightbulb}
        isOpen={openSections.has("recommandations")}
        onToggle={() => toggle("recommandations")}
        summary={estim.prochaine_action_prioritaire}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div
            style={{
              borderRadius: 8,
              border: `1px solid ${C.gold}`,
              background: C.goldBg,
              padding: "10px 14px",
            }}
          >
            <p style={{ fontSize: 12, fontWeight: 700, color: C.text, margin: 0 }}>
              Action prioritaire
            </p>
            <p style={{ fontSize: 13, color: C.text2, margin: "4px 0 0", lineHeight: 1.5 }}>
              {estim.prochaine_action_prioritaire}
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gap: 14,
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            }}
          >
            <ListBlock title="Points forts" items={estim.points_forts} icon="✓" color={C.green} />
            <ListBlock
              title="À améliorer"
              items={estim.points_amelioration}
              icon="!"
              color={C.amber}
            />
            <ListBlock
              title="Actions recommandées"
              items={estim.actions_recommandees}
              icon="→"
              color={C.prussian}
            />
          </div>
        </div>
      </ExpandableSection>
      )}

      {/* SECTION 6 — SCORES (cachée en fallback — Phase 1.0) */}
      {!isFallback && (
      <ExpandableSection
        title="Scores"
        icon={Award}
        isOpen={openSections.has("scores")}
        onToggle={() => toggle("scores")}
        summary={`Investissement ${estim.score_investissement}/10 · Locatif ${estim.score_locatif}/10 · Revente ${estim.score_revente}/10`}
      >
        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          }}
        >
          <ScoreCard label="Investissement" score={estim.score_investissement} />
          <ScoreCard label="Locatif" score={estim.score_locatif} />
          <ScoreCard label="Revente" score={estim.score_revente} />
        </div>
      </ExpandableSection>
      )}

      {/* META FOOTER */}
      <p
        style={{
          fontSize: 11,
          color: C.text3,
          textAlign: "center",
          margin: "4px 0 0",
        }}
      >
        {isFallback
          ? "Calcul déterministe (analyse IA indisponible)"
          : `Généré par ${estim.model_used}`}{" "}
        · Dernière analyse :{" "}
        {new Date(estim.generated_at).toLocaleString("fr-CH")} ·{" "}
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          style={{
            background: "none",
            border: "none",
            color: C.prussian,
            textDecoration: "underline",
            cursor: isFetching ? "not-allowed" : "pointer",
            fontFamily: "inherit",
            fontSize: 11,
            padding: 0,
          }}
        >
          {isFetching ? "Régénération…" : "Réessayer l'analyse"}
        </button>
      </p>
    </div>
  );
}
