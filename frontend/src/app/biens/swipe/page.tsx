"use client";

import { ComingSoon } from "@/components/ComingSoon";

// DORMANT Phase 2 — Killian 2026-05-09 — voir docs/2-ROADMAP.md §2.4.6.
// Swipe marketplace = code dormant. Le middleware intercepte normalement ce
// path avant que cette page ne s'affiche ; le ComingSoon reste en filet de
// sécurité si le middleware était bypassé. Code original conservé dans git.

export default function BiensSwipePage() {
  return (
    <ComingSoon
      title="Swipe biens en préparation"
      phase="Phase 2"
      description="Le mode découverte par swipe sera disponible quand la marketplace publique sera ouverte aux locataires (Phase 2 — cf 2-ROADMAP §2.5)."
    />
  );
}
