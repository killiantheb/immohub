"use client";

/**
 * Hooks React Query — cycle changements_locataire (EDL focus PR-EDL-1).
 *
 * Pour l'instant n'expose QUE les opérations EDL photos (upload/delete) :
 *   - useUploadEdlPhoto(changementId)
 *   - useDeleteEdlPhoto(changementId)
 *
 * Les opérations de cycle (creer, passer-recherche, finaliser-*, sauvegarder
 * EDL) restent inline dans `app/biens/[id]/changement/page.tsx` Phase 1 ;
 * elles seront migrées dans ce module quand l'extraction de la page sera
 * faite (Phase 2).
 *
 * Compression image avec EXIF rotation : la version partagée par useBiens.ts
 * et useInterventions.ts ne gère pas EXIF (canvas perd l'orientation sur
 * photos portrait iPhone). Ici on utilise `createImageBitmap` avec
 * `imageOrientation: "from-image"` qui applique automatiquement l'EXIF.
 * Fallback en cas d'absence de support : on retombe sur le canvas
 * standard (pas de rotation, comportement identique aux autres uploads).
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";

export interface EdlPhotoUploadResponse {
  url: string;
  path: string;
}

export interface EdlPhotoSignResponse {
  url: string;
  expires_at: string;
}

/**
 * Re-signe un path persisté dans le JSONB. Utilisé au mount d'EdlCard
 * (PR-EDL-1bis) pour reconstituer les miniatures après reload de page —
 * les paths ne sont pas des URLs et les signed URLs renvoyées à l'upload
 * expirent au bout d'1 h.
 *
 * Pas de wrapping useMutation : la signature est read-only, sans effet sur
 * les caches React Query, et l'appelant gère sa propre logique de
 * dédup/loading via une ref locale.
 */
export async function signEdlPhotoPath(
  changementId: string,
  path: string,
): Promise<EdlPhotoSignResponse> {
  const { data } = await api.get<EdlPhotoSignResponse>(
    `/changements/${changementId}/edl-photos/sign`,
    { params: { path } },
  );
  return data;
}

// ── Compression + EXIF rotation ─────────────────────────────────────────────
// Cible : 1920 px côté max, JPEG 0.82 — aligné useBiens.ts pour cohérence
// pipeline upload Althy.

async function compressEdlImage(
  file: File,
  maxPx = 1920,
  quality = 0.82,
): Promise<File> {
  // Path principal : createImageBitmap respecte EXIF si demandé.
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image",
      });
      const { width, height } = bitmap;
      const scale = Math.min(1, maxPx / Math.max(width, height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/jpeg", quality),
        );
        bitmap.close();
        if (blob && blob.size < file.size) {
          return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
            type: "image/jpeg",
          });
        }
        return file;
      }
      bitmap.close();
    } catch {
      // bascule fallback si createImageBitmap rejette (HEIC unsupported, etc.)
    }
  }

  // Fallback : canvas via <img> — pas de rotation EXIF (iOS Safari ancien).
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
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }
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

// ── Hooks ───────────────────────────────────────────────────────────────────

export function useUploadEdlPhoto(changementId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      file,
      pieceIdx,
      edlType,
    }: {
      file: File;
      pieceIdx: number;
      edlType: "entree" | "sortie";
    }) => {
      const compressed = await compressEdlImage(file);
      const form = new FormData();
      form.append("file", compressed);
      form.append("piece_idx", String(pieceIdx));
      form.append("edl_type", edlType);
      const { data } = await api.post<EdlPhotoUploadResponse>(
        `/changements/${changementId}/edl-photos`,
        form,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["changement", changementId] });
    },
  });
}

export function useDeleteEdlPhoto(changementId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (path: string) => {
      await api.delete(`/changements/${changementId}/edl-photos`, {
        data: { path },
      });
      return path;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["changement", changementId] });
    },
  });
}
