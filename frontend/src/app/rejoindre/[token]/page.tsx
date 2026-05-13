import { redirect } from "next/navigation";

/**
 * Legacy /rejoindre/[token] — redirige vers /invite/[token].
 *
 * Phase 1.0 §B.15 : l'unique flow d'arrivée locataire est l'invitation bailleur
 * via /invite/[token]. L'ancien endpoint /onboarding/rejoindre (qui retournait
 * `auth_url`) n'est plus utilise. Redirect serveur pour preserver les anciens
 * liens email deja envoyes.
 */
export default function RejoindrePage({
  params,
}: {
  params: { token: string };
}) {
  redirect(`/invite/${params.token}`);
}
