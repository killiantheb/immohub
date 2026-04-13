import type { Metadata } from "next";
import { Fraunces, DM_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { CookieBanner } from "@/components/CookieBanner";

// Variable font — axes SOFT (arrondi) et WONK uniquement.
// wght est l'axe standard géré implicitement — ne pas l'inclure dans axes.
const fraunces = Fraunces({
  subsets: ["latin"],
  axes:    ["SOFT", "WONK"],
  style:   ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

// DM Sans — poids complets pour l'interface (labels, boutons, corps)
const dmSans = DM_Sans({
  subsets: ["latin"],
  weight:  ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Althy — Assistant immobilier suisse", template: "%s | Althy" },
  description: "Althy gère vos biens immobiliers en Suisse : loyers, contrats, missions, devis — par la voix ou en un clic. Propriétaires, agences, locataires, artisans.",
  keywords: ["gestion immobilière", "Suisse", "assistant IA", "loyer", "contrat", "agence immobilière", "althy.ch"],
  authors: [{ name: "Althy", url: "https://althy.ch" }],
  creator: "Althy",
  metadataBase: new URL("https://althy.ch"),
  alternates: { canonical: "https://althy.ch" },
  openGraph: {
    type: "website",
    url: "https://althy.ch",
    siteName: "Althy",
    title: "Althy — Assistant immobilier suisse",
    description: "Gérez vos biens immobiliers en Suisse par la voix. Loyers, contrats, missions, devis — Althy s'occupe de tout.",
    locale: "fr_CH",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Althy — Assistant immobilier" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Althy — Assistant immobilier suisse",
    description: "Gérez vos biens immobiliers en Suisse par la voix.",
    images: ["/og-image.png"],
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }], shortcut: "/icon.svg", apple: "/icon.svg" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning className={`${fraunces.variable} ${dmSans.variable}`}>
      <body className={`${dmSans.variable} ${fraunces.variable} font-sans`}>
        <Providers>{children}</Providers>
        <CookieBanner />
      </body>
    </html>
  );
}
