"use client";

/**
 * Hooks TanStack Query Sprint 10 — avenants, résiliations, mandats + Skribble.
 *
 * Consolidé dans 1 fichier pour simplifier l'import côté pages (vs 4 fichiers
 * séparés).
 *
 * §2.4.16 doctrine : Skribble SES Plan A coexiste avec Plan B Sprint 8.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";

// ── Types ──────────────────────────────────────────────────────────────────

export type AvenantType =
  | "animaux"
  | "modification_loyer"
  | "modification_date"
  | "prolongation"
  | "resiliation_anticipee"
  | "changement_proprietaire"
  | "changement_locataire"
  | "charge_electrique"
  | "accord_specifique";

export type SignableStatus =
  | "draft"
  | "pending_signatures"
  | "partial_signed"
  | "signed"
  | "completed"
  | "declined"
  | "expired"
  | "cancelled"
  | "terminated"
  | "active"
  | "envoyee"
  | "appliquee"
  | "annulee";

export interface Avenant {
  id: string;
  contract_id: string;
  agency_id: string | null;
  reference: string;
  avenant_type: AvenantType;
  objet: string;
  body_text: string | null;
  effective_date: string | null;
  data: Record<string, unknown>;
  status: SignableStatus;
  signed_at_locataire: string | null;
  signed_at_agence: string | null;
  fully_signed: boolean;
  skribble_session_id: string | null;
  skribble_status: SignableStatus | null;
  skribble_signed_pdf_url: string | null;
  draft_pdf_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type ResiliationInitiateur = "locataire" | "bailleur" | "agence_mandataire";

export interface Resiliation {
  id: string;
  contract_id: string;
  agency_id: string | null;
  reference: string;
  initiateur: ResiliationInitiateur;
  motif: string | null;
  date_resiliation: string;
  date_envoi: string;
  respect_preavis: boolean;
  preavis_months: number;
  status: SignableStatus;
  signed_at: string | null;
  skribble_session_id: string | null;
  skribble_status: SignableStatus | null;
  skribble_signed_pdf_url: string | null;
  draft_pdf_url: string | null;
  notification_envoyee_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  warning_co_266l?: boolean;
  warning_message?: string | null;
}

export interface MandatGestion {
  id: string;
  mandant_id: string;
  agence_id: string;
  bien_id: string | null;
  reference: string;
  status: SignableStatus;
  signed_at_mandant: string | null;
  signed_ip_mandant: string | null;
  signed_at_agence: string | null;
  signed_ip_agence: string | null;
  fully_signed: boolean;
  skribble_session_id: string | null;
  skribble_status: SignableStatus | null;
  skribble_signed_pdf_url: string | null;
  commission_pct_annee: number;
  commission_pct_saison: number;
  commission_pct_semaine: number;
  notes: string | null;
  for_juridique: string;
  start_date: string;
  end_date: string | null;
  notice_period_months: number;
  notice_deadline_month_day: string | null;
  terminated_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

// ── Keys ───────────────────────────────────────────────────────────────────

export const avenantKeys = {
  all: ["avenants"] as const,
  list: (filters: Record<string, unknown>) => ["avenants", "list", filters] as const,
  detail: (id: string) => ["avenants", id] as const,
};

export const resiliationKeys = {
  all: ["resiliations"] as const,
  list: (filters: Record<string, unknown>) => ["resiliations", "list", filters] as const,
  detail: (id: string) => ["resiliations", id] as const,
};

export const mandatKeys = {
  all: ["mandats"] as const,
  list: (filters: Record<string, unknown>) => ["mandats", "list", filters] as const,
  detail: (id: string) => ["mandats", id] as const,
};

export const skribbleKeys = {
  status: (docType: string, docId: string) =>
    ["skribble", "status", docType, docId] as const,
};

// ── Avenants ───────────────────────────────────────────────────────────────

interface AvenantsFilters {
  contract_id?: string;
  status?: string;
  page?: number;
  size?: number;
}

export function useAvenants(filters: AvenantsFilters = {}) {
  const params = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== undefined && v !== ""),
  );
  return useQuery({
    queryKey: avenantKeys.list(params),
    queryFn: async () => {
      const { data } = await api.get<Paginated<Avenant>>("/avenants", { params });
      return data;
    },
    staleTime: 30_000,
  });
}

export function useAvenant(id: string) {
  return useQuery({
    queryKey: avenantKeys.detail(id),
    queryFn: async () => {
      const { data } = await api.get<Avenant>(`/avenants/${id}`);
      return data;
    },
    enabled: Boolean(id),
  });
}

export interface AvenantCreatePayload {
  contract_id: string;
  avenant_type: AvenantType;
  objet: string;
  body_text?: string | null;
  effective_date?: string | null;
  data?: Record<string, unknown>;
}

export function useCreateAvenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: AvenantCreatePayload) => {
      const { data } = await api.post<Avenant>("/avenants", payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: avenantKeys.all }),
  });
}

export function useSendAvenantToSkribble() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<Avenant>(`/avenants/${id}/send-to-skribble`);
      return data;
    },
    onSuccess: (updated) => {
      qc.setQueryData(avenantKeys.detail(updated.id), updated);
      qc.invalidateQueries({ queryKey: avenantKeys.all });
    },
  });
}

// ── Résiliations ───────────────────────────────────────────────────────────

interface ResiliationsFilters {
  contract_id?: string;
  status?: string;
  page?: number;
  size?: number;
}

export function useResiliations(filters: ResiliationsFilters = {}) {
  const params = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== undefined && v !== ""),
  );
  return useQuery({
    queryKey: resiliationKeys.list(params),
    queryFn: async () => {
      const { data } = await api.get<Paginated<Resiliation>>("/resiliations", { params });
      return data;
    },
    staleTime: 30_000,
  });
}

export function useResiliation(id: string) {
  return useQuery({
    queryKey: resiliationKeys.detail(id),
    queryFn: async () => {
      const { data } = await api.get<Resiliation>(`/resiliations/${id}`);
      return data;
    },
    enabled: Boolean(id),
  });
}

export interface ResiliationCreatePayload {
  contract_id: string;
  initiateur: ResiliationInitiateur;
  motif?: string | null;
  date_resiliation: string;
  date_envoi: string;
  respect_preavis?: boolean;
  preavis_months?: number;
}

export function useCreateResiliation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ResiliationCreatePayload) => {
      const { data } = await api.post<Resiliation>("/resiliations", payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: resiliationKeys.all }),
  });
}

export function useSendResiliationToSkribble() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<Resiliation>(`/resiliations/${id}/send-to-skribble`);
      return data;
    },
    onSuccess: (updated) => {
      qc.setQueryData(resiliationKeys.detail(updated.id), updated);
      qc.invalidateQueries({ queryKey: resiliationKeys.all });
    },
  });
}

export function useMarquerEnvoyee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<Resiliation>(`/resiliations/${id}/marquer-envoyee`);
      return data;
    },
    onSuccess: (updated) => {
      qc.setQueryData(resiliationKeys.detail(updated.id), updated);
      qc.invalidateQueries({ queryKey: resiliationKeys.all });
    },
  });
}

export function useMarquerAppliquee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<Resiliation>(`/resiliations/${id}/marquer-appliquee`);
      return data;
    },
    onSuccess: (updated) => {
      qc.setQueryData(resiliationKeys.detail(updated.id), updated);
      qc.invalidateQueries({ queryKey: resiliationKeys.all });
    },
  });
}

// ── Mandats ────────────────────────────────────────────────────────────────

interface MandatsFilters {
  mandant_id?: string;
  agence_id?: string;
  bien_id?: string;
  status?: string;
  page?: number;
  size?: number;
}

export function useMandats(filters: MandatsFilters = {}) {
  const params = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== undefined && v !== ""),
  );
  return useQuery({
    queryKey: mandatKeys.list(params),
    queryFn: async () => {
      const { data } = await api.get<Paginated<MandatGestion>>("/mandats", { params });
      return data;
    },
    staleTime: 30_000,
  });
}

export function useMandat(id: string) {
  return useQuery({
    queryKey: mandatKeys.detail(id),
    queryFn: async () => {
      const { data } = await api.get<MandatGestion>(`/mandats/${id}`);
      return data;
    },
    enabled: Boolean(id),
  });
}

export interface MandatCreatePayload {
  mandant_id: string;
  agence_id: string;
  bien_id?: string | null;
  commission_pct_annee?: number;
  commission_pct_saison?: number;
  commission_pct_semaine?: number;
  notes?: string | null;
  for_juridique?: string;
  start_date: string;
  end_date?: string | null;
  notice_period_months?: number;
  notice_deadline_month_day?: string | null;
}

export function useCreateMandat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: MandatCreatePayload) => {
      const { data } = await api.post<MandatGestion>("/mandats", payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: mandatKeys.all }),
  });
}

export function useSendMandatToSkribble() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<MandatGestion>(`/mandats/${id}/send-to-skribble`);
      return data;
    },
    onSuccess: (updated) => {
      qc.setQueryData(mandatKeys.detail(updated.id), updated);
      qc.invalidateQueries({ queryKey: mandatKeys.all });
    },
  });
}

export function useTerminerMandat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<MandatGestion>(`/mandats/${id}/terminer`);
      return data;
    },
    onSuccess: (updated) => {
      qc.setQueryData(mandatKeys.detail(updated.id), updated);
      qc.invalidateQueries({ queryKey: mandatKeys.all });
    },
  });
}

// ── Skribble status polling ────────────────────────────────────────────────

export interface SkribbleStatus {
  doc_type: string;
  doc_id: string;
  skribble_session_id: string | null;
  skribble_status: SignableStatus | null;
  skribble_signed_pdf_url: string | null;
  status: SignableStatus | null;
}

/**
 * Polling Skribble. Refetch toutes les 5s tant que skribble_status est
 * 'pending_signatures' ou 'partial_signed'. S'arrête sur completed/declined/expired.
 */
export function useSkribbleStatus(docType: string, docId: string, enabled = true) {
  return useQuery({
    queryKey: skribbleKeys.status(docType, docId),
    queryFn: async () => {
      const { data } = await api.get<SkribbleStatus>(
        `/skribble/status/${docType}/${docId}`,
      );
      return data;
    },
    enabled: enabled && Boolean(docType && docId),
    refetchInterval: (q) => {
      const d = q.state.data;
      if (!d || !d.skribble_status) return false;
      const pending = ["pending_signatures", "partial_signed"];
      return pending.includes(d.skribble_status) ? 5_000 : false;
    },
  });
}

export function useSkribbleCancel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ docType, docId }: { docType: string; docId: string }) => {
      const { data } = await api.post<{ cancelled: boolean }>(
        `/skribble/${docType}/${docId}/cancel`,
      );
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: skribbleKeys.status(vars.docType, vars.docId) });
      if (vars.docType === "contract") {
        qc.invalidateQueries({ queryKey: ["contracts"] });
      } else if (vars.docType === "avenant") {
        qc.invalidateQueries({ queryKey: avenantKeys.all });
      } else if (vars.docType === "resiliation") {
        qc.invalidateQueries({ queryKey: resiliationKeys.all });
      } else if (vars.docType === "mandat") {
        qc.invalidateQueries({ queryKey: mandatKeys.all });
      }
    },
  });
}

// ── Send Contract to Skribble (Plan A) ─────────────────────────────────────

export function useSendContractToSkribble() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (contractId: string) => {
      const { data } = await api.post(`/contracts/${contractId}/send-to-skribble`);
      return data;
    },
    onSuccess: (_data, contractId) => {
      qc.invalidateQueries({ queryKey: ["contracts", contractId] });
      qc.invalidateQueries({ queryKey: ["contracts"] });
      qc.invalidateQueries({ queryKey: skribbleKeys.status("contract", contractId) });
    },
  });
}
