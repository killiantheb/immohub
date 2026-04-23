"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type {
  AuditLogEntry,
  Bien,
  BienCreate,
  BienDetail,
  BienDocument,
  BienFilters,
  BienImage,
  BienUpdate,
  CatalogueEquipement,
  EquipementCategorie,
  GenerateDescriptionResponse,
  PaginatedBiens,
} from "@/lib/types";

// TODO: Re-exports temporaires pour stabilité bundle 1b (étape 19).
// À supprimer dans les bundles P1 dédiés quand les 4 call sites
// (_shared.tsx, layout.tsx, [id]/page.tsx, historique/[locataire_id]/page.tsx)
// seront migrés vers des imports directs depuis @/lib/types.
export type {
  Bien,
  BienDetail,
  BienStatut,
  BienType,
  DocAlthyType,
  DocumentAlthy,
} from "@/lib/types";

// ── Types locaux conservés (hors scope refonte fusion properties→biens) ──────

export type LocataireStatut = "actif" | "sorti";
export type TypeCaution = "cash" | "compte_bloque" | "organisme";

export interface Locataire {
  id: string;
  bien_id: string;
  user_id?: string | null;
  date_entree?: string | null;
  date_sortie?: string | null;
  loyer?: number | null;
  charges?: number | null;
  depot_garantie?: number | null;
  type_caution?: TypeCaution | null;
  banque_caution?: string | null;
  iban_caution?: string | null;
  statut: LocataireStatut;
  motif_depart?: string | null;
  note_interne?: string | null;
  created_at: string;
}

export interface DossierLocataire {
  id: string;
  locataire_id: string;
  employeur?: string | null;
  poste?: string | null;
  type_contrat?: string | null;
  salaire_net?: number | null;
  anciennete?: number | null;
  assureur_rc?: string | null;
  numero_police?: string | null;
  validite_assurance?: string | null;
  resultat_poursuites?: string | null;
  date_poursuites?: string | null;
  office_poursuites?: string | null;
  created_at: string;
}

export type PaiementStatut = "recu" | "en_attente" | "retard";

export interface Paiement {
  id: string;
  locataire_id: string;
  bien_id: string;
  mois: string;
  montant: number;
  date_echeance: string;
  date_paiement?: string | null;
  statut: PaiementStatut;
  jours_retard: number;
  created_at: string;
}

export interface Intervention {
  id: string;
  bien_id: string;
  signale_par_id: string;
  artisan_id?: string | null;
  titre: string;
  description?: string | null;
  categorie: string;
  urgence: string;
  statut: "nouveau" | "en_cours" | "planifie" | "resolu";
  avancement: number;
  date_signalement?: string | null;
  date_intervention?: string | null;
  cout?: number | null;
  photos?: string[] | null;
  created_at: string;
}

export interface Devis {
  id: string;
  intervention_id: string;
  artisan_id?: string | null;
  montant_ht?: number | null;
  montant_ttc?: number | null;
  statut: "brouillon" | "envoye" | "accepte" | "refuse";
  notes?: string | null;
  created_at: string;
}

export interface MissionOuvreur {
  id: string;
  bien_id: string;
  ouvreur_id?: string | null;
  type: string;
  type_mission: string;
  date_mission?: string | null;
  creneau_debut?: string | null;
  creneau_fin?: string | null;
  heure_debut?: string | null;
  heure_fin?: string | null;
  adresse?: string | null;
  nb_candidats: number;
  remuneration?: number | null;
  statut: "proposee" | "acceptee" | "effectuee" | "annulee";
  notes?: string | null;
  created_at: string;
}

export interface ProfileOuvreur {
  id: string;
  user_id: string;
  zone_intervention?: string | null;
  rayon_km?: number | null;
  jours_dispo?: number[] | null;
  nb_missions_total?: number | null;
  note_moyenne?: number | null;
  created_at: string;
}

export interface ScoringLocataire {
  id: string;
  locataire_id: string;
  ponctualite: number;
  solvabilite: number;
  communication: number;
  etat_logement: number;
  score_global: number;
  nb_retards: number;
  updated_at?: string | null;
}

// ── Query keys ────────────────────────────────────────────────────────────────

export const bienKeys = {
  all: ["biens"] as const,
  list: (filters: BienFilters & { page?: number; size?: number }) =>
    ["biens", "list", filters] as const,
  detail: (id: string) => ["biens", id] as const,
  history: (id: string, limit?: number) =>
    ["biens", id, "history", limit ?? 50] as const,
  equipements: (id: string) => ["biens", id, "equipements"] as const,
  catalogue: (categorie?: EquipementCategorie | null) =>
    ["catalogue", "equipements", categorie ?? "all"] as const,
  locataires: (bienId: string, statut?: LocataireStatut) =>
    ["biens", bienId, "locataires", statut ?? "all"] as const,
  documents: (bienId: string) => ["biens", bienId, "documents"] as const,
  interventions: (bienId: string) =>
    ["biens", bienId, "interventions"] as const,
  paiements: (bienId: string) => ["biens", bienId, "paiements"] as const,
  scoring: (locataireId: string) => ["scoring", locataireId] as const,
  dossier: (locataireId: string) =>
    ["locataires", locataireId, "dossier"] as const,
};

// ── Image compression helper ─────────────────────────────────────────────────
// Preuploadage client : réduit la taille avant envoi multipart. Préservé depuis
// useProperties.ts (legacy) pour continuité des uploads côté fiche bien.

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

// ── Bien — list + CRUD ───────────────────────────────────────────────────────

export function useBiensList(
  filters: BienFilters & { page?: number; size?: number } = {},
) {
  const params = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== undefined && v !== ""),
  );
  return useQuery({
    queryKey: bienKeys.list(filters),
    queryFn: async () => {
      const { data } = await api.get<PaginatedBiens>("/biens", { params });
      return data;
    },
    staleTime: 30_000,
  });
}

export function useBien(id: string) {
  return useQuery({
    queryKey: bienKeys.detail(id),
    queryFn: async () => {
      const { data } = await api.get<BienDetail>(`/biens/${id}`);
      return data;
    },
    enabled: Boolean(id),
    staleTime: 30_000,
    retry: false,
  });
}

export function useCreateBien() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: BienCreate) => {
      const { data } = await api.post<Bien>("/biens", payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: bienKeys.all });
    },
  });
}

export function useUpdateBien(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: BienUpdate) => {
      const { data } = await api.patch<Bien>(`/biens/${id}`, payload);
      return data;
    },
    // Optimistic update
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey: bienKeys.detail(id) });
      const prev = qc.getQueryData<BienDetail>(bienKeys.detail(id));
      if (prev) {
        qc.setQueryData(bienKeys.detail(id), { ...prev, ...payload });
      }
      return { prev };
    },
    onError: (_err, _payload, ctx) => {
      if (ctx?.prev) qc.setQueryData(bienKeys.detail(id), ctx.prev);
    },
    onSuccess: (updated) => {
      // PATCH /biens/{id} retourne un BienRead (sans images/documents/équipements).
      // On merge dans le BienDetail en cache pour préserver les relations.
      qc.setQueryData<BienDetail>(bienKeys.detail(id), (prev) =>
        prev ? { ...prev, ...updated } : undefined,
      );
      qc.invalidateQueries({ queryKey: bienKeys.all });
    },
  });
}

export function useDeleteBien() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/biens/${id}`);
      return id;
    },
    onSuccess: (id) => {
      qc.removeQueries({ queryKey: bienKeys.detail(id) });
      qc.invalidateQueries({ queryKey: bienKeys.all });
    },
  });
}

// ── Images ───────────────────────────────────────────────────────────────────

export function useUploadBienImage(bienId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      file,
      isCover = false,
    }: {
      file: File;
      isCover?: boolean;
    }) => {
      const compressed = await compressImage(file);
      const form = new FormData();
      form.append("file", compressed);
      form.append("is_cover", String(isCover));
      const { data } = await api.post<BienImage>(
        `/biens/${bienId}/images`,
        form,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: bienKeys.detail(bienId) });
    },
  });
}

export function useDeleteBienImage(bienId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (imageId: string) => {
      await api.delete(`/biens/${bienId}/images/${imageId}`);
      return imageId;
    },
    // Optimistic : remove image from cache immediately
    onMutate: async (imageId) => {
      await qc.cancelQueries({ queryKey: bienKeys.detail(bienId) });
      const prev = qc.getQueryData<BienDetail>(bienKeys.detail(bienId));
      if (prev?.images) {
        qc.setQueryData<BienDetail>(bienKeys.detail(bienId), {
          ...prev,
          images: prev.images.filter((img) => img.id !== imageId),
        });
      }
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(bienKeys.detail(bienId), ctx.prev);
    },
  });
}

// ── Documents attachés au bien (table bien_documents) ─────────────────────────
// NB : distinct de la GED Althy (/docs-althy, voir useDocuments + DocumentAlthy).

export function useUploadBienDocument(bienId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      file,
      docType = "autre",
    }: {
      file: File;
      /** Libre côté backend (BienDocumentRead.type: str). */
      docType?: string;
    }) => {
      const form = new FormData();
      form.append("file", file);
      form.append("doc_type", docType);
      const { data } = await api.post<BienDocument>(
        `/biens/${bienId}/documents`,
        form,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: bienKeys.detail(bienId) });
    },
  });
}

// ── Équipements du bien ──────────────────────────────────────────────────────

export function useBienEquipements(bienId: string) {
  return useQuery({
    queryKey: bienKeys.equipements(bienId),
    queryFn: async () => {
      const { data } = await api.get<CatalogueEquipement[]>(
        `/biens/${bienId}/equipements`,
      );
      return data;
    },
    enabled: Boolean(bienId),
    staleTime: 60_000,
  });
}

export function useSetBienEquipements(bienId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (equipementIds: string[]) => {
      const { data } = await api.put<CatalogueEquipement[]>(
        `/biens/${bienId}/equipements`,
        { equipement_ids: equipementIds },
      );
      return data;
    },
    onSuccess: (equipements) => {
      qc.setQueryData(bienKeys.equipements(bienId), equipements);
      qc.invalidateQueries({ queryKey: bienKeys.detail(bienId) });
    },
  });
}

export function useRemoveBienEquipement(bienId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (equipementId: string) => {
      await api.delete(`/biens/${bienId}/equipements/${equipementId}`);
      return equipementId;
    },
    // Optimistic : retire l'équipement de la liste en cache
    onMutate: async (equipementId) => {
      await qc.cancelQueries({ queryKey: bienKeys.equipements(bienId) });
      const prev = qc.getQueryData<CatalogueEquipement[]>(
        bienKeys.equipements(bienId),
      );
      if (prev) {
        qc.setQueryData<CatalogueEquipement[]>(
          bienKeys.equipements(bienId),
          prev.filter((e) => e.id !== equipementId),
        );
      }
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(bienKeys.equipements(bienId), ctx.prev);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: bienKeys.detail(bienId) });
    },
  });
}

// ── Catalogue global équipements (/api/v1/catalogue/equipements) ─────────────
// Seed 0029 — 49 items. Staleness longue car contenu statique.

export function useCatalogueEquipements(
  categorie?: EquipementCategorie | null,
) {
  return useQuery({
    queryKey: bienKeys.catalogue(categorie),
    queryFn: async () => {
      const params = categorie ? { categorie } : undefined;
      const { data } = await api.get<CatalogueEquipement[]>(
        "/catalogue/equipements",
        params ? { params } : undefined,
      );
      return data;
    },
    staleTime: 300_000, // 5 min — catalogue statique
  });
}

// ── History (audit log /biens/{id}/history) ──────────────────────────────────

export function useBienHistory(bienId: string, limit = 50) {
  return useQuery({
    queryKey: bienKeys.history(bienId, limit),
    queryFn: async () => {
      const { data } = await api.get<AuditLogEntry[]>(
        `/biens/${bienId}/history`,
        { params: { limit } },
      );
      return data;
    },
    enabled: Boolean(bienId),
    staleTime: 30_000,
  });
}

// ── Generate description IA (Claude) ─────────────────────────────────────────

export function useGenerateBienDescription(bienId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<GenerateDescriptionResponse>(
        `/biens/${bienId}/generate-description`,
      );
      return data.description;
    },
    onSuccess: () => {
      // Invalidation ciblée — le service backend peut écrire description_logement
      // ou d'autres champs selon la logique ; on relit la source de vérité.
      qc.invalidateQueries({ queryKey: bienKeys.detail(bienId) });
    },
  });
}

// ── Locataires ────────────────────────────────────────────────────────────────

export function useLocataires(bienId: string, statut?: LocataireStatut) {
  return useQuery({
    queryKey: bienKeys.locataires(bienId, statut),
    queryFn: async () => {
      const params: Record<string, string> = { bien_id: bienId };
      if (statut) params.statut = statut;
      const { data } = await api.get<Locataire[]>("/locataires/", { params });
      return data;
    },
    enabled: Boolean(bienId),
    staleTime: 30_000,
  });
}

export function useLocataireActuel(bienId: string) {
  const q = useLocataires(bienId, "actif");
  return { ...q, data: q.data?.[0] ?? null };
}

export function useDossierLocataire(locataireId: string) {
  return useQuery({
    queryKey: bienKeys.dossier(locataireId),
    queryFn: async () => {
      const { data } = await api.get<DossierLocataire>(
        `/locataires/${locataireId}/dossier`,
      );
      return data;
    },
    enabled: Boolean(locataireId),
    staleTime: 60_000,
  });
}

// ── Documents Althy (GED — /docs-althy) ──────────────────────────────────────
// Table document_althy, enum strict DocAlthyType (10 valeurs FR).

export function useDocuments(bienId: string, locataireId?: string) {
  return useQuery({
    queryKey: bienKeys.documents(bienId),
    queryFn: async () => {
      const params: Record<string, string> = { bien_id: bienId };
      if (locataireId) params.locataire_id = locataireId;
      const { data } =
        await api.get<import("@/lib/types").DocumentAlthy[]>(
          "/docs-althy/",
          { params },
        );
      return data;
    },
    enabled: Boolean(bienId),
    staleTime: 30_000,
  });
}

// ── Paiements ─────────────────────────────────────────────────────────────────

export function usePaiements(bienId: string) {
  return useQuery({
    queryKey: bienKeys.paiements(bienId),
    queryFn: async () => {
      const { data } = await api.get<Paiement[]>("/paiements/", {
        params: { bien_id: bienId, size: 50 },
      });
      return data;
    },
    enabled: Boolean(bienId),
    staleTime: 30_000,
  });
}

// ── Interventions ─────────────────────────────────────────────────────────────

export function useInterventions(bienId: string) {
  return useQuery({
    queryKey: bienKeys.interventions(bienId),
    queryFn: async () => {
      const { data } = await api.get<Intervention[]>("/interventions-althy/", {
        params: { bien_id: bienId },
      });
      return data;
    },
    enabled: Boolean(bienId),
    staleTime: 30_000,
  });
}

export function useCreateIntervention() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: Omit<Intervention, "id" | "signale_par_id" | "created_at">,
    ) => {
      const { data } = await api.post<Intervention>(
        "/interventions-althy/",
        payload,
      );
      return data;
    },
    onSuccess: (inter) => {
      qc.invalidateQueries({ queryKey: bienKeys.interventions(inter.bien_id) });
    },
  });
}

// ── Scoring ───────────────────────────────────────────────────────────────────

export function useScoring(locataireId: string | null | undefined) {
  return useQuery({
    queryKey: bienKeys.scoring(locataireId ?? ""),
    queryFn: async () => {
      const { data } = await api.get<ScoringLocataire>(
        `/scoring/${locataireId}`,
      );
      return data;
    },
    enabled: Boolean(locataireId),
    staleTime: 60_000,
    retry: false,
  });
}
