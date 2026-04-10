"use client";

import { useAuthStore } from "@/lib/store/authStore";
import { useUser } from "@/lib/auth";

// ── Canonical roles (CLAUDE.md §profiles) ────────────────────────────────────

export type AppRole =
  | "proprio_solo"
  | "agence"
  | "portail_proprio"
  | "opener"
  | "artisan"
  | "expert"
  | "hunter"
  | "locataire"
  | "acheteur_premium"
  | "super_admin"
  // Legacy (transitional — map to canonical below)
  | "owner"
  | "agency"
  | "tenant"
  | "company";

/** Canonical label per role */
export const ROLE_LABELS: Record<AppRole, string> = {
  proprio_solo:     "Propriétaire",
  agence:           "Agence",
  portail_proprio:  "Portail Proprio",
  opener:           "Ouvreur",
  artisan:          "Artisan",
  expert:           "Expert",
  hunter:           "Hunter",
  locataire:        "Locataire",
  acheteur_premium: "Acheteur",
  super_admin:      "Admin",
  // Legacy aliases
  owner:    "Propriétaire",
  agency:   "Agence",
  tenant:   "Locataire",
  company:  "Artisan",
};

/** Map legacy → canonical */
const LEGACY_MAP: Partial<Record<AppRole, AppRole>> = {
  owner:   "proprio_solo",
  agency:  "agence",
  tenant:  "locataire",
  company: "artisan",
};

/** Sections accessibles par rôle (mirrors backend ROLE_SECTIONS) */
export const ROLE_SECTIONS: Record<AppRole, string[]> = {
  super_admin:      ["*"],
  proprio_solo:     ["dashboard", "sphere", "biens", "finances", "interventions", "crm", "listings", "hunters", "comptabilite", "abonnement", "documents", "ouvreurs", "vente", "settings", "publications", "messages", "agenda", "whatsapp"],
  agence:           ["dashboard", "sphere", "biens", "finances", "interventions", "crm", "listings", "hunters", "comptabilite", "abonnement", "documents", "portail", "ouvreurs", "vente", "settings", "publications", "messages", "agenda", "whatsapp", "artisans", "onboarding"],
  portail_proprio:  ["dashboard", "biens", "finances", "documents", "settings"],
  opener:           ["dashboard", "sphere", "missions", "interventions", "finances", "abonnement", "ouvreurs", "settings", "messages", "agenda", "whatsapp"],
  artisan:          ["dashboard", "sphere", "interventions", "finances", "abonnement", "artisans", "settings", "messages", "agenda", "whatsapp"],
  expert:           ["dashboard", "sphere", "biens", "finances", "abonnement", "settings", "messages", "agenda"],
  hunter:           ["dashboard", "sphere", "hunters", "abonnement", "vente", "settings", "messages"],
  locataire:        ["dashboard", "sphere", "biens", "finances", "documents", "settings", "messages"],
  acheteur_premium: ["dashboard", "sphere", "listings", "settings", "vente", "messages"],
  // Legacy aliases (same sections as canonical)
  owner:    ["dashboard", "sphere", "biens", "finances", "interventions", "crm", "listings", "hunters", "comptabilite", "abonnement", "documents", "ouvreurs", "vente", "settings", "publications", "messages", "agenda", "whatsapp"],
  agency:   ["dashboard", "sphere", "biens", "finances", "interventions", "crm", "listings", "hunters", "comptabilite", "abonnement", "documents", "portail", "ouvreurs", "vente", "settings", "publications", "messages", "agenda", "whatsapp", "artisans", "onboarding"],
  tenant:   ["dashboard", "sphere", "biens", "finances", "documents", "settings", "messages"],
  company:  ["dashboard", "sphere", "interventions", "finances", "abonnement", "artisans", "settings", "messages", "agenda", "whatsapp"],
};

/** Plan tarifaire par rôle */
export const ROLE_PRICE: Record<AppRole, string | null> = {
  proprio_solo:     "CHF 29/mois",
  agence:           "CHF 29/agent/mois",
  portail_proprio:  "CHF 9/mois (facturé à l'agence)",
  opener:           "Gratuit · Pro CHF 19/mois",
  artisan:          "Gratuit · Pro CHF 19/mois",
  expert:           "Gratuit · Pro CHF 19/mois",
  hunter:           "Referral fee",
  locataire:        "Gratuit",
  acheteur_premium: "CHF 9/mois",
  super_admin:      null,
  owner:            "CHF 29/mois",
  agency:           "CHF 29/agent/mois",
  tenant:           "Gratuit",
  company:          "Gratuit · Pro CHF 19/mois",
};

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Returns the current user's role + permission helpers.
 * Normalises legacy role names to canonical names.
 */
export function useRole() {
  const { user } = useAuthStore();
  const { data: profile } = useUser();

  const rawRole = (profile?.role ?? user?.user_metadata?.role ?? null) as AppRole | null;
  const role: AppRole | null = rawRole
    ? (LEGACY_MAP[rawRole] ?? rawRole)
    : null;

  const can = (section: string): boolean => {
    if (!role) return false;
    const sections = ROLE_SECTIONS[role] ?? [];
    return sections.includes("*") || sections.includes(section);
  };

  const isAdmin        = role === "super_admin";
  const isProprioSolo  = role === "proprio_solo" || role === "owner";
  const isAgence       = role === "agence" || role === "agency";
  const isPortail      = role === "portail_proprio";
  const isOpener       = role === "opener";
  const isArtisan      = role === "artisan" || role === "company";
  const isExpert       = role === "expert";
  const isHunter       = role === "hunter";
  const isLocataire    = role === "locataire" || role === "tenant";
  const isAcheteur     = role === "acheteur_premium";

  /** Propriétaire ou agence — gestion de biens */
  const isManager = isProprioSolo || isAgence || isAdmin;
  /** Prestataires marketplace */
  const isMarketplace = isOpener || isArtisan || isExpert;

  return {
    role,
    rawRole,
    label: role ? ROLE_LABELS[role] : null,
    price: role ? ROLE_PRICE[role] : null,
    can,
    isAdmin,
    isProprioSolo,
    isAgence,
    isPortail,
    isOpener,
    isArtisan,
    isExpert,
    isHunter,
    isLocataire,
    isAcheteur,
    isManager,
    isMarketplace,
    // Legacy compatibility
    isOwner: isProprioSolo,
    isCompany: isArtisan,
    isTenant: isLocataire,
  };
}
