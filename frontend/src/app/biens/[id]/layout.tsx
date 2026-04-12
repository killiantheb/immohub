import type { Metadata } from "next";
import type { ReactNode } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
const BASE = "https://althy.ch";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  try {
    const bien = await fetch(`${API}/marketplace/${params.id}`, {
      next: { revalidate: 60 },
    }).then((r) => (r.ok ? r.json() : null));

    if (!bien) return { title: "Bien immobilier — Althy" };

    const titre = bien.titre ?? `${bien.type_label} à ${bien.ville}`;
    const prix = bien.prix
      ? `CHF ${Number(bien.prix).toLocaleString("fr-CH")}/mois`
      : "";
    const descFallback = [
      bien.type_label,
      bien.surface ? `${bien.surface}m²` : "",
      bien.pieces ? `${bien.pieces} pièces` : "",
      bien.ville,
      prix,
    ]
      .filter(Boolean)
      .join(" · ");
    const desc = bien.description_ia
      ? bien.description_ia.slice(0, 150)
      : descFallback;

    return {
      title: `${titre} — ${bien.ville} | Althy`,
      description: desc || `Location à ${bien.ville} sur Althy`,
      alternates: {
        canonical: `${BASE}/biens/${params.id}`,
      },
      openGraph: {
        title: titre,
        description: desc,
        url: `${BASE}/biens/${params.id}`,
        siteName: "Althy",
        type: "article",
        locale: "fr_CH",
        images: bien.cover
          ? [
              {
                url: bien.cover,
                width: 1200,
                height: 630,
                alt: titre,
              },
            ]
          : [
              {
                url: `${BASE}/og-default.jpg`,
                width: 1200,
                height: 630,
              },
            ],
      },
      twitter: {
        card: "summary_large_image",
        title: titre,
        description: desc,
        images: bien.cover ? [bien.cover] : [`${BASE}/og-default.jpg`],
      },
    };
  } catch {
    return { title: "Bien immobilier — Althy" };
  }
}

export default function BienLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
