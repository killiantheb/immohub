"use client";

import { ComingSoon } from "@/components/ComingSoon";

// Phase 1 : publication marketplace masquée. Marketplace = phase post-openers/hunters.
// Code original conservé dans l'historique git (avant cette PR, voir git log).
// Réactivation : `git show <commit>:frontend/src/app/publier/page.tsx`.

export default function PublierPage() {
  return (
    <ComingSoon
      title="Publication marketplace en préparation"
      phase="Phase 4"
      description="La publication publique d'un bien sur la marketplace Althy sera disponible prochainement. En attendant, créez et gérez vos biens depuis votre espace propriétaire."
    />
  );
}
