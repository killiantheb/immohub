import type { Metadata, Viewport } from "next";
import { Fraunces, DM_Sans } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";
import { Providers } from "./providers";
import { CookieBanner } from "@/components/CookieBanner";

// Fraunces — seule serif du projet (titres, KPI, accents)
// Variable font : axes SOFT (arrondi) et WONK.
const fraunces = Fraunces({
  subsets: ["latin"],
  axes:    ["SOFT", "WONK"],
  style:   ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

// DM Sans — corps, labels, boutons
const dmSans = DM_Sans({
  subsets: ["latin"],
  weight:  ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Althy — L'immobilier suisse, sans agence.", template: "%s | Althy" },
  description: "Gérez votre bien, trouvez un locataire, encaissez vos loyers — en 2 clics, avec l'IA. L'assistant immobilier suisse pour propriétaires indépendants.",
  keywords: ["gestion immobilière", "Suisse", "assistant IA", "loyer", "contrat", "sans agence", "propriétaire", "althy.ch", "QR-facture", "Althy Autonomie"],
  authors: [{ name: "Althy", url: "https://althy.ch" }],
  creator: "Althy",
  metadataBase: new URL("https://althy.ch"),
  alternates: { canonical: "https://althy.ch" },
  openGraph: {
    type: "website",
    url: "https://althy.ch",
    siteName: "Althy",
    title: "Althy — L'immobilier suisse, sans agence.",
    description: "Gérez votre bien, trouvez un locataire, encaissez vos loyers — en 2 clics, avec l'IA.",
    locale: "fr_CH",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Althy — Assistant immobilier suisse" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Althy — L'immobilier suisse, sans agence.",
    description: "Gérez votre bien, trouvez un locataire, encaissez vos loyers — en 2 clics, avec l'IA.",
    images: ["/og-image.png"],
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: "/favicon.svg",
    apple: "/apple-touch-icon.svg",
  },
  manifest: "/site.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0F2E4C",
};

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://althy.ch/#org",
      name: "Althy",
      legalName: "HBM Swiss Sàrl",
      url: "https://althy.ch",
      logo: "https://althy.ch/icon.svg",
      description: "L'assistant immobilier suisse — gestion sans agence pour propriétaires indépendants.",
      areaServed: { "@type": "Country", name: "Switzerland" },
      sameAs: ["https://althy.ch"],
    },
    {
      "@type": "WebSite",
      "@id": "https://althy.ch/#website",
      url: "https://althy.ch",
      name: "Althy",
      publisher: { "@id": "https://althy.ch/#org" },
      inLanguage: "fr-CH",
    },
    {
      "@type": "Product",
      name: "Althy Autonomie",
      description: "Tous les outils d'une agence professionnelle pour CHF 39/mois. QR-factures, relances, contrats, EDL, IA juridique.",
      brand: { "@id": "https://althy.ch/#org" },
      offers: {
        "@type": "Offer",
        price: "39.00",
        priceCurrency: "CHF",
        availability: "https://schema.org/InStock",
        url: "https://althy.ch/autonomie",
      },
    },
  ],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();
  const htmlLang = locale.split("-")[0];

  return (
    <html lang={htmlLang} suppressHydrationWarning className={`${fraunces.variable} ${dmSans.variable}`}>
      <body className={`${fraunces.variable} ${dmSans.variable} font-sans`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>{children}</Providers>
          <CookieBanner />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
