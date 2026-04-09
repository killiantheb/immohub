"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type {
  PaginatedProperties,
  Property,
  PropertyDocument,
  PropertyFilters,
  PropertyImage,
} from "../types";

// ── Query keys ────────────────────────────────────────────────────────────────

export const propertyKeys = {
  all: ["properties"] as const,
  list: (filters: PropertyFilters & { page?: number; size?: number }) =>
    ["properties", "list", filters] as const,
  detail: (id: string) => ["properties", id] as const,
  history: (id: string) => ["properties", id, "history"] as const,
};

// ── Fetchers ──────────────────────────────────────────────────────────────────

async function fetchProperties(
  filters: PropertyFilters & { page?: number; size?: number },
): Promise<PaginatedProperties> {
  const params = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== undefined && v !== ""),
  );
  const { data } = await api.get<PaginatedProperties>("/properties", { params });
  return data;
}

async function fetchProperty(id: string): Promise<Property> {
  const { data } = await api.get<Property>(`/properties/${id}`);
  return data;
}

// ── Read hooks ────────────────────────────────────────────────────────────────

export function useProperties(
  filters: PropertyFilters & { page?: number; size?: number } = {},
) {
  return useQuery({
    queryKey: propertyKeys.list(filters),
    queryFn: () => fetchProperties(filters),
    staleTime: 30_000,
  });
}

export function useProperty(id: string) {
  return useQuery({
    queryKey: propertyKeys.detail(id),
    queryFn: () => fetchProperty(id),
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}

// ── Mutation hooks ────────────────────────────────────────────────────────────

export function useCreateProperty() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Omit<Property, "id" | "owner_id" | "agency_id" | "created_by_id" | "is_active" | "created_at" | "updated_at" | "images" | "documents">) => {
      const { data } = await api.post<Property>("/properties", payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: propertyKeys.all });
    },
  });
}

export function useUpdateProperty(id: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Partial<Property>) => {
      const { data } = await api.put<Property>(`/properties/${id}`, payload);
      return data;
    },
    // Optimistic update
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey: propertyKeys.detail(id) });
      const prev = qc.getQueryData<Property>(propertyKeys.detail(id));
      if (prev) {
        qc.setQueryData(propertyKeys.detail(id), { ...prev, ...payload });
      }
      return { prev };
    },
    onError: (_err, _payload, ctx) => {
      if (ctx?.prev) qc.setQueryData(propertyKeys.detail(id), ctx.prev);
    },
    onSuccess: (updated) => {
      // Merge to preserve images/documents not returned by PUT
      qc.setQueryData<Property>(propertyKeys.detail(id), (prev) =>
        prev ? { ...prev, ...updated } : updated
      );
      qc.invalidateQueries({ queryKey: propertyKeys.all });
    },
  });
}

export function useDeleteProperty() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/properties/${id}`);
      return id;
    },
    onSuccess: (id) => {
      qc.removeQueries({ queryKey: propertyKeys.detail(id) });
      qc.invalidateQueries({ queryKey: propertyKeys.all });
    },
  });
}

// ── Image compression helper ──────────────────────────────────────────────────

async function compressImage(file: File, maxPx = 1920, quality = 0.82): Promise<File> {
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
          if (!blob || blob.size >= file.size) { resolve(file); return; }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
        },
        "image/jpeg",
        quality,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

// ── Image mutations ───────────────────────────────────────────────────────────

export function useUploadImage(propertyId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ file, isCover = false }: { file: File; isCover?: boolean }) => {
      const compressed = await compressImage(file);
      const form = new FormData();
      form.append("file", compressed);
      form.append("is_cover", String(isCover));
      const { data } = await api.post<PropertyImage>(
        `/properties/${propertyId}/images`,
        form,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: propertyKeys.detail(propertyId) });
    },
  });
}

export function useDeleteImage(propertyId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (imageId: string) => {
      await api.delete(`/properties/${propertyId}/images/${imageId}`);
      return imageId;
    },
    // Optimistic: remove image from cache immediately
    onMutate: async (imageId) => {
      await qc.cancelQueries({ queryKey: propertyKeys.detail(propertyId) });
      const prev = qc.getQueryData<Property>(propertyKeys.detail(propertyId));
      if (prev?.images) {
        qc.setQueryData(propertyKeys.detail(propertyId), {
          ...prev,
          images: prev.images.filter((img) => img.id !== imageId),
        });
      }
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(propertyKeys.detail(propertyId), ctx.prev);
    },
  });
}

// ── Document mutation ─────────────────────────────────────────────────────────

export function useUploadDocument(propertyId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ file, docType = "other" }: { file: File; docType?: string }) => {
      const form = new FormData();
      form.append("file", file);
      form.append("doc_type", docType);
      const { data } = await api.post<PropertyDocument>(
        `/properties/${propertyId}/documents`,
        form,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: propertyKeys.detail(propertyId) });
    },
  });
}

// ── AI description mutation ───────────────────────────────────────────────────

export function useGenerateDescription(propertyId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ description: string }>(
        `/properties/${propertyId}/generate-description`,
      );
      return data.description;
    },
    onSuccess: (description) => {
      qc.setQueryData<Property>(propertyKeys.detail(propertyId), (prev) =>
        prev ? { ...prev, description } : prev,
      );
    },
  });
}
