"use client";

/**
 * Hooks React Query — interventions (PR-A11.A.5).
 *
 * Endpoints (préfixe `/api/v1/interventions-althy`) :
 *   - GET    /                           — liste filtrable (bien_id, statut, urgence, page, size)
 *   - POST   /                           — création
 *   - GET    /{id}                       — détail (inclut photos relation)
 *   - PATCH  /{id}                       — update partiel
 *   - DELETE /{id}                       — soft delete (refus 409 si devis accepté)
 *   - POST   /{id}/photos                — upload (multipart)
 *   - DELETE /{id}/photos/{photo_id}     — suppression photo unitaire
 *
 * Pattern (strictement aligné sur useBiens.ts) :
 *   cancelQueries → snapshot → optimistic → return ctx → onError rollback
 *   → onSettled invalidate.
 *
 * NB : un hook `useInterventions(bienId)` plus simple existe déjà dans
 * `useBiens.ts` (legacy A11.A.0). Il sert au rendering existant de la card
 * `SectionInterventions` et reste actif pour ne pas casser cet appelant. La
 * nouvelle modale utilise `useInterventionsByBien` ci-dessous, qui partage
 * la même URL backend mais expose un payload typé enrichi (photos + closure).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type {
  Intervention,
  InterventionCreate,
  InterventionPhoto,
  InterventionStatut,
  InterventionUpdate,
  InterventionUrgence,
} from "@/lib/types";

// ── Compression image (préupload) — copié pour éviter import croisé useBiens ─

async function compressImage(
  file: File,
  maxPx = 1920,
  quality = 0.82,
): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const { width, height } = img;
      const scale = Math.min(1, maxPx / Math.max(width, height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            resolve(file);
            return;
          }
          resolve(
            new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
              type: "image/jpeg",
            }),
          );
        },
        "image/jpeg",
        quality,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

// ── Query keys ────────────────────────────────────────────────────────────────

export const interventionKeys = {
  all: ["interventions"] as const,
  byBien: (bienId: string) => ["interventions", "bien", bienId] as const,
  detail: (id: string) => ["interventions", "detail", id] as const,
};

export interface InterventionsFilters {
  statut?: InterventionStatut | null;
  urgence?: InterventionUrgence | null;
  page?: number;
  size?: number;
}

// ── Liste par bien ────────────────────────────────────────────────────────────

export function useInterventionsByBien(
  bienId: string,
  filters: InterventionsFilters = {},
) {
  const params: Record<string, string | number> = { bien_id: bienId };
  if (filters.statut) params.statut = filters.statut;
  if (filters.urgence) params.urgence = filters.urgence;
  if (filters.page) params.page = filters.page;
  if (filters.size) params.size = filters.size;

  return useQuery({
    queryKey: [...interventionKeys.byBien(bienId), filters],
    queryFn: async () => {
      const { data } = await api.get<Intervention[]>("/interventions-althy/", {
        params,
      });
      return data;
    },
    enabled: Boolean(bienId),
    staleTime: 30_000,
  });
}

// ── Détail (inclut images via relation backend) ───────────────────────────────

export function useIntervention(interventionId: string | null | undefined) {
  return useQuery({
    queryKey: interventionKeys.detail(interventionId ?? ""),
    queryFn: async () => {
      const { data } = await api.get<Intervention>(
        `/interventions-althy/${interventionId}`,
      );
      return data;
    },
    enabled: Boolean(interventionId),
    staleTime: 30_000,
    retry: false,
  });
}

// ── Création ─────────────────────────────────────────────────────────────────

export function useCreateIntervention(bienId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: InterventionCreate) => {
      const { data } = await api.post<Intervention>(
        "/interventions-althy/",
        payload,
      );
      return data;
    },
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: interventionKeys.byBien(bienId) });
      qc.setQueryData(interventionKeys.detail(created.id), created);
    },
  });
}

// ── Update ───────────────────────────────────────────────────────────────────

export function useUpdateIntervention(interventionId: string, bienId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: InterventionUpdate) => {
      const { data } = await api.patch<Intervention>(
        `/interventions-althy/${interventionId}`,
        payload,
      );
      return data;
    },
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey: interventionKeys.detail(interventionId) });
      const prev = qc.getQueryData<Intervention>(
        interventionKeys.detail(interventionId),
      );
      if (prev) {
        qc.setQueryData<Intervention>(interventionKeys.detail(interventionId), {
          ...prev,
          ...payload,
        });
      }
      return { prev };
    },
    onError: (_err, _payload, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(interventionKeys.detail(interventionId), ctx.prev);
      }
    },
    onSuccess: (updated) => {
      qc.setQueryData(interventionKeys.detail(interventionId), updated);
      qc.invalidateQueries({ queryKey: interventionKeys.byBien(bienId) });
    },
  });
}

// ── Suppression intervention (soft delete côté backend) ──────────────────────

export function useDeleteIntervention(bienId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (interventionId: string) => {
      await api.delete(`/interventions-althy/${interventionId}`);
      return interventionId;
    },
    onSuccess: (id) => {
      qc.removeQueries({ queryKey: interventionKeys.detail(id) });
      qc.invalidateQueries({ queryKey: interventionKeys.byBien(bienId) });
    },
  });
}

// ── Upload photo intervention ────────────────────────────────────────────────

export function useUploadInterventionPhoto(interventionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const compressed = await compressImage(file);
      const form = new FormData();
      form.append("file", compressed);
      const { data } = await api.post<InterventionPhoto>(
        `/interventions-althy/${interventionId}/photos`,
        form,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: interventionKeys.detail(interventionId) });
    },
  });
}

// ── Suppression photo intervention ────────────────────────────────────────────

export function useDeleteInterventionPhoto(interventionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (photoId: string) => {
      await api.delete(
        `/interventions-althy/${interventionId}/photos/${photoId}`,
      );
      return photoId;
    },
    // Optimistic : retire la photo du detail en cache.
    onMutate: async (photoId) => {
      await qc.cancelQueries({ queryKey: interventionKeys.detail(interventionId) });
      const prev = qc.getQueryData<Intervention>(
        interventionKeys.detail(interventionId),
      );
      if (prev?.images) {
        qc.setQueryData<Intervention>(interventionKeys.detail(interventionId), {
          ...prev,
          images: prev.images.filter((p) => p.id !== photoId),
        });
      }
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(interventionKeys.detail(interventionId), ctx.prev);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: interventionKeys.detail(interventionId) });
    },
  });
}
