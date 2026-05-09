import { redirect } from "next/navigation";

// DORMANT Phase 2 — Killian 2026-05-09 — voir docs/2-ROADMAP.md §2.4.6.
// Fiche bien publique = code dormant. Réactivation Phase 2 (cf §2.5).
// Le middleware (frontend/src/middleware.ts) intercepte d'abord ce path.
// Code original conservé dans l'historique git, réactivable post-marketplace.

export default function BienDetailPage() {
  redirect("/");
}
