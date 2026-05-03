"use client";

/**
 * Hooks React Query — compteurs de consommation d'un bien (PR-A11.A.6.c).
 *
 * Endpoints (préfixe `/api/v1/biens/{bien_id}`) :
 *   - GET    /compteurs                   — liste
 *   - POST   /compteurs                   — création (201)
 *   - PATCH  /compteurs/{compteur_id}     — update partiel
 *   - DELETE /compteurs/{compteur_id}     — soft delete (204)
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";

export type BienCompteurType =
  | "eau_froide"
  | "eau_chaude"
  | "electricite"
  | "gaz"
  | "mazout"
  | "chauffage"
  | "autre";

export type BienCompteurPartage = "proprietaire" | "locataire" | "divise";

export interface BienCompteur {
  id: string;
  bien_id: string;
  type: BienCompteurType | string;
  numero_compteur?: string | null;
  emplacement?: string | null;
  unite?: string | null;
  releve_initial?: number | null;
  date_releve_initial?: string | null;
  partage?: BienCompteurPartage | string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BienCompteurCreate {
  type: BienCompteurType | string;
  numero_compteur?: string | null;
  emplacement?: string | null;
  unite?: string | null;
  releve_initial?: number | null;
  date_releve_initial?: string | null;
  partage?: BienCompteurPartage | string | null;
  notes?: string | null;
}

export type BienCompteurUpdate = Partial<BienCompteurCreate>;

export const compteurKeys = {
  all: ["bien-compteurs"] as const,
  byBien: (bienId: string) => ["bien-compteurs", "bien", bienId] as const,
};

export function useBienCompteurs(bienId: string) {
  return useQuery({
    queryKey: compteurKeys.byBien(bienId),
    queryFn: async () => {
      const { data } = await api.get<BienCompteur[]>(
        `/biens/${bienId}/compteurs`,
      );
      return data;
    },
    enabled: Boolean(bienId),
    staleTime: 30_000,
  });
}

export function useCreateBienCompteur(bienId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: BienCompteurCreate) => {
      const { data } = await api.post<BienCompteur>(
        `/biens/${bienId}/compteurs`,
        payload,
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: compteurKeys.byBien(bienId) });
      qc.invalidateQueries({ queryKey: ["biens", bienId] });
    },
  });
}

export function useUpdateBienCompteur(bienId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      compteurId,
      patch,
    }: {
      compteurId: string;
      patch: BienCompteurUpdate;
    }) => {
      const { data } = await api.patch<BienCompteur>(
        `/biens/${bienId}/compteurs/${compteurId}`,
        patch,
      );
      return data;
    },
    onMutate: async ({ compteurId, patch }) => {
      await qc.cancelQueries({ queryKey: compteurKeys.byBien(bienId) });
      const prev = qc.getQueryData<BienCompteur[]>(compteurKeys.byBien(bienId));
      if (prev) {
        qc.setQueryData<BienCompteur[]>(
          compteurKeys.byBien(bienId),
          prev.map((c) => (c.id === compteurId ? { ...c, ...patch } : c)),
        );
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(compteurKeys.byBien(bienId), ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: compteurKeys.byBien(bienId) });
      qc.invalidateQueries({ queryKey: ["biens", bienId] });
    },
  });
}

export function useDeleteBienCompteur(bienId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (compteurId: string) => {
      await api.delete(`/biens/${bienId}/compteurs/${compteurId}`);
      return compteurId;
    },
    onMutate: async (compteurId) => {
      await qc.cancelQueries({ queryKey: compteurKeys.byBien(bienId) });
      const prev = qc.getQueryData<BienCompteur[]>(compteurKeys.byBien(bienId));
      if (prev) {
        qc.setQueryData<BienCompteur[]>(
          compteurKeys.byBien(bienId),
          prev.filter((c) => c.id !== compteurId),
        );
      }
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(compteurKeys.byBien(bienId), ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: compteurKeys.byBien(bienId) });
      qc.invalidateQueries({ queryKey: ["biens", bienId] });
    },
  });
}
