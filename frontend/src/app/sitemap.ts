import type { MetadataRoute } from "next";

const BASE = "https://althy.ch";

export default function sitemap(): MetadataRoute.Sitemap {
  // ── Pages statiques (Phase 1 : marketplace publique masquée) ───────────────
  const statics: MetadataRoute.Sitemap = [
    { url: BASE,                           changeFrequency: "weekly",  priority: 1.0 },
    { url: `${BASE}/estimation`,           changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/autonomie`,            changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/register`,             changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/login`,                changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/contact`,              changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE}/legal`,                 changeFrequency: "yearly",  priority: 0.2 },
    { url: `${BASE}/legal/cgu`,            changeFrequency: "yearly",  priority: 0.2 },
    { url: `${BASE}/legal/confidentialite`,changeFrequency: "yearly",  priority: 0.2 },
    { url: `${BASE}/legal/cookies`,        changeFrequency: "yearly",  priority: 0.1 },
    { url: `${BASE}/legal/disclaimer-ia`,  changeFrequency: "yearly",  priority: 0.1 },
  ];

  // Phase 1 : pas de biens dynamiques dans le sitemap (marketplace publique masquée).
  // À réactiver quand /biens et /biens/[id] redeviendront accessibles.

  return statics;
}
