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
import type { Edl, EdlElement, EdlDegradation, Piece } from "@/components/changement/EdlCard";

export interface EdlPhotoUploadResponse {
  url: string;
  path: string;
}

export interface EdlPhotoSignResponse {
  url: string;
  expires_at: string;
}

// ── Draft IA (PR-EDL-2) ─────────────────────────────────────────────────────
// Forme du JSON renvoyé par `POST /ai/draft-edl`. Distinct de l'`Edl`
// frontend : l'IA renvoie `rooms[]` (avec `elements[]` détaillés) ; on
// transforme côté `onSuccess` en `pieces[]` (forme stockée dans le JSONB
// `edl_sortie` / `edl_entree`). Mapping rooms→pieces côté frontend (Option A).

interface DraftEdlRoom {
  name: string;
  elements: EdlElement[];
}

export interface DraftEdlResponse {
  type: "entry" | "exit" | "entree" | "sortie";
  date: string;
  property_summary?: string;
  general_condition?: "bon" | "moyen" | "mauvais" | string;
  rooms?: DraftEdlRoom[];
  keys_given?: Record<string, number>;
  meter_readings?: Record<string, number | null>;
  remarks?: string;
  degradations?: EdlDegradation[];
  total_estimated_cost_chf?: number | null;
  signatures_required?: string[];
  requires_validation?: boolean;
  // Fallback : si Claude ne renvoie pas du JSON parseable, ai_service
  // retourne `{ type, date, raw, rooms: [] }`.
  raw?: string;
}

/**
 * Map condition IA ("bon" | "moyen" | "mauvais" | "à noter" | …) vers l'enum
 * frontend etat de pièce. "moyen" → usure normale (décision arbitrée
 * PR-EDL-2). "à noter" et autres → "" (non saisi).
 */
function conditionToEtat(condition: string): Piece["etat"] {
  const c = condition.toLowerCase().trim();
  if (c === "bon") return "bon";
  if (c === "moyen") return "usure_normale";
  if (c === "mauvais") return "degradation";
  return "";
}

/**
 * Synthèse de l'état d'une pièce depuis ses elements[]. Heuristique :
 *  - une dégradation détectée → "degradation"
 *  - sinon une usure normale → "usure_normale"
 *  - sinon tous "bon" → "bon"
 *  - sinon (vide ou mixte) → "" (laissé à saisir)
 */
function pieceEtatFromElements(elements: EdlElement[]): Piece["etat"] {
  if (!elements || elements.length === 0) return "";
  const etats = elements.map((e) => conditionToEtat(e.condition));
  if (etats.includes("degradation")) return "degradation";
  if (etats.includes("usure_normale")) return "usure_normale";
  if (etats.every((e) => e === "bon")) return "bon";
  return "";
}

/**
 * Convertit la réponse `DraftEdlResponse` en structure `Edl` stockée dans le
 * JSONB. Le mapping rooms→pieces est l'opération clé : chaque room IA
 * devient une `Piece` (avec elements[] préservés en lecture seule).
 */
export function draftEdlToEdl(draft: DraftEdlResponse): Edl {
  const pieces: Piece[] = (draft.rooms ?? []).map((r) => ({
    nom: r.name,
    etat: pieceEtatFromElements(r.elements ?? []),
    commentaire: "",
    photos: [],
    elements: r.elements ?? [],
  }));

  // Normalisation general_condition vers l'enum frontend.
  const gc = (draft.general_condition ?? "").toLowerCase();
  const generalCondition: Edl["general_condition"] =
    gc === "bon" || gc === "moyen" || gc === "mauvais" ? gc : "";

  return {
    pieces,
    inventaire: {},
    general_condition: generalCondition,
    keys_given: draft.keys_given,
    meter_readings: draft.meter_readings,
    degradations: draft.degradations,
    total_estimated_cost_chf: draft.total_estimated_cost_chf ?? null,
    remarks: draft.remarks,
  };
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

// ── Draft IA EDL (PR-EDL-2) ─────────────────────────────────────────────────
//
// Pré-remplit un EDL via Claude. Le mapping rooms→pieces est fait dans le
// retour : `data.edl` (forme `Edl` frontend, prête à être posée dans le state
// EDL local) + `data.draft` (la réponse brute IA, conservée si jamais on
// veut afficher des champs non encore mappés). L'appelant choisit ensuite
// d'écraser le state EDL — la modale de confirmation Option C est gérée
// côté composant, pas ici.
//
// Erreurs backend :
//  - 503 / 429 (rate limit IA) → toast clair côté composant via err.response
//  - 500 → toast générique
// Le hook ne mute pas le state local d'EdlCard : c'est la responsabilité du
// composant (qui gère aussi le confirm avant écrasement).

export function useDraftEdl(bienId: string) {
  return useMutation({
    mutationFn: async ({
      edlType,
      inspectionDate,
      previousEdl,
    }: {
      edlType: "entree" | "sortie";
      inspectionDate?: string;
      previousEdl?: Edl | null;
    }) => {
      const { data } = await api.post<DraftEdlResponse>("/ai/draft-edl", {
        bien_id: bienId,
        edl_type: edlType,
        inspection_date: inspectionDate ?? new Date().toISOString().slice(0, 10),
        previous_edl: previousEdl ?? null,
      });
      return { draft: data, edl: draftEdlToEdl(data) };
    },
  });
}
