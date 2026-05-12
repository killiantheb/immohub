"use client";

/**
 * useProposition — hooks React Query pour le Module Proposition de dates
 * (Sprint 4B Option C).
 *
 * Pattern aligné sur useDossierDocuments.ts :
 *   - useQuery pour le state + flags
 *   - useMutation par action workflow avec invalidation queryKey
 *
 * Toutes les mutations invalident en plus le dossier-documents (la
 * complétion 100% backend consomme date_accord, donc l'état du dossier
 * change à l'acceptation).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  accepterBailleur,
  accepterLocataire,
  contreProposerBailleur,
  type ContrePropositionBailleurRequest,
  getProposition,
  type ProposerDatesRequest,
  proposerDates,
  reContreProposerLocataire,
  type ReContrePropositionLocataireRequest,
  refuserProposition,
  type RefuserPropositionRequest,
  resetProposition,
} from "../api/proposition";

export const propositionKeys = {
  all: ["proposition"] as const,
  byLocataire: (locataireId: string) =>
    ["proposition", locataireId] as const,
};

// ── Query ─────────────────────────────────────────────────────────────────────

export function useProposition(locataireId: string | undefined) {
  return useQuery({
    queryKey: locataireId
      ? propositionKeys.byLocataire(locataireId)
      : ["proposition", "noop"],
    queryFn: () => getProposition(locataireId as string),
    enabled: Boolean(locataireId),
    // Aligné sur useDossierDocuments — staleTime 30s + pas de refetch auto.
    // Les mutations invalident explicitement.
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    retry: (count, err) => {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403 || status === 404) return false;
      return count < 2;
    },
  });
}

// ── Mutations ────────────────────────────────────────────────────────────────

function invalidateAround(qc: ReturnType<typeof useQueryClient>, locataireId: string) {
  qc.invalidateQueries({ queryKey: propositionKeys.byLocataire(locataireId) });
  // Le dossier-documents intègre date_accord à la complétion 100%.
  qc.invalidateQueries({ queryKey: ["dossier", locataireId, "documents"] });
}

export function useProposerDates(locataireId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProposerDatesRequest) => proposerDates(locataireId, payload),
    onSuccess: () => invalidateAround(qc, locataireId),
  });
}

export function useContreProposerBailleur(locataireId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ContrePropositionBailleurRequest) =>
      contreProposerBailleur(locataireId, payload),
    onSuccess: () => invalidateAround(qc, locataireId),
  });
}

export function useAccepterBailleur(locataireId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => accepterBailleur(locataireId),
    onSuccess: () => invalidateAround(qc, locataireId),
  });
}

export function useAccepterLocataire(locataireId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => accepterLocataire(locataireId),
    onSuccess: () => invalidateAround(qc, locataireId),
  });
}

export function useReContreProposerLocataire(locataireId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ReContrePropositionLocataireRequest) =>
      reContreProposerLocataire(locataireId, payload),
    onSuccess: () => invalidateAround(qc, locataireId),
  });
}

export function useRefuserProposition(locataireId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: RefuserPropositionRequest) =>
      refuserProposition(locataireId, payload),
    onSuccess: () => invalidateAround(qc, locataireId),
  });
}

export function useResetProposition(locataireId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => resetProposition(locataireId),
    onSuccess: () => invalidateAround(qc, locataireId),
  });
}
