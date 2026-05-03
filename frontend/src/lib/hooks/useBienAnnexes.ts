"use client";

/**
 * Hooks React Query — annexes d'un bien (PR-A11.A.6.c).
 *
 * Endpoints (préfixe `/api/v1/biens/{bien_id}`) :
 *   - GET    /annexes                     — liste
 *   - POST   /annexes                     — création (201)
 *   - PATCH  /annexes/{annexe_id}         — update partiel
 *   - DELETE /annexes/{annexe_id}         — soft delete (204)
 *
 * Pattern strictement aligné sur useInterventions.ts (cancelQueries →
 * snapshot → optimistic → return ctx → onError rollback → onSettled
 * invalidate).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";

export type BienAnnexeType =
  | "cave"
  | "parking_couvert"
  | "parking_exterieur"
  | "box"
  | "garage"
  | "grenier"
  | "autre";

export interface BienAnnexe {
  id: string;
  bien_id: string;
  type: BienAnnexeType | string;
  numero?: string | null;
  surface_m2?: number | null;
  inclus_dans_loyer: boolean;
  loyer_supplement?: number | null;
  created_at: string;
  updated_at: string;
}

export interface BienAnnexeCreate {
  type: BienAnnexeType | string;
  numero?: string | null;
  surface_m2?: number | null;
  inclus_dans_loyer?: boolean;
  loyer_supplement?: number | null;
}

export type BienAnnexeUpdate = Partial<BienAnnexeCreate>;

export const annexeKeys = {
  all: ["bien-annexes"] as const,
  byBien: (bienId: string) => ["bien-annexes", "bien", bienId] as const,
};

export function useBienAnnexes(bienId: string) {
  return useQuery({
    queryKey: annexeKeys.byBien(bienId),
    queryFn: async () => {
      const { data } = await api.get<BienAnnexe[]>(
        `/biens/${bienId}/annexes`,
      );
      return data;
    },
    enabled: Boolean(bienId),
    staleTime: 30_000,
  });
}

export function useCreateBienAnnexe(bienId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: BienAnnexeCreate) => {
      const { data } = await api.post<BienAnnexe>(
        `/biens/${bienId}/annexes`,
        payload,
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: annexeKeys.byBien(bienId) });
      qc.invalidateQueries({ queryKey: ["biens", bienId] });
    },
  });
}

export function useUpdateBienAnnexe(bienId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      annexeId,
      patch,
    }: {
      annexeId: string;
      patch: BienAnnexeUpdate;
    }) => {
      const { data } = await api.patch<BienAnnexe>(
        `/biens/${bienId}/annexes/${annexeId}`,
        patch,
      );
      return data;
    },
    onMutate: async ({ annexeId, patch }) => {
      await qc.cancelQueries({ queryKey: annexeKeys.byBien(bienId) });
      const prev = qc.getQueryData<BienAnnexe[]>(annexeKeys.byBien(bienId));
      if (prev) {
        qc.setQueryData<BienAnnexe[]>(
          annexeKeys.byBien(bienId),
          prev.map((a) => (a.id === annexeId ? { ...a, ...patch } : a)),
        );
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(annexeKeys.byBien(bienId), ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: annexeKeys.byBien(bienId) });
      qc.invalidateQueries({ queryKey: ["biens", bienId] });
    },
  });
}

export function useDeleteBienAnnexe(bienId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (annexeId: string) => {
      await api.delete(`/biens/${bienId}/annexes/${annexeId}`);
      return annexeId;
    },
    onMutate: async (annexeId) => {
      await qc.cancelQueries({ queryKey: annexeKeys.byBien(bienId) });
      const prev = qc.getQueryData<BienAnnexe[]>(annexeKeys.byBien(bienId));
      if (prev) {
        qc.setQueryData<BienAnnexe[]>(
          annexeKeys.byBien(bienId),
          prev.filter((a) => a.id !== annexeId),
        );
      }
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(annexeKeys.byBien(bienId), ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: annexeKeys.byBien(bienId) });
      qc.invalidateQueries({ queryKey: ["biens", bienId] });
    },
  });
}
