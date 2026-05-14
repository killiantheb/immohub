/**
 * API wrapper — Sprint 9 Lot D (Dashboard real data).
 *
 * Endpoint backend :
 *   - GET /api/v1/dashboard/summary → fetchDashboardSummary
 *
 * Source unique pour les KPIs du dashboard manager : agrège
 * `biens` + `loyer_transactions` (mois courant + 6 mois) + apercu
 * biens. Filtre RBAC owner_id côté backend.
 *
 * Devise unique CHF (§B.2). Pas de hardcoded amount côté UI : la
 * réponse expose des floats bruts à formater via `fmtCHF`.
 */

import { useQuery } from "@tanstack/react-query";

import { api } from "../api";

// ── Types ────────────────────────────────────────────────────────────────────

export interface DashboardHistoriqueMois {
  mois: string;      // "YYYY-MM"
  attendu: number;   // CHF
  recu: number;      // CHF
}

export interface DashboardBienApercu {
  id: string;
  titre: string;
  adresse: string;
  statut: string;        // 'loue' | 'vacant' | 'en_vente' | 'en_travaux' | ...
  loyer: number | null;  // null si pas encore saisi côté bien
}

export interface DashboardSummary {
  biens_count: number;
  loyers_mois_attendu: number;
  loyers_mois_recu: number;
  loyers_recu_pct: number;            // 0..100 — 0 si aucun loyer attendu
  historique_6_mois: DashboardHistoriqueMois[];
  biens_apercu: DashboardBienApercu[];
}

// ── Wrappers ─────────────────────────────────────────────────────────────────

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const { data } = await api.get<DashboardSummary>("/dashboard/summary");
  return data;
}

// ── React-Query hook ─────────────────────────────────────────────────────────

/**
 * useDashboardSummary — hook React-Query typé.
 *
 * Activé conditionnellement via `enabled` : utile pour ne déclencher
 * la requête que pour les rôles managers (proprio_solo / super_admin)
 * sans alourdir les autres dashboards.
 */
export function useDashboardSummary(opts: { enabled?: boolean } = {}) {
  return useQuery<DashboardSummary>({
    queryKey: ["dashboard", "summary"],
    queryFn: fetchDashboardSummary,
    enabled: opts.enabled ?? true,
    staleTime: 60_000,
  });
}
