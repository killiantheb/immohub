import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Biens à louer et à vendre en Suisse | Althy",
  description:
    "Trouvez votre prochain bien immobilier en Suisse romande. Location, vente, colocation à Genève, Lausanne, Fribourg et dans tout le canton de Vaud. Annonces vérifiées par Althy IA.",
  keywords: [
    "immobilier suisse",
    "location appartement genève",
    "location appartement lausanne",
    "vente maison vaud",
    "colocation suisse romande",
    "althy",
  ],
  openGraph: {
    title: "Marketplace immobilière Suisse | Althy",
    description: "Location, vente et colocation en Suisse romande. Annonces vérifiées.",
    url: "https://althy.ch/biens",
    siteName: "Althy",
    locale: "fr_CH",
    type: "website",
  },
  alternates: {
    canonical: "https://althy.ch/biens",
  },
};

export default function BiensLayout({ children }: { children: React.ReactNode }) {
  return children;
}
