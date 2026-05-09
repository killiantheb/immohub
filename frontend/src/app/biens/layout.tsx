import type { Metadata } from "next";

// DORMANT Phase 2 — Killian 2026-05-09 — voir docs/2-ROADMAP.md §2.4.6.
// Metadata SEO marketplace neutralisé Phase 1.0. La canonique + openGraph
// historiques pointaient vers https://althy.ch/biens et poussaient Google à
// indexer une marketplace inexistante. On force noindex + nofollow tant que
// la marketplace n'est pas réactivée Phase 2.
// Snapshot original conservé dans l'historique git pour réactivation.
export const metadata: Metadata = {
  title: "Althy",
  description: "Althy — logiciel de gestion locative.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function BiensLayout({ children }: { children: React.ReactNode }) {
  return children;
}
