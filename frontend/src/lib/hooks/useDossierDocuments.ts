"use client";

/**
 * useDossierDocuments — hooks React Query pour le Module Dossier Locataire (Sprint 1B).
 *
 * Référence API : src/lib/api/dossier-documents.ts
 *
 * Pattern :
 *   - useQuery avec staleTime 30s pour les listes (cf brief Sprint 1B)
 *   - useMutation avec invalidation ciblée du dossier après chaque mutation
 *   - getMyLocataire en hook séparé (utilisé une fois au mount de la page locataire)
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  type CosignataireBase,
  deleteDossierDocument,
  getDocumentSignedUrl,
  getMyLocataire,
  listDossierDocuments,
  markLoyerCautionVerses,
  rejectDocument,
  type RenseignementsUpdate,
  type TypeDocument,
  updateCosignataires,
  updateRenseignements,
  uploadDossierDocument,
  validateDocument,
} from "../api/dossier-documents";


export const dossierKeys = {
  all: ["dossier"] as const,
  me: () => ["dossier", "me"] as const,
  documents: (locataireId: string) => ["dossier", locataireId, "documents"] as const,
};


// ── Identité locataire courant ────────────────────────────────────────────────


/** Récupère le Locataire actif du user connecté. */
export function useMyLocataire() {
  return useQuery({
    queryKey: dossierKeys.me(),
    queryFn: getMyLocataire,
    // Sprint perf quick-wins (2026-05-12) : staleTime 60s + désactiver les
    // refetch automatiques (focus/mount/reconnect). Le locataire d'un user
    // ne change quasi-jamais ; les invalidations explicites suffisent
    // (signup → invalidate ; admin re-link → invalidate manuel).
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    retry: (count, err) => {
      // 404 = pas de locataire actif (cas pré-invitation) — pas de retry.
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404 || status === 403) return false;
      return count < 2;
    },
  });
}


// ── Documents + progression ───────────────────────────────────────────────────


/** Liste les documents + progression. */
export function useDossierDocuments(locataireId: string | undefined) {
  return useQuery({
    queryKey: locataireId ? dossierKeys.documents(locataireId) : ["dossier", "noop"],
    queryFn: () => listDossierDocuments(locataireId as string),
    enabled: Boolean(locataireId),
    // Sprint perf quick-wins (2026-05-12) : staleTime 30s + désactivation
    // des refetch automatiques. L'audit HAR a montré 3× refetch en 60s pour
    // le même endpoint (3-5s wait serveur × 3 = 9-15s de wait inutile).
    // Les mutations (upload, validate, reject, delete) invalident
    // explicitement le cache via useQueryClient.invalidateQueries.
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


// ── Mutations ─────────────────────────────────────────────────────────────────


export function useUploadDocument(locataireId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      file: File;
      type_document: TypeDocument;
      est_equivalent?: boolean;
      equivalent_libelle?: string;
    }) => uploadDossierDocument(locataireId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: dossierKeys.documents(locataireId) });
    },
  });
}


export function useDeleteDocument(locataireId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) => deleteDossierDocument(documentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: dossierKeys.documents(locataireId) });
    },
  });
}


export function useValidateDocument(locataireId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) => validateDocument(documentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: dossierKeys.documents(locataireId) });
    },
  });
}


export function useRejectDocument(locataireId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ documentId, commentaire }: { documentId: string; commentaire: string }) =>
      rejectDocument(documentId, commentaire),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: dossierKeys.documents(locataireId) });
    },
  });
}


export function useUpdateRenseignements(locataireId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: RenseignementsUpdate) =>
      updateRenseignements(locataireId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: dossierKeys.documents(locataireId) });
    },
  });
}


export function useMarkLoyerCautionVerses(locataireId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body?: { loyer_montant?: number; caution_montant?: number }) =>
      markLoyerCautionVerses(locataireId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: dossierKeys.documents(locataireId) });
    },
  });
}


export function useUpdateCosignataires(locataireId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cosignataires: CosignataireBase[]) =>
      updateCosignataires(locataireId, cosignataires),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: dossierKeys.me() });
      qc.invalidateQueries({ queryKey: dossierKeys.documents(locataireId) });
    },
  });
}


/** Hook one-shot pour récupérer une URL signée et ouvrir le document. */
export function useOpenDocument() {
  return useMutation({
    mutationFn: async (documentId: string) => {
      const { url } = await getDocumentSignedUrl(documentId);
      // Ouverture dans un nouvel onglet — bucket privé + URL temporaire 1h.
      window.open(url, "_blank", "noopener,noreferrer");
      return url;
    },
  });
}
