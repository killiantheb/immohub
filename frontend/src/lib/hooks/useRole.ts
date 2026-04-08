"use client";

import { useAuthStore } from "@/lib/store/authStore";
import { useUser } from "@/lib/auth";

export type AppRole =
  | "super_admin"
  | "owner"       // propriétaire
  | "agency"      // agence
  | "opener"      // ouvreur
  | "tenant"      // locataire
  | "company";    // artisan

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Admin",
  owner:       "Propriétaire",
  agency:      "Agence",
  opener:      "Ouvreur",
  tenant:      "Locataire",
  company:     "Artisan",
};

/** Sections autorisées par rôle */
export const ROLE_SECTIONS: Record<AppRole, string[]> = {
  super_admin: ["dashboard", "biens", "finances", "interventions", "ouvreurs", "artisans", "publications", "locataire", "crm", "althy", "settings"],
  owner:       ["dashboard", "biens", "finances", "interventions", "crm", "althy", "settings"],
  agency:      ["dashboard", "biens", "finances", "interventions", "ouvreurs", "publications", "crm", "althy", "settings"],
  opener:      ["dashboard", "ouvreurs", "finances", "althy", "settings"],
  tenant:      ["dashboard", "biens", "finances", "althy", "settings"],
  company:     ["dashboard", "artisans", "finances", "althy", "settings"],
};

/**
 * Retourne le rôle courant depuis le store Zustand (synchrone, côté client).
 * Utilise le profil DB si disponible, sinon les métadonnées Supabase.
 */
export function useRole() {
  const { user } = useAuthStore();
  const { data: profile } = useUser();

  // Profil DB canonique > metadata Supabase
  const role = (profile?.role ?? user?.user_metadata?.role ?? null) as AppRole | null;

  const can = (section: string): boolean => {
    if (!role) return false;
    return ROLE_SECTIONS[role]?.includes(section) ?? false;
  };

  const isAdmin     = role === "super_admin";
  const isOwner     = role === "owner";
  const isAgency    = role === "agency";
  const isOpener    = role === "opener";
  const isTenant    = role === "tenant";
  const isCompany   = role === "company";
  const isManager   = isOwner || isAgency || isAdmin;

  return {
    role,
    label: role ? ROLE_LABELS[role] : null,
    can,
    isAdmin,
    isOwner,
    isAgency,
    isOpener,
    isTenant,
    isCompany,
    isManager,
  };
}
