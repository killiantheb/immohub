"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";

// ── Types ─────────────────────────────────────────────────────────────────────

export type BienType =
  | "appartement" | "villa" | "studio" | "maison" | "commerce"
  | "bureau" | "parking" | "garage" | "cave" | "autre";

export type BienStatut = "loue" | "vacant" | "en_travaux";

export interface Bien {
  id: string;
  owner_id: string;
  adresse: string;
  ville: string;
  cp: string;
  type: BienType;
  surface?: number | null;
  etage?: number | null;
  loyer?: number | null;
  charges?: number | null;
  statut: BienStatut;
  created_at: string;
}

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

export type DocAlthyType =
  | "bail" | "edl_entree" | "edl_sortie" | "quittance"
  | "attestation_assurance" | "contrat_travail" | "fiche_salaire"
  | "extrait_poursuites" | "attestation_caution" | "autre";

export interface DocumentAlthy {
  id: string;
  bien_id?: string | null;
  locataire_id?: string | null;
  type: DocAlthyType;
  url_storage: string;
  date_document?: string | null;
  genere_par_ia: boolean;
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
  detail: (id: string) => ["biens", id] as const,
  locataires: (bienId: string, statut?: LocataireStatut) =>
    ["biens", bienId, "locataires", statut ?? "all"] as const,
  documents: (bienId: string) => ["biens", bienId, "documents"] as const,
  interventions: (bienId: string) => ["biens", bienId, "interventions"] as const,
  paiements: (bienId: string) => ["biens", bienId, "paiements"] as const,
  scoring: (locataireId: string) => ["scoring", locataireId] as const,
  dossier: (locataireId: string) => ["locataires", locataireId, "dossier"] as const,
};

// ── Bien ──────────────────────────────────────────────────────────────────────

export function useBien(id: string) {
  return useQuery({
    queryKey: bienKeys.detail(id),
    queryFn: async () => {
      const { data } = await api.get<Bien>(`/biens/${id}`);
      return data;
    },
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}

export function useUpdateBien(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Bien>) => {
      const { data } = await api.patch<Bien>(`/biens/${id}`, payload);
      return data;
    },
    onSuccess: (updated) => {
      qc.setQueryData(bienKeys.detail(id), updated);
      qc.invalidateQueries({ queryKey: bienKeys.all });
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
        `/locataires/${locataireId}/dossier`
      );
      return data;
    },
    enabled: Boolean(locataireId),
    staleTime: 60_000,
  });
}

// ── Documents ─────────────────────────────────────────────────────────────────

export function useDocuments(bienId: string, locataireId?: string) {
  return useQuery({
    queryKey: bienKeys.documents(bienId),
    queryFn: async () => {
      const params: Record<string, string> = { bien_id: bienId };
      if (locataireId) params.locataire_id = locataireId;
      const { data } = await api.get<DocumentAlthy[]>("/docs-althy/", { params });
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
    mutationFn: async (payload: Omit<Intervention, "id" | "signale_par_id" | "created_at">) => {
      const { data } = await api.post<Intervention>("/interventions-althy/", payload);
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
      const { data } = await api.get<ScoringLocataire>(`/scoring/${locataireId}`);
      return data;
    },
    enabled: Boolean(locataireId),
    staleTime: 60_000,
    retry: false,
  });
}
