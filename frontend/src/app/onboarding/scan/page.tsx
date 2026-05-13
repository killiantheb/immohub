import { redirect } from "next/navigation";

/**
 * /onboarding/scan — Scrape Homegate / ImmoScout24 / Immobilier.ch (Phase 2+).
 *
 * Phase 1.0 §B.15 : diffusion portails externes interdite (cf §2.4.5 perimetre
 * exclu Phase 1.0). La page d'origine pollait /onboarding/scan backend et
 * affichait des elements scrapes des portails publics — workflow report Phase 2.
 *
 * Redirect serveur vers le dashboard pour eviter une page orpheline. Le code
 * historique (review list, confirmer/rejeter, import) reste accessible dans
 * l'historique git pour reactivation Phase 2.
 */
export default function OnboardingScanPage() {
  redirect("/app");
}
