"use client";

/**
 * Hooks React Query — clés / badges / cadenas d'un bien (PR-A11.A.6.d).
 *
 * Endpoints (préfixe `/api/v1/biens/{bien_id}`) :
 *   - GET    /keys                — liste
 *   - POST   /keys                — création (201)
 *   - PATCH  /keys/{key_id}       — update partiel
 *   - DELETE /keys/{key_id}       — soft delete (204)
 *
 * Pattern aligné useBienAnnexes / useBienContacts / useBienCompteurs.
 *
 * À chaque create / delete, le backend recalcule `bien.keys_count` ;
 * le compteur affiché dans la fiche bien reste cohérent via invalidation
 * de la query `["biens", bienId]`.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { BienKey, BienKeyCreate, BienKeyUpdate } from "../types";

export const keyKeys = {
  all: ["bien-keys"] as const,
  byBien: (bienId: string) => ["bien-keys", "bien", bienId] as const,
};

export function useBienKeys(bienId: string) {
  return useQuery({
    queryKey: keyKeys.byBien(bienId),
    queryFn: async () => {
      const { data } = await api.get<BienKey[]>(`/biens/${bienId}/keys`);
      return data;
    },
    enabled: Boolean(bienId),
    staleTime: 30_000,
  });
}

export function useCreateBienKey(bienId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: BienKeyCreate) => {
      const { data } = await api.post<BienKey>(
        `/biens/${bienId}/keys`,
        payload,
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keyKeys.byBien(bienId) });
      qc.invalidateQueries({ queryKey: ["biens", bienId] });
    },
  });
}

export function useUpdateBienKey(bienId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      keyId,
      patch,
    }: {
      keyId: string;
      patch: BienKeyUpdate;
    }) => {
      const { data } = await api.patch<BienKey>(
        `/biens/${bienId}/keys/${keyId}`,
        patch,
      );
      return data;
    },
    onMutate: async ({ keyId, patch }) => {
      await qc.cancelQueries({ queryKey: keyKeys.byBien(bienId) });
      const prev = qc.getQueryData<BienKey[]>(keyKeys.byBien(bienId));
      if (prev) {
        qc.setQueryData<BienKey[]>(
          keyKeys.byBien(bienId),
          prev.map((k) => (k.id === keyId ? { ...k, ...patch } : k)),
        );
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(keyKeys.byBien(bienId), ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keyKeys.byBien(bienId) });
      qc.invalidateQueries({ queryKey: ["biens", bienId] });
    },
  });
}

export function useDeleteBienKey(bienId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (keyId: string) => {
      await api.delete(`/biens/${bienId}/keys/${keyId}`);
      return keyId;
    },
    onMutate: async (keyId) => {
      await qc.cancelQueries({ queryKey: keyKeys.byBien(bienId) });
      const prev = qc.getQueryData<BienKey[]>(keyKeys.byBien(bienId));
      if (prev) {
        qc.setQueryData<BienKey[]>(
          keyKeys.byBien(bienId),
          prev.filter((k) => k.id !== keyId),
        );
      }
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(keyKeys.byBien(bienId), ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keyKeys.byBien(bienId) });
      qc.invalidateQueries({ queryKey: ["biens", bienId] });
    },
  });
}
