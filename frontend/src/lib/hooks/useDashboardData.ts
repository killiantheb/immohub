"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import type {
  Bien, Locataire, Paiement, Intervention,
  MissionOuvreur, ProfileOuvreur,
} from "./useBiens";

// ── Re-export types needed by dashboards ──────────────────────────────────────
export type { Bien, Locataire, Paiement, Intervention, MissionOuvreur, ProfileOuvreur, DocumentAlthy };

// ── Existing API types ────────────────────────────────────────────────────────
export interface OwnerDashboard {
  revenue_current_month: number;
  revenue_prev_month: number;
  occupancy_rate: number;
  active_contracts: number;
  pending_rents: number;
  late_rents: number;
  total_properties: number;
}
export interface AgencyDashboard {
  portfolio_count: number;
  active_contracts: number;
  total_revenue_ytd: number;
  commissions_ytd: number;
  pending_rents: number;
  occupancy_rate: number;
}

// ── Manager dashboard aggregation ─────────────────────────────────────────────

/** Returns biens + their active locataire in one combined structure. */
export interface BienWithLocataire extends Bien {
  locataire_actif: Locataire | null;
}

export function useManagerDashboard() {
  const moisCourant = new Date().toISOString().slice(0, 7);

  const biens = useQuery({
    queryKey: ["dashboard", "biens"],
    queryFn: async () => {
      const { data } = await api.get<Bien[]>("/biens/", { params: { size: 100 } });
      return data;
    },
    staleTime: 60_000,
  });

  const locatairesActifs = useQuery({
    queryKey: ["dashboard", "locataires-actifs"],
    queryFn: async () => {
      const { data } = await api.get<Locataire[]>("/locataires/", {
        params: { statut: "actif", size: 100 },
      });
      return data;
    },
    staleTime: 60_000,
  });

  const paiementsMois = useQuery({
    queryKey: ["dashboard", "paiements", moisCourant],
    queryFn: async () => {
      const { data } = await api.get<Paiement[]>("/paiements/", {
        params: { mois: moisCourant, size: 100 },
      });
      return data;
    },
    staleTime: 60_000,
  });

  const interventions = useQuery({
    queryKey: ["dashboard", "interventions"],
    queryFn: async () => {
      const { data } = await api.get<Intervention[]>("/interventions-althy/", {
        params: { size: 50 },
      });
      return data;
    },
    staleTime: 60_000,
  });

  // Compute metrics
  const biensData = biens.data ?? [];
  const locsData = locatairesActifs.data ?? [];
  const paiData = paiementsMois.data ?? [];
  const interData = interventions.data ?? [];

  const loyersMois = paiData
    .filter(p => p.statut === "recu")
    .reduce((s, p) => s + Number(p.montant), 0);

  const loyersAttente = paiData
    .filter(p => p.statut === "en_attente" || p.statut === "retard")
    .reduce((s, p) => s + Number(p.montant), 0);

  const interOuvertes = interData.filter(
    i => i.statut !== "resolu"
  ).length;

  const biensVacants = biensData.filter(b => b.statut === "vacant").length;

  // Merge biens with their active locataire
  const biensWithLoc: BienWithLocataire[] = biensData.map(b => ({
    ...b,
    locataire_actif: locsData.find(l => l.bien_id === b.id) ?? null,
  }));

  const isLoading = biens.isLoading || locatairesActifs.isLoading;

  return {
    isLoading,
    metrics: { loyersMois, loyersAttente, interOuvertes, biensVacants },
    biens: biensWithLoc,
    interventionsRecentes: interData.filter(i => i.statut !== "resolu").slice(0, 5),
  };
}

// ── Savings vs régie ─────────────────────────────────────────────────────────

export interface SavingsData {
  saved_this_month: number;
  saved_ytd: number;
  nb_biens: number;
  loyers_mois: number;
  regie_rate: number;
}

export function useSavings() {
  return useQuery<SavingsData>({
    queryKey: ["dashboard", "savings"],
    queryFn: async () => {
      const { data } = await api.get<SavingsData>("/dashboard/savings");
      return data;
    },
    staleTime: 300_000, // 5 min
  });
}

// ── Briefing IA stocké ────────────────────────────────────────────────────────

export interface BriefingData {
  titre: string;
  message: string;
  date: string;
  is_today: boolean;
}

export function useBriefing() {
  return useQuery<BriefingData>({
    queryKey: ["dashboard", "briefing"],
    queryFn: async () => {
      const { data } = await api.get<BriefingData>("/sphere/briefing");
      return data;
    },
    staleTime: 300_000,
  });
}

// ── Potentiel IA bien ────────────────────────────────────────────────────────

export interface PotentielIA {
  valeur_min: number;
  valeur_max: number;
  rendement_brut: number;
  rendement_net: number;
  loyer_actuel: number;
  loyer_marche: number;
  ecart_marche_pct: number;
  score_investissement: number;
  recommandations: string[];
  conseil_fiscal: string;
  prochaine_action: string;
}

export function usePotentielIA(bienId: string | undefined) {
  return useQuery<PotentielIA>({
    queryKey: ["bien", bienId, "potentiel"],
    queryFn: async () => {
      const { data } = await api.get<PotentielIA>(`/biens/${bienId}/potentiel`);
      return data;
    },
    enabled: Boolean(bienId),
    staleTime: 3_600_000, // 1h — Claude call is expensive
  });
}

// ── Ouvreur dashboard ─────────────────────────────────────────────────────────

export function useOuvreurDashboard() {
  const today = new Date().toISOString().slice(0, 10);
  const mois = new Date().toISOString().slice(0, 7);

  const missions = useQuery({
    queryKey: ["dashboard", "ouvreur", "missions"],
    queryFn: async () => {
      const { data } = await api.get<MissionOuvreur[]>("/ouvreurs/missions", {
        params: { size: 100 },
      });
      return data;
    },
    staleTime: 30_000,
  });

  const m = missions.data ?? [];

  const missionsDuJour = m.filter(ms => ms.date_mission === today);
  const missionsProches = m.filter(
    ms => ms.date_mission && ms.date_mission > today && ms.statut !== "annulee"
  ).sort((a, b) => (a.date_mission ?? "").localeCompare(b.date_mission ?? ""));
  const missionsProposees = m.filter(ms => ms.statut === "proposee");
  const missionsHistorique = m.filter(ms => ms.statut === "effectuee");
  const missionsMois = m.filter(ms => ms.date_mission?.startsWith(mois));
  const gainsMois = missionsMois
    .filter(ms => ms.statut === "effectuee")
    .reduce((s, ms) => s + Number(ms.remuneration ?? 0), 0);
  const tauxAcceptation = m.length
    ? Math.round((m.filter(ms => ms.statut !== "proposee" && ms.statut !== "annulee").length / Math.max(m.length, 1)) * 100)
    : 0;

  return {
    isLoading: missions.isLoading,
    missionsDuJour,
    missionsProches,
    missionsProposees,
    missionsHistorique,
    metrics: {
      gainsMois,
      nbMissionsMois: missionsMois.length,
      tauxAcceptation,
    },
  };
}

// ── Artisan dashboard ─────────────────────────────────────────────────────────

import type { Devis } from "./useBiens";

export function useArtisanDashboard() {
  const mois = new Date().toISOString().slice(0, 7);

  const interventions = useQuery({
    queryKey: ["dashboard", "artisan", "interventions"],
    queryFn: async () => {
      const { data } = await api.get<Intervention[]>("/interventions-althy/", { params: { size: 100 } });
      return data;
    },
    staleTime: 30_000,
  });

  const paiements = useQuery({
    queryKey: ["dashboard", "artisan", "paiements"],
    queryFn: async () => {
      const { data } = await api.get<Paiement[]>("/paiements/", { params: { size: 100 } });
      return data;
    },
    staleTime: 30_000,
  });

  const inter = interventions.data ?? [];
  const pais = paiements.data ?? [];

  const chantiersEnCours = inter.filter(i => i.statut === "en_cours" || i.statut === "planifie");
  const chantiersTermines = inter.filter(i => i.statut === "resolu");
  const nouveauxAppels = inter.filter(i => i.statut === "nouveau");

  const factureeMois = pais
    .filter(p => p.mois === mois && p.statut === "recu")
    .reduce((s, p) => s + Number(p.montant), 0);
  const enAttentePaiement = pais
    .filter(p => p.statut === "en_attente")
    .reduce((s, p) => s + Number(p.montant), 0);

  return {
    isLoading: interventions.isLoading,
    chantiersEnCours,
    chantiersTermines,
    nouveauxAppels,
    paiements: pais,
    metrics: {
      chantiersEnCoursNb: chantiersEnCours.length,
      factureeMois,
      enAttentePaiement,
    },
  };
}

// ── Tenant dashboard ──────────────────────────────────────────────────────────

import type { DocumentAlthy } from "./useBiens";

export function useTenantDashboard() {
  const moisCourant = new Date().toISOString().slice(0, 7);

  const monLocataire = useQuery({
    queryKey: ["dashboard", "tenant", "locataire"],
    queryFn: async () => {
      const { data } = await api.get<Locataire[]>("/locataires/", {
        params: { statut: "actif", size: 1 },
      });
      return data[0] ?? null;
    },
    staleTime: 60_000,
  });

  const locataireId = monLocataire.data?.id;
  const bienId = monLocataire.data?.bien_id;

  const monBien = useQuery({
    queryKey: ["dashboard", "tenant", "bien", bienId],
    queryFn: async () => {
      const { data } = await api.get<Bien>(`/biens/${bienId}`);
      return data;
    },
    enabled: Boolean(bienId),
    staleTime: 120_000,
  });

  const documents = useQuery({
    queryKey: ["dashboard", "tenant", "docs", bienId],
    queryFn: async () => {
      const { data } = await api.get<DocumentAlthy[]>("/docs-althy/", {
        params: { bien_id: bienId, locataire_id: locataireId, size: 50 },
      });
      return data;
    },
    enabled: Boolean(bienId),
    staleTime: 60_000,
  });

  const paiementMois = useQuery({
    queryKey: ["dashboard", "tenant", "paiement", moisCourant],
    queryFn: async () => {
      const { data } = await api.get<Paiement[]>("/paiements/", {
        params: { locataire_id: locataireId, mois: moisCourant },
      });
      return data[0] ?? null;
    },
    enabled: Boolean(locataireId),
    staleTime: 30_000,
  });

  return {
    isLoading: monLocataire.isLoading,
    locataire: monLocataire.data ?? null,
    bien: monBien.data ?? null,
    documents: documents.data ?? [],
    paiementMois: paiementMois.data ?? null,
  };
}
