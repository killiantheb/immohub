import { redirect } from "next/navigation";

/**
 * /postuler/[listing_id] — Candidature spontanee (Phase 2).
 *
 * Phase 1.0 §B.15 : la candidature spontanee + scoring IA + marketplace publique
 * sont reportes Phase 2. En Phase 1.0 le locataire arrive uniquement via une
 * invitation bailleur (cf /invite/[token]). On redirige vers la landing pour
 * eviter une page orpheline qui afficherait des CHF 45 / score IA / marketplace.
 *
 * Le code historique (upload docs, scoring IA, marketplace API) reste accessible
 * dans l'historique git pour reactivation Phase 2.
 */
export default function PostulerPage() {
  redirect("/");
}
