// src/components/dashboards/UnifiedDashboard.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, ArrowRight, Banknote, Bell, Briefcase, Building2,
  Calendar, CheckCircle2, Clock, Download, Euro,
  FileText, Globe, Home, Layers, MapPin, Play, Plus, Send,
  Sparkles, Star, TrendingUp, Users, Wrench, X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useRole } from "@/lib/hooks/useRole";
import type { UserRole } from "@/lib/types";
import { useAuthStore } from "@/lib/store/authStore";
import { useUser } from "@/lib/auth";
import type {
  Bien, Locataire, Paiement, Intervention,
  MissionOuvreur, DocumentAlthy,
} from "@/lib/hooks/useDashboardData";
import { DashboardPortail } from "./DashboardPortail";
import {
  DC, DCard,
  DSectionTitle, DEmptyState,
} from "@/components/dashboards/DashBoardShared";

// ── Types ──────────────────────────────────────────────────────────────────────

interface KpiDef {
  key:       string;
  label:     string;
  icon:      LucideIcon;
  endpoint:  string;
  urgentIf?: string; // e.g. "> 0" — evaluated against the numeric value
}

interface QuickAction {
  label:  string;
  action: string;    // href
  icon:   LucideIcon;
}

interface SectionDef {
  key:       string;
  title:     string;
  component: string; // key in SECTION_REGISTRY
}

export interface DashboardConfig {
  role:         UserRole;
  kpis:         KpiDef[];
  quickActions: QuickAction[];
  sections:     SectionDef[];
}

// ── Portail API type ───────────────────────────────────────────────────────────

interface PortailData {
  agence_nom:          string;
  bien_adresse:        string;
  prochain_loyer:      number;
  prochain_loyer_date: string;
  loyer_statut:        "recu" | "en_attente";
  bail_statut:         "actif" | "expirant";
  bail_fin:            string;
  interventions_nb:    number;
  documents: { type: "quittance" | "bail" | "edl"; label: string; url: string }[];
  paiements: { mois: string; statut: "paye" | "en_attente"; montant: number }[];
}

interface BriefingData { titre: string; message: string; date: string; is_today: boolean }

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtCHF(n: number) {
  return `CHF ${n.toLocaleString("fr-CH")}`;
}
function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-CH", { day: "numeric", month: "short", year: "numeric" });
}
function initials(firstName: string) {
  return firstName ? firstName[0].toUpperCase() : "?";
}

// ── DASHBOARD_CONFIGS ─────────────────────────────────────────────────────────

export const DASHBOARD_CONFIGS: Record<UserRole, DashboardConfig> = {
  proprio_solo: {
    role: "proprio_solo",
    kpis: [
      { key: "biens_actifs",          label: "Biens actifs",            icon: Building2,    endpoint: "/biens/" },
      { key: "loyers_mois",           label: "Loyers ce mois",          icon: TrendingUp,   endpoint: "/paiements/" },
      { key: "impayes",               label: "Impayés",                 icon: AlertTriangle,endpoint: "/paiements/", urgentIf: "> 0" },
      { key: "interventions_actives", label: "Interventions en cours",  icon: Wrench,       endpoint: "/interventions-althy/" },
    ],
    quickActions: [
      { label: "Ajouter un bien",    action: "/app/biens/nouveau",  icon: Plus },
      { label: "Générer quittance",  action: "/app/documents",      icon: FileText },
      { label: "Voir les impayés",   action: "/app/finances",       icon: AlertTriangle },
    ],
    sections: [
      { key: "actions_sphere",        title: "Actions Sphère IA",       component: "actions_sphere" },
      { key: "biens_recent",          title: "Mes biens",               component: "biens_recent" },
      { key: "loyers_status",         title: "Loyers du mois",          component: "loyers_status" },
      { key: "interventions_actives", title: "Interventions actives",   component: "interventions_actives" },
    ],
  },

  locataire: {
    role: "locataire",
    kpis: [
      { key: "prochain_loyer", label: "Loyer mensuel",       icon: Home,     endpoint: "/locataires/" },
      { key: "documents",      label: "Documents disponibles", icon: FileText, endpoint: "/docs-althy/" },
    ],
    quickActions: [
      { label: "Signaler un problème",    action: "/app/sphere",    icon: AlertTriangle },
      { label: "Demander une quittance",  action: "/app/documents", icon: FileText },
    ],
    sections: [
      { key: "mon_bail",         title: "Mon logement",       component: "mon_bail" },
      { key: "mes_documents",    title: "Mes documents",      component: "mes_documents" },
      { key: "signaler_probleme", title: "Signaler un problème", component: "signaler_probleme" },
    ],
  },

  artisan: {
    role: "artisan",
    kpis: [
      { key: "revenus_mois",     label: "CA ce mois",          icon: Euro,      endpoint: "/paiements/" },
      { key: "devis_attente",    label: "Devis en attente",    icon: Clock,     endpoint: "/interventions-althy/" },
      { key: "missions_actives", label: "Chantiers actifs",    icon: Wrench,    endpoint: "/interventions-althy/" },
    ],
    quickActions: [
      { label: "Voir les missions", action: "/app/ouvreurs/missions", icon: Briefcase },
      { label: "Mes devis",         action: "/app/artisans/devis",    icon: FileText },
    ],
    sections: [
      { key: "devis_recents",    title: "Devis récents",      component: "devis_recents" },
      { key: "missions_actives", title: "Chantiers actifs",   component: "chantiers_actifs" },
    ],
  },

  agence: {
    role: "agence",
    kpis: [
      { key: "biens_geres",   label: "Biens gérés",    icon: Building2,     endpoint: "/biens/" },
      { key: "agents_actifs", label: "Agents actifs",  icon: Users,         endpoint: "/agency/agents" },
      { key: "loyers_mois",   label: "Loyers ce mois", icon: TrendingUp,    endpoint: "/paiements/" },
      { key: "impayes",       label: "Impayés",        icon: AlertTriangle, endpoint: "/paiements/", urgentIf: "> 0" },
    ],
    quickActions: [
      { label: "Ajouter un bien",  action: "/app/biens/nouveau", icon: Plus },
      { label: "Inviter un agent", action: "/app/settings",      icon: Users },
      { label: "Voir les impayés", action: "/app/finances",      icon: AlertTriangle },
    ],
    sections: [
      { key: "biens_recent",  title: "Portefeuille",         component: "biens_recent" },
      { key: "loyers_status", title: "Loyers du mois",       component: "loyers_status" },
      { key: "agents",        title: "Équipe — Performance", component: "agents" },
    ],
  },

  portail_proprio: {
    role: "portail_proprio",
    kpis: [
      { key: "loyers_recus",          label: "Loyer du mois",   icon: Banknote,     endpoint: "/portail/me/dashboard" },
      { key: "bail_statut",           label: "Bail en cours",   icon: FileText,     endpoint: "/portail/me/dashboard" },
      { key: "interventions_actives", label: "Interventions",   icon: Wrench,       endpoint: "/portail/me/dashboard" },
    ],
    quickActions: [
      { label: "Contacter mon agence", action: "/app/messagerie", icon: Send },
    ],
    sections: [
      { key: "portail_documents", title: "Mes documents",            component: "portail_documents" },
      { key: "portail_paiements", title: "Historique paiements",     component: "portail_paiements" },
    ],
  },

  opener: {
    role: "opener",
    kpis: [
      { key: "revenus_ouvreur", label: "Revenus ce mois",  icon: Euro,         endpoint: "/ouvreurs/missions" },
      { key: "missions_mois",   label: "Missions ce mois", icon: CheckCircle2, endpoint: "/ouvreurs/missions" },
      { key: "note_moyenne",    label: "Note moyenne",     icon: Star,         endpoint: "/ratings/" },
    ],
    quickActions: [
      { label: "Mes missions", action: "/app/ouvreurs/missions", icon: Briefcase },
    ],
    sections: [
      { key: "missions_jour", title: "Missions du jour", component: "missions_jour" },
    ],
  },

  expert: {
    role: "expert",
    kpis: [
      { key: "missions_actives", label: "Expertises en cours", icon: Briefcase, endpoint: "/interventions-althy/" },
      { key: "revenus_mois",     label: "CA ce mois",          icon: Euro,      endpoint: "/paiements/" },
    ],
    quickActions: [
      { label: "Mes expertises", action: "/app/biens", icon: Building2 },
    ],
    sections: [
      { key: "missions_actives", title: "Expertises en cours", component: "chantiers_actifs" },
    ],
  },

  hunter: {
    role: "hunter",
    kpis: [
      { key: "missions_actives", label: "Mandats actifs", icon: Briefcase, endpoint: "/hunters/" },
      { key: "revenus_mois",     label: "Commissions",    icon: Euro,      endpoint: "/paiements/" },
    ],
    quickActions: [
      { label: "Mes mandats", action: "/app/hunters", icon: Briefcase },
    ],
    sections: [
      { key: "missions_actives", title: "Mandats en cours", component: "chantiers_actifs" },
    ],
  },

  acheteur_premium: {
    role: "acheteur_premium",
    kpis: [
      { key: "biens_actifs", label: "Biens correspondants", icon: Building2, endpoint: "/marketplace/biens" },
      { key: "documents",    label: "Alertes actives",      icon: Bell,      endpoint: "/listings/" },
    ],
    quickActions: [
      { label: "Voir les annonces", action: "/app/listings", icon: Building2 },
    ],
    sections: [
      { key: "biens_recent", title: "Annonces récentes", component: "biens_recent" },
    ],
  },

  super_admin: {
    role: "super_admin",
    kpis: [
      { key: "biens_actifs", label: "Biens totaux",    icon: Building2, endpoint: "/biens/" },
      { key: "loyers_mois",  label: "Loyers ce mois",  icon: TrendingUp, endpoint: "/paiements/" },
    ],
    quickActions: [
      { label: "Administration", action: "/app/admin", icon: Globe },
    ],
    sections: [
      { key: "biens_recent", title: "Biens récents", component: "biens_recent" },
    ],
  },
};

// ── KPI icon styles — H-care pastel palette ───────────────────────────────────

interface IconStyle { iconColor: string; iconBg: string }

function kpiIconStyle(key: string, isUrgent: boolean): IconStyle {
  if (isUrgent) return { iconColor: "#EF4444", iconBg: "#FEF0EF" };
  const MAP: Record<string, IconStyle> = {
    biens_actifs:          { iconColor: "#E8602C", iconBg: "#FEF0EA" },
    biens_geres:           { iconColor: "#E8602C", iconBg: "#FEF0EA" },
    loyers_mois:           { iconColor: "#16A34A", iconBg: "#E8F8F0" },
    loyers_recus:          { iconColor: "#16A34A", iconBg: "#E8F8F0" },
    impayes:               { iconColor: "#EF4444", iconBg: "#FEF0EF" },
    interventions_actives: { iconColor: "#3B82F6", iconBg: "#EEF3FE" },
    bail_statut:           { iconColor: "#16A34A", iconBg: "#E8F8F0" },
    prochain_loyer:        { iconColor: "#3B82F6", iconBg: "#EEF3FE" },
    documents:             { iconColor: "#3B82F6", iconBg: "#EEF3FE" },
    revenus_mois:          { iconColor: "#16A34A", iconBg: "#E8F8F0" },
    revenus_ouvreur:       { iconColor: "#16A34A", iconBg: "#E8F8F0" },
    devis_attente:         { iconColor: "#D97706", iconBg: "#FEF9C3" },
    missions_actives:      { iconColor: "#16A34A", iconBg: "#E8F8F0" },
    agents_actifs:         { iconColor: "#E8602C", iconBg: "#FEF0EA" },
    missions_mois:         { iconColor: "#E8602C", iconBg: "#FEF0EA" },
    note_moyenne:          { iconColor: "#D97706", iconBg: "#FEF9C3" },
  };
  return MAP[key] ?? { iconColor: "#E8602C", iconBg: "#FEF0EA" };
}

// ── Shared status badge ────────────────────────────────────────────────────────

const STATUT_MAP: Record<string, { label: string; color: string; bg: string }> = {
  loue:        { label: "Loué",       color: "var(--althy-green)", bg: "var(--althy-green-bg)" },
  vacant:      { label: "Vacant",     color: "#D97706",            bg: "rgba(217,119,6,0.10)" },
  en_vente:    { label: "En vente",   color: "#2563EB",            bg: "rgba(37,99,235,0.10)" },
  en_travaux:  { label: "En travaux", color: "#0891B2",            bg: "rgba(8,145,178,0.10)" },
  recu:        { label: "Reçu ✓",     color: "var(--althy-green)", bg: "var(--althy-green-bg)" },
  en_attente:  { label: "En attente", color: "#D97706",            bg: "rgba(217,119,6,0.10)" },
  retard:      { label: "En retard",  color: "var(--althy-red)",   bg: "rgba(239,68,68,0.10)" },
  "en cours":  { label: "En cours",   color: DC.orange,            bg: "rgba(232,96,44,0.10)" },
  confirmée:   { label: "Confirmée",  color: "var(--althy-green)", bg: "var(--althy-green-bg)" },
  terminée:    { label: "Terminée",   color: DC.muted,             bg: "rgba(107,94,82,0.10)" },
  proposee:    { label: "Proposée",   color: "#2563EB",            bg: "rgba(37,99,235,0.10)" },
  acceptee:    { label: "Acceptée",   color: "var(--althy-green)", bg: "var(--althy-green-bg)" },
  effectuee:   { label: "Effectuée",  color: DC.muted,             bg: "rgba(107,94,82,0.10)" },
  "en attente": { label: "En attente", color: "#D97706",           bg: "rgba(217,119,6,0.10)" },
  "accepté":    { label: "Accepté",    color: "var(--althy-green)", bg: "var(--althy-green-bg)" },
  "refusé":     { label: "Refusé",     color: "var(--althy-red)",  bg: "rgba(239,68,68,0.10)" },
};

function StatusBadge({ statut }: { statut: string }) {
  const s = STATUT_MAP[statut] ?? { label: statut, color: DC.muted, bg: DC.border };
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: 20, color: s.color, background: s.bg }}>
      {s.label}
    </span>
  );
}

// ── Data hook (queries enabled per role) ──────────────────────────────────────

interface UnifiedData {
  isLoading: boolean;
  // Manager / agence
  biens:               (Bien & { locataire_actif: Locataire | null })[];
  loyersMois:          number;
  loyersAttente:       number;
  interOuvertes:       number;
  biensVacants:        number;
  paiements:           Paiement[];
  interventionsRec:    Intervention[];
  briefingActions:     { urgence: string; texte: string }[];
  // Locataire
  locataire:           Locataire | null;
  bien:                Bien | null;
  documents:           DocumentAlthy[];
  paiementMois:        Paiement | null;
  // Artisan
  chantiersEnCours:    Intervention[];
  factureeMois:        number;
  // Portail
  portail:             PortailData | null;
  // Opener
  missionsDuJour:      MissionOuvreur[];
  gainsMois:           number;
  nbMissionsMois:      number;
}

function useUnifiedData(role: UserRole | null): UnifiedData {
  const isManager  = role === "proprio_solo" || role === "agence" || role === "super_admin";
  const isTenant   = role === "locataire";
  const isArtisan  = role === "artisan" || role === "expert" || role === "hunter";
  const isPortail  = role === "portail_proprio";
  const isOpener   = role === "opener";

  const moisCourant = new Date().toISOString().slice(0, 7);
  const today       = new Date().toISOString().slice(0, 10);

  // ── Manager queries ──────────────────────────────────────────────────────────
  const biensQ = useQuery({
    queryKey: ["ud", "biens"],
    queryFn: async () => { const { data } = await api.get<Bien[]>("/biens/", { params: { size: 100 } }); return data; },
    enabled: isManager, staleTime: 60_000,
  });

  const locatairesQ = useQuery({
    queryKey: ["ud", "locataires"],
    queryFn: async () => { const { data } = await api.get<Locataire[]>("/locataires/", { params: { statut: "actif", size: 100 } }); return data; },
    enabled: isManager, staleTime: 60_000,
  });

  const paiementsManagerQ = useQuery({
    queryKey: ["ud", "paiements-manager", moisCourant],
    queryFn: async () => { const { data } = await api.get<Paiement[]>("/paiements/", { params: { mois: moisCourant, size: 100 } }); return data; },
    enabled: isManager, staleTime: 60_000,
  });

  const interventionsManagerQ = useQuery({
    queryKey: ["ud", "interventions-manager"],
    queryFn: async () => { const { data } = await api.get<Intervention[]>("/interventions-althy/", { params: { size: 50 } }); return data; },
    enabled: isManager, staleTime: 60_000,
  });

  const briefingQ = useQuery({
    queryKey: ["ud", "briefing"],
    queryFn: async () => { const { data } = await api.get<BriefingData>("/dashboard/briefing"); return data; },
    enabled: isManager, staleTime: 300_000,
  });

  // ── Tenant queries ───────────────────────────────────────────────────────────
  const monLocataireQ = useQuery({
    queryKey: ["ud", "mon-locataire"],
    queryFn: async () => { const { data } = await api.get<Locataire[]>("/locataires/", { params: { statut: "actif", size: 1 } }); return data[0] ?? null; },
    enabled: isTenant, staleTime: 60_000,
  });

  const bienId    = monLocataireQ.data?.id ? monLocataireQ.data?.bien_id : undefined;
  const locId     = monLocataireQ.data?.id;

  const monBienQ = useQuery({
    queryKey: ["ud", "mon-bien", bienId],
    queryFn: async () => { const { data } = await api.get<Bien>(`/biens/${bienId}`); return data; },
    enabled: isTenant && Boolean(bienId), staleTime: 120_000,
  });

  const docsQ = useQuery({
    queryKey: ["ud", "docs", bienId],
    queryFn: async () => { const { data } = await api.get<DocumentAlthy[]>("/docs-althy/", { params: { bien_id: bienId, locataire_id: locId, size: 50 } }); return data; },
    enabled: isTenant && Boolean(bienId), staleTime: 60_000,
  });

  const paiementMoisQ = useQuery({
    queryKey: ["ud", "paiement-mois", moisCourant],
    queryFn: async () => { const { data } = await api.get<Paiement[]>("/paiements/", { params: { locataire_id: locId, mois: moisCourant } }); return data[0] ?? null; },
    enabled: isTenant && Boolean(locId), staleTime: 30_000,
  });

  // ── Artisan queries ──────────────────────────────────────────────────────────
  const artisanInterQ = useQuery({
    queryKey: ["ud", "artisan-inter"],
    queryFn: async () => { const { data } = await api.get<Intervention[]>("/interventions-althy/", { params: { size: 100 } }); return data; },
    enabled: isArtisan, staleTime: 30_000,
  });

  const artisanPaiQ = useQuery({
    queryKey: ["ud", "artisan-pai", moisCourant],
    queryFn: async () => { const { data } = await api.get<Paiement[]>("/paiements/", { params: { size: 100 } }); return data; },
    enabled: isArtisan, staleTime: 30_000,
  });

  // ── Portail query ────────────────────────────────────────────────────────────
  const portailQ = useQuery({
    queryKey: ["ud", "portail"],
    queryFn: async () => { const { data } = await api.get<PortailData>("/portail/me/dashboard"); return data; },
    enabled: isPortail, staleTime: 60_000,
  });

  // ── Opener queries ───────────────────────────────────────────────────────────
  const missionsQ = useQuery({
    queryKey: ["ud", "missions"],
    queryFn: async () => { const { data } = await api.get<MissionOuvreur[]>("/ouvreurs/missions", { params: { size: 100 } }); return data; },
    enabled: isOpener, staleTime: 30_000,
  });

  // ── Derive values ─────────────────────────────────────────────────────────────
  const biensData       = biensQ.data ?? [];
  const locsData        = locatairesQ.data ?? [];
  const paiManagerData  = paiementsManagerQ.data ?? [];
  const interManagerData = interventionsManagerQ.data ?? [];

  const loyersMois    = paiManagerData.filter(p => p.statut === "recu").reduce((s, p) => s + Number(p.montant), 0);
  const loyersAttente = paiManagerData.filter(p => p.statut === "en_attente" || p.statut === "retard").reduce((s, p) => s + Number(p.montant), 0);
  const interOuvertes = interManagerData.filter(i => i.statut !== "resolu").length;
  const biensVacants  = biensData.filter(b => b.statut === "vacant").length;

  const bwl = biensData.map(b => ({ ...b, locataire_actif: locsData.find(l => l.bien_id === b.id) ?? null }));

  const briefData    = briefingQ.data;
  const briefActions = briefData?.is_today
    ? [{ urgence: "moyenne", texte: briefData.message }]
    : [
        ...(biensVacants > 0       ? [{ urgence: "haute",   texte: `${biensVacants} bien(s) vacant(s) — publication recommandée` }] : []),
        ...(loyersAttente > 0      ? [{ urgence: "moyenne", texte: `${fmtCHF(loyersAttente)} de loyers en attente` }] : []),
        ...(interOuvertes > 0      ? [{ urgence: "basse",   texte: `${interOuvertes} intervention(s) ouverte(s) à suivre` }] : []),
      ];

  const artisanInter = artisanInterQ.data ?? [];
  const artisanPai   = artisanPaiQ.data ?? [];
  const chantiersEnCours = artisanInter.filter(i => i.statut === "en_cours" || i.statut === "planifie");
  const factureeMois = artisanPai.filter(p => p.mois === moisCourant && p.statut === "recu").reduce((s, p) => s + Number(p.montant), 0);

  const missions    = missionsQ.data ?? [];
  const mduJour     = missions.filter(m => m.date_mission === today);
  const missionsMois = missions.filter(m => m.date_mission?.startsWith(moisCourant));
  const gainsMois   = missionsMois.filter(m => m.statut === "effectuee").reduce((s, m) => s + Number(m.remuneration ?? 0), 0);

  return {
    isLoading: biensQ.isLoading || monLocataireQ.isLoading || artisanInterQ.isLoading || portailQ.isLoading || missionsQ.isLoading,
    biens: bwl,
    loyersMois, loyersAttente, interOuvertes, biensVacants,
    paiements: paiManagerData,
    interventionsRec: interManagerData.filter(i => i.statut !== "resolu").slice(0, 5),
    briefingActions: briefActions,
    locataire: monLocataireQ.data ?? null,
    bien: monBienQ.data ?? null,
    documents: docsQ.data ?? [],
    paiementMois: paiementMoisQ.data ?? null,
    chantiersEnCours, factureeMois,
    portail: portailQ.data ?? null,
    missionsDuJour: mduJour,
    gainsMois,
    nbMissionsMois: missionsMois.length,
  };
}

// ── Compute KPI display values from unified data ───────────────────────────────

interface KpiValue { value: string; sub?: string; isUrgent: boolean; trend?: "up" | "down" | "neutral" }

function computeKpiValues(
  role: UserRole | null,
  d: UnifiedData,
): Record<string, KpiValue> {
  const kpiLoyer   = d.locataire?.loyer ? Number(d.locataire.loyer) : d.bien?.loyer ? Number(d.bien.loyer) : 0;
  const kpiEcheance = (d.paiementMois as { date_echeance?: string | null } | null)?.date_echeance ?? d.locataire?.date_sortie ?? null;

  // Portail mock fallback
  const PORT_MOCK: PortailData = {
    agence_nom: "Agence Dupont Immobilier",
    bien_adresse: "Rue de Rive 12, 1204 Genève",
    prochain_loyer: 2_400,
    prochain_loyer_date: "01 mai 2026",
    loyer_statut: "en_attente",
    bail_statut: "actif",
    bail_fin: "31 août 2027",
    interventions_nb: 1,
    documents: [],
    paiements: [],
  };
  const port = d.portail ?? PORT_MOCK;

  return {
    // Manager / agence
    biens_actifs:          { value: String(d.biens.length),      sub: "Biens enregistrés",              isUrgent: false, trend: "neutral" },
    biens_geres:           { value: String(d.biens.length),      sub: "Dans votre portefeuille",         isUrgent: false, trend: "neutral" },
    loyers_mois:           { value: fmtCHF(d.loyersMois),        sub: "Loyers encaissés",               isUrgent: false, trend: d.loyersMois > 0 ? "up" : "neutral" },
    impayes:               { value: fmtCHF(d.loyersAttente),     sub: "À recevoir",                     isUrgent: d.loyersAttente > 0, trend: d.loyersAttente > 0 ? "down" : "neutral" },
    interventions_actives: { value: String(d.interOuvertes),     sub: "En cours",                       isUrgent: false, trend: "neutral" },
    agents_actifs:         { value: "3",                         sub: "Agents dans l'équipe",            isUrgent: false, trend: "neutral" },
    // Locataire
    prochain_loyer:        { value: kpiLoyer > 0 ? fmtCHF(kpiLoyer) : "—", sub: kpiEcheance ? `Le ${fmtDate(kpiEcheance)}` : "Charges comprises", isUrgent: false, trend: "neutral" },
    documents:             { value: String(d.documents.length || 6), sub: "Disponibles",               isUrgent: false, trend: "neutral" },
    // Artisan
    revenus_mois:          { value: fmtCHF(d.factureeMois),      sub: "Facturé et encaissé",            isUrgent: false, trend: "up" },
    devis_attente:         { value: "2",                         sub: "Réponse du client",              isUrgent: false, trend: "neutral" },
    missions_actives:      { value: String(d.chantiersEnCours.length || 2), sub: "En cours",          isUrgent: false, trend: "neutral" },
    // Portail
    loyers_recus:          { value: fmtCHF(port.prochain_loyer), sub: port.loyer_statut === "recu" ? "Reçu ✓" : "En attente", isUrgent: false, trend: port.loyer_statut === "recu" ? "up" : "neutral" },
    bail_statut:           { value: port.bail_statut === "actif" ? "Actif" : "Expirant", sub: `Fin ${port.bail_fin}`, isUrgent: false, trend: port.bail_statut === "actif" ? "up" : "down" },
    // Opener
    revenus_ouvreur:       { value: fmtCHF(d.gainsMois),        sub: "Missions effectuées",            isUrgent: false, trend: "up" },
    missions_mois:         { value: String(d.nbMissionsMois),   sub: "Ce mois-ci",                     isUrgent: false, trend: "neutral" },
    note_moyenne:          { value: "4.8 ★",                    sub: "Sur 28 avis",                    isUrgent: false, trend: "up" },
  };
}

// ── Urgence dot ───────────────────────────────────────────────────────────────

const URGENCE_COLOR: Record<string, string> = {
  haute: "var(--althy-red)",
  moyenne: "#D97706",
  basse: "var(--althy-green)",
};

// ── Mock data (sections avec données non encore API) ───────────────────────────

const DEVIS_MOCK = [
  { id: "1", client: "M. Dupont",  travaux: "Plomberie salle de bain",     montant: 1850, dateEnvoi: "2026-04-02", statut: "en attente" },
  { id: "2", client: "Mme Chabloz", travaux: "Peinture appartement 4p",    montant: 3200, dateEnvoi: "2026-04-05", statut: "accepté" },
  { id: "3", client: "SCI Leman",  travaux: "Électricité mise aux normes", montant: 4700, dateEnvoi: "2026-04-08", statut: "en attente" },
];

const AGENTS_MOCK = [
  { nom: "Sophie R.", missions: 12, taux: 94, ca: 8400 },
  { nom: "Marc D.",   missions: 9,  taux: 88, ca: 6200 },
  { nom: "Julie P.",  missions: 15, taux: 97, ca: 11800 },
];

const DOCS_MOCK = [
  { id: "1", nom: "Contrat de bail",        date: "2024-03-01" },
  { id: "2", nom: "Quittance mars 2026",    date: "2026-03-01" },
  { id: "3", nom: "Quittance février 2026", date: "2026-02-01" },
  { id: "4", nom: "EDL entrée",             date: "2024-03-01" },
];

const MISSIONS_MOCK = [
  { heure: "09:30", type: "Visite",           adresse: "Rue de Rive 14, Genève",       statut: "confirmée" },
  { heure: "11:00", type: "État des lieux",   adresse: "Av. de la Gare 8, Lausanne",   statut: "en cours" },
  { heure: "14:30", type: "Visite",           adresse: "Chemin des Fleurs 3, Nyon",    statut: "terminée" },
];

// ── Section components ────────────────────────────────────────────────────────

interface SectionProps { data: UnifiedData }

function SectionActionsSphere({ data }: SectionProps) {
  const actions = data.briefingActions;
  return (
    <div style={{ marginBottom: "2rem" }}>
      <DSectionTitle>Actions urgentes Sphère</DSectionTitle>
      {actions.length === 0 ? (
        <DEmptyState icon={Sparkles} title="Aucune action urgente" subtitle="Tout est en ordre — profitez de votre journée !" />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {actions.slice(0, 3).map((action, i) => (
            <DCard key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: URGENCE_COLOR[action.urgence] ?? DC.muted, flexShrink: 0 }} />
                <p style={{ fontSize: 14, color: DC.text }}>{action.texte}</p>
              </div>
              <Link href="/app/sphere" style={{ flexShrink: 0, padding: "6px 14px", borderRadius: 8, background: DC.orange, color: "#fff", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
                Valider
              </Link>
            </DCard>
          ))}
        </div>
      )}
    </div>
  );
}

function SectionBiensRecent({ data }: SectionProps) {
  const biens = data.biens;
  return (
    <div style={{ marginBottom: "2rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <DSectionTitle style={{ marginBottom: 0 }}>Mes biens</DSectionTitle>
        <Link href="/app/biens" style={{ fontSize: 12, color: DC.orange, textDecoration: "none", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
          Voir tout <ArrowRight size={12} />
        </Link>
      </div>
      {biens.length === 0 ? (
        <DEmptyState icon={Building2} title="Aucun bien enregistré" subtitle="Commencez par ajouter votre premier bien." ctaLabel="Ajouter un bien" ctaHref="/app/biens/nouveau" />
      ) : (
        <DCard style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["Bien", "Adresse", "Statut", "Loyer"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontSize: 11, fontWeight: 700, color: DC.muted, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${DC.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {biens.slice(0, 5).map(b => (
                  <tr key={b.id} style={{ borderBottom: `1px solid ${DC.border}` }}>
                    <td style={{ padding: "10px 12px", fontWeight: 600, color: DC.text }}>{(b as { type?: string }).type ?? "Bien"}</td>
                    <td style={{ padding: "10px 12px", color: DC.muted }}>{(b as { adresse?: string }).adresse}, {(b as { ville?: string }).ville}</td>
                    <td style={{ padding: "10px 12px" }}><StatusBadge statut={b.statut} /></td>
                    <td style={{ padding: "10px 12px", color: DC.text, fontWeight: 600 }}>{(b as { loyer?: number }).loyer ? fmtCHF(Number((b as { loyer?: number }).loyer)) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DCard>
      )}
    </div>
  );
}

function SectionLoyersStatus({ data }: SectionProps) {
  const paiements = data.paiements.slice(0, 6);
  return (
    <div style={{ marginBottom: "2rem" }}>
      <DSectionTitle>Loyers du mois</DSectionTitle>
      {paiements.length === 0 ? (
        <DEmptyState icon={CheckCircle2} title="Aucun loyer ce mois" subtitle="Les paiements apparaîtront ici." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {paiements.map((p, i) => {
            const isRecu = p.statut === "recu";
            const isRetard = p.statut === "retard" || p.statut === "en_attente";
            return (
              <DCard key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", borderRadius: 16 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                  background: isRecu ? "var(--success-bg)" : isRetard ? "var(--urgent-bg)" : "var(--info-bg)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {isRecu
                    ? <CheckCircle2 size={18} color="var(--sage)" strokeWidth={1.8} />
                    : <AlertTriangle size={18} color={isRetard ? "#DC3545" : "var(--sky)"} strokeWidth={1.8} />}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: DC.text, marginBottom: 2 }}>
                    {(p as { bien_titre?: string }).bien_titre ?? `Loyer ${p.mois ?? ""}`}
                  </p>
                  <p style={{ fontSize: 12, color: DC.muted }}>{fmtCHF(Number(p.montant))}</p>
                </div>
                <StatusBadge statut={p.statut} />
              </DCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SectionInterventionsActives({ data }: SectionProps) {
  const inter = data.interventionsRec;
  return (
    <div style={{ marginBottom: "2rem" }}>
      <DSectionTitle>Interventions actives</DSectionTitle>
      {inter.length === 0 ? (
        <DEmptyState icon={Wrench} title="Aucune intervention en cours" subtitle="Tout est en ordre." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {inter.map((item, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
              padding: "14px 18px",
              background: "var(--cream)",
              borderRadius: 16,
              border: "1px solid var(--border-subtle)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: "var(--info-bg)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Wrench size={16} color="var(--sky)" strokeWidth={1.8} />
                </div>
                <p style={{ fontSize: 13, color: DC.text, fontWeight: 500 }}>
                  {(item as { description?: string }).description ?? `Intervention #${item.id?.slice(0, 8) ?? i + 1}`}
                </p>
              </div>
              <StatusBadge statut={item.statut} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SectionMonBail({ data }: SectionProps) {
  const { bien, locataire, paiementMois } = data;
  const kpiLoyer     = locataire?.loyer ? Number(locataire.loyer) : bien?.loyer ? Number((bien as { loyer?: number }).loyer) : 0;
  const kpiEcheance  = (paiementMois as { date_echeance?: string | null } | null)?.date_echeance ?? locataire?.date_sortie ?? null;
  return (
    <div style={{ marginBottom: "2rem" }}>
      <DSectionTitle>Mon logement</DSectionTitle>
      <DCard>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {[
            { icon: Layers, label: "Adresse",        value: bien ? `${(bien as { adresse?: string }).adresse}, ${(bien as { ville?: string }).ville}` : "—" },
            { icon: Home,   label: "Propriétaire",   value: "—" },
            { icon: Calendar, label: "Prochain loyer", value: kpiLoyer > 0 ? `${fmtCHF(kpiLoyer)}${kpiEcheance ? ` · le ${fmtDate(kpiEcheance)}` : ""}` : "—" },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Icon size={14} style={{ color: DC.muted }} />
                <span style={{ fontSize: 13, color: DC.muted }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: DC.text, marginLeft: "auto" }}>{value}</span>
              </div>
              <div style={{ height: 1, background: DC.border, margin: "0.25rem 0" }} />
            </div>
          ))}
        </div>
      </DCard>
    </div>
  );
}

function SectionMesDocuments({ data }: SectionProps) {
  const docsAffichees = data.documents.length > 0
    ? data.documents.slice(0, 6).map(d => ({ id: d.id, nom: (d as { type?: string }).type ?? "Document", date: (d as { date_document?: string }).date_document ?? null }))
    : DOCS_MOCK;
  return (
    <div style={{ marginBottom: "2rem" }}>
      <DSectionTitle>Mes documents</DSectionTitle>
      {docsAffichees.length === 0 ? (
        <DEmptyState icon={FileText} title="Aucun document" subtitle="Vos documents apparaîtront ici." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {docsAffichees.map(doc => (
            <DCard key={doc.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "0.85rem 1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(239,68,68,0.10)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <FileText size={15} style={{ color: "var(--althy-red, #ef4444)" }} />
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: DC.text, marginBottom: 1 }}>{doc.nom}</p>
                  <p style={{ fontSize: 11, color: DC.muted }}>{fmtDate(doc.date)}</p>
                </div>
              </div>
              <button style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, border: `1px solid ${DC.border}`, background: DC.surface, color: DC.muted, fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
                <Download size={12} /> Télécharger
              </button>
            </DCard>
          ))}
        </div>
      )}
    </div>
  );
}

function SectionSignalerProbleme() {
  const [probleme, setProbleme] = useState("");
  const [categorie, setCategorie] = useState("autre");
  const CATS = [{ value: "fuite", label: "Fuite d'eau" }, { value: "electricite", label: "Électricité" }, { value: "chauffage", label: "Chauffage" }, { value: "autre", label: "Autre" }];
  return (
    <div style={{ marginBottom: "2rem" }}>
      <DSectionTitle>Signaler un problème</DSectionTitle>
      <DCard>
        <div style={{ display: "flex", gap: "0.75rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
          <select value={categorie} onChange={e => setCategorie(e.target.value)} style={{ padding: "9px 14px", borderRadius: 10, border: `1px solid ${DC.border}`, fontSize: 13, color: DC.text, background: DC.bg, outline: "none", cursor: "pointer" }}>
            {CATS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <textarea value={probleme} onChange={e => setProbleme(e.target.value)} placeholder="Décrivez le problème en quelques mots…" rows={3} style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${DC.border}`, fontSize: 13, color: DC.text, background: DC.bg, outline: "none", resize: "vertical", fontFamily: "inherit", marginBottom: "0.75rem", boxSizing: "border-box" }} />
        <button style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 20px", borderRadius: 10, border: "none", background: DC.orange, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          <Send size={14} /> Envoyer à mon propriétaire
        </button>
      </DCard>
    </div>
  );
}

function SectionDevisRecents() {
  return (
    <div style={{ marginBottom: "2rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <DSectionTitle style={{ marginBottom: 0 }}>Devis récents</DSectionTitle>
        <Link href="/app/artisans/devis" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: DC.orange, textDecoration: "none", fontWeight: 600 }}>
          <Plus size={13} /> Nouveau devis
        </Link>
      </div>
      {DEVIS_MOCK.length === 0 ? (
        <DEmptyState icon={Briefcase} title="Aucun devis en cours" subtitle="Créez votre premier devis en 2 clics." ctaLabel="Nouveau devis" ctaHref="/app/artisans/devis" />
      ) : (
        <DCard style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "rgba(26,22,18,0.02)" }}>
                  {["Client", "Travaux", "Montant", "Envoyé le", "Statut"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "10px 16px", fontSize: 11, fontWeight: 700, color: DC.muted, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${DC.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DEVIS_MOCK.map((d, i) => (
                  <tr key={d.id} style={{ borderBottom: i < DEVIS_MOCK.length - 1 ? `1px solid ${DC.border}` : "none" }}>
                    <td style={{ padding: "11px 16px", fontWeight: 600, color: DC.text }}>{d.client}</td>
                    <td style={{ padding: "11px 16px", color: DC.muted }}>{d.travaux}</td>
                    <td style={{ padding: "11px 16px", fontWeight: 600, color: DC.text }}>{fmtCHF(d.montant)}</td>
                    <td style={{ padding: "11px 16px", color: DC.muted }}>{fmtDate(d.dateEnvoi)}</td>
                    <td style={{ padding: "11px 16px" }}><StatusBadge statut={d.statut} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DCard>
      )}
    </div>
  );
}

function SectionChantiersActifs({ data }: SectionProps) {
  const chantiers = data.chantiersEnCours.slice(0, 5);
  return (
    <div style={{ marginBottom: "2rem" }}>
      <DSectionTitle>Chantiers actifs</DSectionTitle>
      {chantiers.length === 0 ? (
        <DEmptyState icon={Wrench} title="Aucun chantier en cours" subtitle="Vos chantiers actifs apparaîtront ici." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {chantiers.map((c, i) => (
            <DCard key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "0.85rem 1.25rem" }}>
              <p style={{ fontSize: 13, color: DC.text }}>{(c as { description?: string }).description ?? `Chantier #${c.id?.slice(0, 8) ?? i + 1}`}</p>
              <StatusBadge statut={c.statut} />
            </DCard>
          ))}
        </div>
      )}
    </div>
  );
}

function SectionAgents() {
  return (
    <div style={{ marginBottom: "2rem" }}>
      <DSectionTitle>Équipe — Performance agents</DSectionTitle>
      <DCard style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "rgba(26,22,18,0.02)" }}>
                {["Agent", "Missions", "Taux", "CA CHF"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 16px", fontSize: 11, fontWeight: 700, color: DC.muted, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${DC.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {AGENTS_MOCK.map((agent, i) => (
                <tr key={agent.nom} style={{ borderBottom: i < AGENTS_MOCK.length - 1 ? `1px solid ${DC.border}` : "none" }}>
                  <td style={{ padding: "12px 16px", fontWeight: 600, color: DC.text }}>{agent.nom}</td>
                  <td style={{ padding: "12px 16px", color: DC.muted }}>{agent.missions}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 20, color: agent.taux >= 90 ? "var(--althy-green)" : "#D97706", background: agent.taux >= 90 ? "var(--althy-green-bg)" : "rgba(217,119,6,0.10)" }}>{agent.taux}%</span>
                  </td>
                  <td style={{ padding: "12px 16px", fontWeight: 600, color: DC.text }}>CHF {agent.ca.toLocaleString("fr-CH")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DCard>
    </div>
  );
}

function SectionPortailDocuments({ data }: SectionProps) {
  const PORT_MOCK_DOCS = [
    { type: "quittance", label: "Quittance avril 2026", url: "#" },
    { type: "bail",      label: "Bail en cours",        url: "#" },
    { type: "edl",       label: "EDL entrée",           url: "#" },
  ];
  const docs = (data.portail?.documents ?? PORT_MOCK_DOCS);
  const docIcon = (type: string) => type === "bail" ? "📄" : type === "edl" ? "🔑" : "🧾";
  return (
    <div style={{ marginBottom: "2rem" }}>
      <DSectionTitle>Mes documents</DSectionTitle>
      <DCard>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {docs.map((doc, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, background: "var(--althy-bg)", border: "1px solid var(--althy-border)" }}>
              <span style={{ fontSize: 16 }}>{docIcon(doc.type)}</span>
              <span style={{ flex: 1, fontSize: 13, color: DC.text }}>{doc.label}</span>
              <a href={doc.url} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 600, color: DC.orange, textDecoration: "none" }}>
                <Download size={12} /> PDF
              </a>
            </div>
          ))}
        </div>
      </DCard>
    </div>
  );
}

function SectionPortailPaiements({ data }: SectionProps) {
  const PORT_MOCK_PAI = [
    { mois: "Avril 2026", statut: "en_attente" as const, montant: 2_400 },
    { mois: "Mars 2026",  statut: "paye" as const,        montant: 2_400 },
    { mois: "Fév. 2026",  statut: "paye" as const,        montant: 2_400 },
  ];
  const pais = (data.portail?.paiements ?? PORT_MOCK_PAI);
  return (
    <div style={{ marginBottom: "2rem" }}>
      <DSectionTitle>Historique paiements</DSectionTitle>
      <DCard>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {pais.map((p, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", padding: "10px 14px", borderRadius: 8, background: "var(--althy-bg)", border: "1px solid var(--althy-border)" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: DC.text }}>{p.mois}</div>
                <div style={{ fontSize: 12, color: DC.muted }}>CHF {p.montant.toLocaleString("fr-CH")}</div>
              </div>
              <span style={{ fontSize: 11.5, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: p.statut === "paye" ? "var(--althy-green-bg)" : "rgba(232,96,44,0.10)", color: p.statut === "paye" ? "var(--althy-green)" : "var(--althy-orange)" }}>
                {p.statut === "paye" ? "Payé ✓" : "En attente"}
              </span>
            </div>
          ))}
        </div>
      </DCard>
    </div>
  );
}

function SectionMissionsJour({ data }: SectionProps) {
  const missions = data.missionsDuJour.length > 0
    ? data.missionsDuJour.map(m => ({
        heure: (m.creneau_debut as unknown as string)?.slice(0, 5) ?? "–",
        type: m.type === "edl_entree" ? "État des lieux entrée" : m.type === "edl_sortie" ? "État des lieux sortie" : m.type === "visite" ? "Visite" : m.type ?? "Mission",
        adresse: `Bien #${m.bien_id?.slice(0, 8) ?? "–"}`,
        statut: m.statut === "acceptee" ? "confirmée" : m.statut,
      }))
    : MISSIONS_MOCK;
  return (
    <div style={{ marginBottom: "2rem" }}>
      <DSectionTitle>Missions du jour</DSectionTitle>
      {missions.length === 0 ? (
        <DEmptyState icon={CheckCircle2} title="Aucune mission aujourd'hui" subtitle="Profitez de votre journée !" />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {missions.map((m, i) => (
            <DCard key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 8, background: "rgba(26,22,18,0.05)", color: DC.muted }}>{m.heure}</span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: DC.text, marginBottom: 2 }}>{m.type}</p>
                  <p style={{ fontSize: 12, color: DC.muted, display: "flex", alignItems: "center", gap: 4 }}><MapPin size={11} />{m.adresse}</p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <StatusBadge statut={m.statut} />
                {m.statut === "confirmée" && (
                  <button style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", borderRadius: 8, border: "none", background: DC.orange, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    <Play size={11} /> Démarrer
                  </button>
                )}
              </div>
            </DCard>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Section registry ──────────────────────────────────────────────────────────

type SectionRendererFn = (props: SectionProps) => React.ReactNode;

const SECTION_REGISTRY: Record<string, SectionRendererFn> = {
  actions_sphere:     (p) => <SectionActionsSphere {...p} />,
  biens_recent:       (p) => <SectionBiensRecent {...p} />,
  loyers_status:      (p) => <SectionLoyersStatus {...p} />,
  interventions_actives: (p) => <SectionInterventionsActives {...p} />,
  mon_bail:           (p) => <SectionMonBail {...p} />,
  mes_documents:      (p) => <SectionMesDocuments {...p} />,
  signaler_probleme:  ()  => <SectionSignalerProbleme />,
  devis_recents:      ()  => <SectionDevisRecents />,
  chantiers_actifs:   (p) => <SectionChantiersActifs {...p} />,
  agents:             ()  => <SectionAgents />,
  portail_documents:  (p) => <SectionPortailDocuments {...p} />,
  portail_paiements:  (p) => <SectionPortailPaiements {...p} />,
  missions_jour:      (p) => <SectionMissionsJour {...p} />,
};

// ── H-care KPI card ───────────────────────────────────────────────────────────

const H_SHADOW      = "0 1px 3px rgba(43,43,43,0.04), 0 4px 16px rgba(43,43,43,0.03)";
const H_SHADOW_HOV  = "0 8px 32px rgba(43,43,43,0.10), 0 2px 8px rgba(43,43,43,0.05)";

function HKpiCard({ icon: Icon, iconColor, iconBg, value, label, sub, isUrgent }: {
  icon: LucideIcon; iconColor: string; iconBg: string;
  value: string; label: string; sub?: string; isUrgent?: boolean;
}) {
  return (
    <div style={{
      background: "#fff", borderRadius: 24, padding: "24px",
      border: "1px solid var(--border-subtle)",
      position: "relative", cursor: "default",
      transition: "box-shadow 0.2s, transform 0.2s",
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 24px rgba(0,0,0,0.06)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }}
    >
      {/* Menu dots — discret */}
      <div style={{ position: "absolute", top: 20, right: 20, opacity: 0.2, cursor: "pointer" }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--text-tertiary)">
          <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
        </svg>
      </div>

      {/* Icône dans CERCLE pastel */}
      <div style={{
        width: 48, height: 48, borderRadius: "50%",
        background: iconBg,
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 20,
      }}>
        <Icon size={20} strokeWidth={1.5} style={{ color: iconColor }} />
      </div>

      {/* Valeur + badge urgent */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{
          fontSize: 36, fontWeight: 600, lineHeight: 1,
          color: "var(--charcoal)",
          fontFamily: "var(--font-display)",
        }}>
          {value}
        </span>
        {isUrgent && (
          <span style={{
            padding: "3px 8px", borderRadius: 8,
            background: "var(--urgent-bg)", color: "var(--terracotta-primary)",
            fontSize: 9, fontWeight: 700, textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}>Urgent</span>
        )}
      </div>

      {/* Label */}
      <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ── H-care Orange highlight card ──────────────────────────────────────────────

function HHighlightCard({ value, label }: { value: string; label: string }) {
  return (
    <Link href="/app/sphere" style={{
      background: "linear-gradient(145deg, var(--terracotta-primary), var(--terracotta-deep, #C84E1E))",
      borderRadius: 24, padding: "28px 24px",
      color: "#fff", textDecoration: "none",
      display: "flex", flexDirection: "column", justifyContent: "space-between",
      position: "relative", overflow: "hidden", minHeight: 200,
      transition: "transform 0.2s, box-shadow 0.2s",
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(232,96,44,0.3)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}
    >
      {/* Cercle décoratif */}
      <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />

      <div>
        <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", opacity: 0.75, marginBottom: 6 }}>
          {label}
        </div>
        <div style={{ fontSize: 40, fontWeight: 600, fontFamily: "var(--font-display)", lineHeight: 1 }}>
          {value}
        </div>
      </div>

      {/* Sparkline */}
      <svg width="100%" height="40" viewBox="0 0 120 40" preserveAspectRatio="none" style={{ margin: "16px 0", opacity: 0.5 }}>
        <path d="M0,30 Q15,28 30,24 T60,16 T90,18 T120,8" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        <circle cx="120" cy="8" r="3" fill="#fff" />
      </svg>

      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 500 }}>
        <Sparkles size={16} />
        Ouvrir la Sphère IA
        <ArrowRight size={14} style={{ marginLeft: "auto" }} />
      </div>
    </Link>
  );
}

// ── H-care Bar chart ──────────────────────────────────────────────────────────

function HBarChart({ paiements }: { paiements: Paiement[] }) {
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - 5 + i);
    return d.toISOString().slice(0, 7);
  });
  const MOCK_BASE = [1800, 2200, 1950, 2400, 2100, 2600];
  const values = months.map((m, i) => {
    const sum = paiements.filter(p => p.mois === m && p.statut === "recu").reduce((s, p) => s + Number(p.montant), 0);
    return sum || MOCK_BASE[i];
  });
  const currentMois = new Date().toISOString().slice(0, 7);
  const maxVal = Math.max(...values, 1);

  return (
    <div style={{ background: "#fff", borderRadius: 24, border: "1px solid var(--border-subtle)", boxShadow: H_SHADOW, padding: 24, flex: 1 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--charcoal)", marginBottom: 20 }}>Loyers encaissés — 6 mois</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 96 }}>
        {months.map((m, i) => {
          const h   = Math.max((values[i] / maxVal) * 80, 8);
          const isCur  = m === currentMois;
          const isLast = i === months.length - 1;
          const lbl = new Date(m + "-01").toLocaleDateString("fr-CH", { month: "short" });
          return (
            <div key={m} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{
                width: "100%", maxWidth: 32, height: h,
                borderRadius: "10px 10px 4px 4px",
                background: isLast
                  ? "linear-gradient(180deg, var(--terracotta-light) 0%, var(--terracotta-primary) 100%)"
                  : isCur
                    ? "var(--terracotta-primary)"
                    : "var(--terracotta-ghost)",
                transition: "height 0.4s ease",
              }} />
              <span style={{ fontSize: 10, color: isCur || isLast ? "var(--terracotta-primary)" : "var(--text-tertiary)", fontWeight: isCur || isLast ? 600 : 400, whiteSpace: "nowrap" }}>
                {lbl}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── H-care Donut ──────────────────────────────────────────────────────────────

function HDonut({ recu, total }: { recu: number; total: number }) {
  const pct = total > 0 ? Math.round((recu / total) * 100) : 0;
  const R = 34; const C = 2 * Math.PI * R;
  const dash = (pct / 100) * C;

  return (
    <div style={{ background: "#fff", borderRadius: 24, border: "1px solid var(--border-subtle)", boxShadow: H_SHADOW, padding: 24, display: "flex", alignItems: "center", gap: 20, minWidth: 220 }}>
      <div style={{ position: "relative", width: 88, height: 88, flexShrink: 0 }}>
        <svg width="88" height="88" viewBox="0 0 88 88">
          <circle cx="44" cy="44" r={R} fill="none" stroke="var(--terracotta-ghost)" strokeWidth={12} />
          <circle cx="44" cy="44" r={R} fill="none" stroke="var(--terracotta-primary)" strokeWidth={12}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${C - dash}`}
            transform="rotate(-90 44 44)"
            style={{ transition: "stroke-dasharray 0.6s ease" }}
          />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 22, fontWeight: 600, color: "var(--charcoal)", lineHeight: 1, fontFamily: "var(--font-display)" }}>{pct}%</span>
          <span style={{ fontSize: 9, fontWeight: 600, color: "var(--text-tertiary)", letterSpacing: "0.08em", textTransform: "uppercase" }}>REÇUS</span>
        </div>
      </div>
      <div>
        <div style={{ fontSize: 20, fontWeight: 600, color: "var(--charcoal)", lineHeight: 1, fontFamily: "var(--font-display)" }}>{fmtCHF(recu)}</div>
        <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4 }}>sur {fmtCHF(total)} attendus</div>
      </div>
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function KpiSkeleton({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ background: "#fff", borderRadius: 24, border: "1px solid var(--border-subtle)", boxShadow: H_SHADOW, padding: 24, minHeight: 150 }}>
          <div style={{ width: 48, height: 48, borderRadius: 16, background: "var(--cream)", marginBottom: 16 }} />
          <div style={{ height: 36, width: "55%", borderRadius: 8, background: "var(--cream)" }} />
        </div>
      ))}
    </>
  );
}

// ── UnifiedDashboard ──────────────────────────────────────────────────────────

export function UnifiedDashboard() {
  const { role }         = useRole();
  const { user }         = useAuthStore();
  const { data: profile } = useUser();

  const firstName = profile?.first_name ?? user?.user_metadata?.first_name ?? "";

  // Always call hooks unconditionally (React rules)
  const data      = useUnifiedData(role);

  // Portail proprio has its own dedicated component
  if (role === "portail_proprio") {
    return <DashboardPortail firstName={firstName} />;
  }
  const config    = DASHBOARD_CONFIGS[role ?? "proprio_solo"];
  const kpiValues = computeKpiValues(role, data);
  const isManager = role === "proprio_solo" || role === "agence" || role === "super_admin";

  const nbBiens   = data.biens.length;
  const moisAnnee = new Date().toLocaleDateString("fr-CH", { month: "long", year: "numeric" });

  return (
    <div style={{ minHeight: "100vh", background: "var(--cream)" }}>

      {/* ── Top bar ── */}
      <div style={{
        height: 64, background: "#FFFFFF",
        borderBottom: "1px solid var(--border-subtle)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 40px", flexShrink: 0,
      }}>
        {/* Search — discret */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "var(--cream)", borderRadius: 12,
          padding: "9px 16px", border: "1px solid var(--border-subtle)",
          width: 280, cursor: "text",
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <span style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Rechercher...</span>
        </div>

        {/* Right side — bell + avatar */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* Bell */}
          <button style={{
            position: "relative", padding: 8,
            background: "transparent", border: "none", cursor: "pointer",
            borderRadius: 10,
          }}>
            <Bell size={18} strokeWidth={1.5} style={{ color: "var(--text-secondary)" }} />
            <span style={{
              position: "absolute", top: 6, right: 6,
              width: 7, height: 7, borderRadius: "50%",
              background: "var(--terracotta-primary)",
              border: "2px solid #fff",
            }} />
          </button>

          {/* Séparateur */}
          <div style={{ width: 1, height: 24, background: "var(--border-subtle)" }} />

          {/* Avatar — cercle gradient */}
          <button style={{
            display: "flex", alignItems: "center", gap: 10,
            background: "transparent", border: "none", cursor: "pointer",
            padding: "4px 8px 4px 4px", borderRadius: 12,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "linear-gradient(135deg, var(--terracotta-light, #F0997B), var(--terracotta-primary))",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>
                {firstName ? firstName[0] : "?"}
              </span>
            </div>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--charcoal)" }}>{firstName || "—"}</div>
              <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{roleLabel || ""}</div>
            </div>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5"><path d="m6 9 6 6 6-6"/></svg>
          </button>
        </div>
      </div>

      <div style={{ padding: "2rem 3rem", maxWidth: 1280 }}>
        {/* Greeting */}
        <div style={{ marginBottom: "2rem" }}>
          <h1 style={{ fontSize: 48, fontWeight: 600, fontFamily: "var(--font-display)", color: "var(--charcoal)", marginBottom: 6, lineHeight: 1.1 }}>
            Bonjour{firstName ? `, ${firstName}` : ""}
          </h1>
          <p style={{ fontSize: 15, color: "var(--text-secondary)" }} suppressHydrationWarning>
            Voici un aperçu de vos {nbBiens} biens — {moisAnnee}
          </p>
        </div>

        {/* KPI grid + highlight card */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1.25rem" }}>
          {data.isLoading ? (
            <KpiSkeleton count={config.kpis.length + (isManager ? 1 : 0)} />
          ) : (
            <>
              {config.kpis.map(kpi => {
                const kv  = kpiValues[kpi.key] ?? { value: "—", isUrgent: false };
                const st  = kpiIconStyle(kpi.key, kv.isUrgent);
                return (
                  <HKpiCard
                    key={kpi.key}
                    icon={kpi.icon}
                    iconColor={st.iconColor}
                    iconBg={st.iconBg}
                    value={kv.value}
                    label={kpi.label}
                    sub={kv.sub}
                    isUrgent={kv.isUrgent}
                  />
                );
              })}
              {/* Orange highlight card — managers uniquement */}
              {isManager && (
                <HHighlightCard
                  value={kpiValues["loyers_mois"]?.value ?? "—"}
                  label="Loyers récupérés"
                />
              )}
            </>
          )}
        </div>

        {/* Bar chart + donut — managers uniquement */}
        {isManager && !data.isLoading && (
          <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
            <HBarChart paiements={data.paiements} />
            <HDonut
              recu={data.loyersMois}
              total={data.loyersMois + data.loyersAttente}
            />
          </div>
        )}

        {/* Quick actions */}
        {config.quickActions.length > 0 && (
          <div style={{ marginBottom: "1.75rem" }}>
            <DSectionTitle>Actions rapides</DSectionTitle>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              {config.quickActions.map(qa => {
                const Icon = qa.icon;
                return (
                  <Link
                    key={qa.label}
                    href={qa.action}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 8,
                      padding: "10px 20px", borderRadius: 99,
                      border: "1px solid var(--border-subtle)", background: "#fff",
                      boxShadow: H_SHADOW,
                      color: "var(--text-primary)", fontSize: 13, fontWeight: 500,
                      textDecoration: "none", transition: "box-shadow 0.15s",
                    }}
                  >
                    <Icon size={14} style={{ color: "var(--terracotta-primary)" }} />
                    {qa.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Sections */}
        {config.sections.map(section => {
          const render = SECTION_REGISTRY[section.component];
          if (!render) return null;
          return <div key={section.key}>{render({ data })}</div>;
        })}
      </div>
    </div>
  );
}
