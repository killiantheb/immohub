"use client";

import { useAuthStore } from "@/lib/store/authStore";
import { useUser } from "@/lib/auth";
import { type UserRole, ROLE_LABELS, LEGACY_ROLE_MAP } from "@/lib/types";
import { isRoleEnabled, isSectionEnabled } from "@/lib/flags";

// AppRole = UserRole — ré-exporté pour rétrocompatibilité des imports existants.
export type AppRole = UserRole;
export { ROLE_LABELS };

/** Sections accessibles par rôle (mirrors backend ROLE_SECTIONS) */
export const ROLE_SECTIONS: Record<UserRole, string[]> = {
  super_admin:      ["*"],
  proprio_solo:     ["dashboard", "sphere", "carte", "biens", "candidatures", "finances", "interventions", "crm", "listings", "hunters", "comptabilite", "abonnement", "documents", "ouvreurs", "vente", "settings", "communication", "profile"],
  agence:           ["dashboard", "sphere", "carte", "biens", "candidatures", "finances", "interventions", "crm", "listings", "hunters", "comptabilite", "abonnement", "documents", "portail", "ouvreurs", "vente", "settings", "communication", "artisans", "onboarding", "profile"],
  portail_proprio:  ["dashboard", "carte", "biens", "finances", "documents", "settings", "communication", "profile"],
  opener:           ["dashboard", "sphere", "carte", "ouvreurs", "interventions", "finances", "abonnement", "settings", "communication", "profile"],
  artisan:          ["dashboard", "sphere", "carte", "interventions", "finances", "abonnement", "artisans", "settings", "communication", "profile"],
  expert:           ["dashboard", "sphere", "carte", "biens", "finances", "abonnement", "settings", "communication", "profile"],
  hunter:           ["dashboard", "sphere", "carte", "hunters", "abonnement", "vente", "settings", "communication", "profile"],
  locataire:        ["dashboard", "sphere", "carte", "biens", "mes_candidatures", "finances", "documents", "settings", "communication", "profile"],
  acheteur_premium: ["dashboard", "sphere", "carte", "listings", "mes_candidatures", "settings", "vente", "communication", "profile"],
};

/** Plan tarifaire par rôle */
export const ROLE_PRICE: Record<UserRole, string | null> = {
  proprio_solo:     "Gratuit · Starter CHF 14 · Pro CHF 29/mois",
  agence:           "CHF 79/agent/mois · Premium CHF 129",
  portail_proprio:  "CHF 9/mois (facturé à l'agence)",
  opener:           "Gratuit · Pro CHF 19/mois",
  artisan:          "Profil gratuit · Commission 10%",
  expert:           "Gratuit · Pro CHF 19/mois",
  hunter:           "Referral fee",
  locataire:        "Gratuit",
  acheteur_premium: "CHF 9/mois",
  super_admin:      null,
};

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Returns the current user's role + permission helpers.
 * Normalises legacy role names (owner/agency/tenant/company) to canonical names.
 */
export function useRole() {
  const { user } = useAuthStore();
  const { data: profile } = useUser();

  const rawRole = (profile?.role ?? user?.user_metadata?.role ?? null) as string | null;
  const role: UserRole | null = rawRole
    ? ((LEGACY_ROLE_MAP[rawRole] ?? rawRole) as UserRole)
    : null;

  const can = (section: string): boolean => {
    if (!role) return false;
    if (!isRoleEnabled(role)) return false;
    if (!isSectionEnabled(section)) return false;
    const sections = ROLE_SECTIONS[role] ?? [];
    return sections.includes("*") || sections.includes(section);
  };

  const isAdmin        = role === "super_admin";
  const isProprioSolo  = role === "proprio_solo";
  const isAgence       = role === "agence";
  const isPortail      = role === "portail_proprio";
  const isOpener       = role === "opener";
  const isArtisan      = role === "artisan";
  const isExpert       = role === "expert";
  const isHunter       = role === "hunter";
  const isLocataire    = role === "locataire";
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
    // Legacy aliases — gardés pour rétrocompatibilité
    isOwner: isProprioSolo,
    isCompany: isArtisan,
    isTenant: isLocataire,
  };
}
