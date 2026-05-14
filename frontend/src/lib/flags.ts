/**
 * Feature flags — contrôle la visibilité des modules par phase de lancement.
 *
 * Les flags liés à une env var (Phase 2-3) sont activables par déploiement.
 * Les flags hardcodés `false` (Hors phase) nécessitent un changement de code.
 *
 * Usage :
 *   import { FLAGS, isEnabled } from "@/lib/flags";
 *   if (isEnabled("ROLE_AGENCE")) { ... }
 */

export const FLAGS = {
  // ── Phase 1 (actif) — proprio_solo + locataire + super_admin ──────────────
  // Pas de flag : tout est activé par défaut.

  // ── Phase 2 — rôles agence + portail ──────────────────────────────────────
  ROLE_AGENCE:           process.env.NEXT_PUBLIC_FLAG_AGENCE === "true",
  ROLE_PORTAIL_PROPRIO:  process.env.NEXT_PUBLIC_FLAG_PORTAIL === "true",

  // ── Phase 3 — marketplace artisans + ouvreurs ─────────────────────────────
  // ROLE_ARTISAN : rollout progressif canton par canton (2026-04-20 : GE + VD).
  // Activation prod = NEXT_PUBLIC_FLAG_ARTISAN=true côté Vercel.
  ROLE_ARTISAN:          process.env.NEXT_PUBLIC_FLAG_ARTISAN === "true",
  ROLE_OPENER:           process.env.NEXT_PUBLIC_FLAG_OPENER === "true",

  // ── Phase 2 — Module Communication (OAuth Gmail/Outlook + WhatsApp) ──────
  // Doctrine §B.15 : Phase 1.0 = email Resend uniquement, pas d'OAuth/WhatsApp.
  // Tant que ce flag est false : page /app/communication redirige vers /app,
  // NavItem "Communication" masqué de la sidebar, bouton "Contacter" sur la
  // fiche bien masqué, polling badge messagerie désactivé. Backend symétrique
  // via settings.ENABLE_OAUTH_COMMUNICATION (cf backend/app/core/config.py).
  // Réactivation Phase 2 : NEXT_PUBLIC_FLAG_OAUTH_COMMUNICATION=true côté Vercel.
  OAUTH_COMMUNICATION:   process.env.NEXT_PUBLIC_FLAG_OAUTH_COMMUNICATION === "true",

  // ── Phase 2 — Marketplace publique (favoris locataire) ───────────────────
  // Doctrine §B.15 : pas de marketplace publique en Phase 1.0 (Sunimmo).
  // Backend symétrique : BACKEND_FLAG_FAVORITES=false par défaut → /api/v1/
  // favorites/* retourne 503. Tant que ce flag est off côté frontend, on
  // évite l'appel pour ne pas polluer la console Sunimmo de 503.
  // Sprint 9 Lot E BUG 3.
  FAVORITES:             process.env.NEXT_PUBLIC_FLAG_FAVORITES === "true",

  // ── Phase 2 — Scoring IA candidature ──────────────────────────────────────
  // Doctrine §B.15 : "Scoring IA candidature" listé dans le périmètre interdit
  // Phase 1.0. Backend : BACKEND_FLAG_SCORING=false par défaut → 503.
  // Sprint 9 Lot E BUG 3.
  SCORING:               process.env.NEXT_PUBLIC_FLAG_SCORING === "true",

  // ── Hors phase — désactivé en dur ─────────────────────────────────────────
  ROLE_EXPERT:           false,
  ROLE_HUNTER:           false,
  ROLE_ACHETEUR_PREMIUM: false,
} as const;

export type FlagName = keyof typeof FLAGS;

/** Vérifie si un flag est activé. */
export const isEnabled = (flag: FlagName): boolean => FLAGS[flag];

/**
 * Map rôle → flag requis. Si le rôle n'est pas dans la map, il est toujours actif
 * (Phase 1 : proprio_solo, locataire, super_admin).
 */
export const ROLE_FLAG: Partial<Record<string, FlagName>> = {
  agence:           "ROLE_AGENCE",
  portail_proprio:  "ROLE_PORTAIL_PROPRIO",
  artisan:          "ROLE_ARTISAN",
  opener:           "ROLE_OPENER",
  expert:           "ROLE_EXPERT",
  hunter:           "ROLE_HUNTER",
  acheteur_premium: "ROLE_ACHETEUR_PREMIUM",
};

/**
 * Map section → flag requis. Si la section n'est pas dans la map, elle est toujours visible.
 */
export const SECTION_FLAG: Partial<Record<string, FlagName>> = {
  portail:       "ROLE_PORTAIL_PROPRIO",
  communication: "OAUTH_COMMUNICATION",
};

/** Vérifie si un rôle est activé par les feature flags. */
export function isRoleEnabled(role: string): boolean {
  const flag = ROLE_FLAG[role];
  return flag ? isEnabled(flag) : true;
}

/** Vérifie si une section de navigation est activée par les feature flags. */
export function isSectionEnabled(section: string): boolean {
  const flag = SECTION_FLAG[section];
  return flag ? isEnabled(flag) : true;
}
