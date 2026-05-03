"use client";

/**
 * Hooks React Query — contacts externes d'un bien (PR-A11.A.6.c).
 *
 * Endpoints (préfixe `/api/v1/biens/{bien_id}`) :
 *   - GET    /contacts                    — liste
 *   - POST   /contacts                    — création (201)
 *   - PATCH  /contacts/{contact_id}       — update partiel
 *   - DELETE /contacts/{contact_id}       — soft delete (204)
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";

export type BienContactRole =
  | "regie_tierce"
  | "concierge"
  | "syndic"
  | "garant"
  | "voisin_cle"
  | "proprietaire_voisin"
  | "autre";

export interface BienContact {
  id: string;
  bien_id: string;
  role: BienContactRole | string;
  nom: string;
  prenom?: string | null;
  societe?: string | null;
  email?: string | null;
  telephone?: string | null;
  adresse?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BienContactCreate {
  role: BienContactRole | string;
  nom: string;
  prenom?: string | null;
  societe?: string | null;
  email?: string | null;
  telephone?: string | null;
  adresse?: string | null;
  notes?: string | null;
}

export type BienContactUpdate = Partial<BienContactCreate>;

export const contactKeys = {
  all: ["bien-contacts"] as const,
  byBien: (bienId: string) => ["bien-contacts", "bien", bienId] as const,
};

export function useBienContacts(bienId: string) {
  return useQuery({
    queryKey: contactKeys.byBien(bienId),
    queryFn: async () => {
      const { data } = await api.get<BienContact[]>(
        `/biens/${bienId}/contacts`,
      );
      return data;
    },
    enabled: Boolean(bienId),
    staleTime: 30_000,
  });
}

export function useCreateBienContact(bienId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: BienContactCreate) => {
      const { data } = await api.post<BienContact>(
        `/biens/${bienId}/contacts`,
        payload,
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contactKeys.byBien(bienId) });
      qc.invalidateQueries({ queryKey: ["biens", bienId] });
    },
  });
}

export function useUpdateBienContact(bienId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      contactId,
      patch,
    }: {
      contactId: string;
      patch: BienContactUpdate;
    }) => {
      const { data } = await api.patch<BienContact>(
        `/biens/${bienId}/contacts/${contactId}`,
        patch,
      );
      return data;
    },
    onMutate: async ({ contactId, patch }) => {
      await qc.cancelQueries({ queryKey: contactKeys.byBien(bienId) });
      const prev = qc.getQueryData<BienContact[]>(contactKeys.byBien(bienId));
      if (prev) {
        qc.setQueryData<BienContact[]>(
          contactKeys.byBien(bienId),
          prev.map((c) => (c.id === contactId ? { ...c, ...patch } : c)),
        );
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(contactKeys.byBien(bienId), ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: contactKeys.byBien(bienId) });
      qc.invalidateQueries({ queryKey: ["biens", bienId] });
    },
  });
}

export function useDeleteBienContact(bienId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (contactId: string) => {
      await api.delete(`/biens/${bienId}/contacts/${contactId}`);
      return contactId;
    },
    onMutate: async (contactId) => {
      await qc.cancelQueries({ queryKey: contactKeys.byBien(bienId) });
      const prev = qc.getQueryData<BienContact[]>(contactKeys.byBien(bienId));
      if (prev) {
        qc.setQueryData<BienContact[]>(
          contactKeys.byBien(bienId),
          prev.filter((c) => c.id !== contactId),
        );
      }
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(contactKeys.byBien(bienId), ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: contactKeys.byBien(bienId) });
      qc.invalidateQueries({ queryKey: ["biens", bienId] });
    },
  });
}
