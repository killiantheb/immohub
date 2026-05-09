import { redirect } from "next/navigation";

// DORMANT Phase 2 — Killian 2026-05-09 — voir docs/2-ROADMAP.md §2.4.6.
// Page SEO canton = code dormant. Le middleware intercepte d'abord ce path.
// Code original conservé dans l'historique git, réactivable post-marketplace.

export default function BiensVaudPage() {
  redirect("/");
}
