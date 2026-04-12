import type { MetadataRoute } from "next";

const BASE = "https://althy.ch";
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // ── Pages statiques ──────────────────────────────────────────────────────────
  const statics: MetadataRoute.Sitemap = [
    { url: BASE,                           changeFrequency: "weekly",  priority: 1.0 },
    { url: `${BASE}/biens`,                changeFrequency: "hourly",  priority: 0.95 },
    { url: `${BASE}/biens/swipe`,          changeFrequency: "daily",   priority: 0.85 },
    { url: `${BASE}/biens/geneve`,         changeFrequency: "daily",   priority: 0.9 },
    { url: `${BASE}/biens/lausanne`,       changeFrequency: "daily",   priority: 0.9 },
    { url: `${BASE}/biens/vaud`,           changeFrequency: "daily",   priority: 0.9 },
    { url: `${BASE}/biens/fribourg`,       changeFrequency: "daily",   priority: 0.9 },
    { url: `${BASE}/biens/valais`,         changeFrequency: "daily",   priority: 0.85 },
    { url: `${BASE}/biens/neuchatel`,      changeFrequency: "daily",   priority: 0.85 },
    { url: `${BASE}/estimation`,           changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/register`,             changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/login`,                changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/publier`,              changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/contact`,              changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE}/legal/cgu`,            changeFrequency: "yearly",  priority: 0.2 },
    { url: `${BASE}/legal/confidentialite`,changeFrequency: "yearly",  priority: 0.2 },
  ];

  // ── Biens actifs (dynamique) ─────────────────────────────────────────────────
  let listingUrls: MetadataRoute.Sitemap = [];
  try {
    // Fetch several pages if needed (max 200 listings in sitemap)
    const pages = await Promise.all(
      [1, 2, 3, 4].map((p) =>
        fetch(`${API}/marketplace/biens?page=${p}&size=50`, {
          next: { revalidate: 3600 },
        }).then((r) => (r.ok ? r.json() : { items: [] }))
      )
    );

    for (const page of pages) {
      for (const bien of page.items ?? []) {
        listingUrls.push({
          url: `${BASE}/biens/${bien.id}`,
          lastModified: bien.published_at ? new Date(bien.published_at) : new Date(),
          changeFrequency: "daily",
          priority: bien.is_premium ? 0.95 : 0.85,
        });
      }
    }
  } catch {
    // Sitemap sans biens si l'API est down — on ne bloque pas le build
  }

  return [...statics, ...listingUrls];
}
