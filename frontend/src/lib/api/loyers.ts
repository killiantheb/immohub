/**
 * API wrappers — Sprint 8 Lot D (Frontend Loyer W7).
 *
 * Endpoints backend Lot B (à venir) :
 *   - GET    /api/v1/loyers?bien_id=...                → listLoyersBien
 *   - GET    /api/v1/loyers/me                          → listMyLoyers (locataire)
 *   - PATCH  /api/v1/loyers/{id}/statut                 → markLoyerStatut (bailleur/admin)
 *   - POST   /api/v1/biens/{bien_id}/generer-annee      → genererLoyersAnnee (bailleur)
 *   - POST   /api/v1/loyers/import-camt054              → importCamt054 (admin/super_admin)
 *
 * Statuts canoniques W7 : en_attente | recu | reverse | en_retard | conteste.
 * Devise unique CHF (§B.2). Pas de hardcoded amount côté UI.
 */

import { api } from "../api";

// ── Types ────────────────────────────────────────────────────────────────────

export type LoyerStatut =
  | "en_attente"
  | "recu"
  | "reverse"
  | "en_retard"
  | "conteste";

export interface LoyerTransaction {
  id: string;
  bien_id: string;
  tenant_id: string;
  owner_id: string;
  montant_total: number;
  statut: LoyerStatut;
  mois_concerne: string; // ISO date — premier jour du mois
  qr_reference?: string | null;
  date_reception?: string | null;
  date_reversement?: string | null;
  created_at: string;
}

export interface Camt054ImportResult {
  matched_count: number;
  unmatched_count: number;
  unmatched_details?: Array<{
    qr_reference?: string | null;
    montant?: number | null;
    raison?: string | null;
    [k: string]: unknown;
  }>;
}

export interface GenererAnneeResult {
  generated_count: number;
  skipped_count: number;
  annee: number;
}

// ── Endpoints ────────────────────────────────────────────────────────────────

export async function listLoyersBien(bien_id: string): Promise<LoyerTransaction[]> {
  const { data } = await api.get<LoyerTransaction[]>("/loyers", { params: { bien_id } });
  return data;
}

export async function listMyLoyers(): Promise<LoyerTransaction[]> {
  const { data } = await api.get<LoyerTransaction[]>("/loyers/me");
  return data;
}

export async function markLoyerStatut(id: string, statut: LoyerStatut): Promise<LoyerTransaction> {
  const { data } = await api.patch<LoyerTransaction>(`/loyers/${id}/statut`, { statut });
  return data;
}

export async function genererLoyersAnnee(
  bien_id: string,
  annee: number,
): Promise<GenererAnneeResult> {
  const { data } = await api.post<GenererAnneeResult>(
    `/biens/${bien_id}/generer-annee`,
    null,
    { params: { annee } },
  );
  return data;
}

export async function importCamt054(file: File): Promise<Camt054ImportResult> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post<Camt054ImportResult>(
    "/loyers/import-camt054",
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data;
}
