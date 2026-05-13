/**
 * Hooks React Query — Sprint 8 Lot D (Frontend Loyer W7).
 *
 * Mirror typed des endpoints `lib/api/loyers.ts`. Invalidation ciblée sur
 * `["loyers", "bien", bien_id]` et `["loyers", "me"]` pour garder le cache
 * cohérent entre vue bailleur (timeline) et vue locataire (Mes paiements).
 */

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as loyersApi from "@/lib/api/loyers";
import type { LoyerStatut } from "@/lib/api/loyers";

export const loyerKeys = {
  all: ["loyers"] as const,
  bien: (bienId: string) => ["loyers", "bien", bienId] as const,
  me: () => ["loyers", "me"] as const,
};

export function useLoyersBien(bien_id: string) {
  return useQuery({
    queryKey: loyerKeys.bien(bien_id),
    queryFn: () => loyersApi.listLoyersBien(bien_id),
    enabled: Boolean(bien_id),
    staleTime: 30_000,
  });
}

export function useMyLoyers() {
  return useQuery({
    queryKey: loyerKeys.me(),
    queryFn: () => loyersApi.listMyLoyers(),
    staleTime: 30_000,
  });
}

export function useMarkLoyerStatut(bien_id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, statut }: { id: string; statut: LoyerStatut }) =>
      loyersApi.markLoyerStatut(id, statut),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: loyerKeys.bien(bien_id) });
      qc.invalidateQueries({ queryKey: loyerKeys.me() });
    },
  });
}

export function useGenererLoyersAnnee(bien_id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (annee: number) => loyersApi.genererLoyersAnnee(bien_id, annee),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: loyerKeys.bien(bien_id) });
    },
  });
}

export function useImportCamt054() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => loyersApi.importCamt054(file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: loyerKeys.all });
    },
  });
}
