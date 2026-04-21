// @ts-check
const { withSentryConfig } = require("@sentry/nextjs");
const createNextIntlPlugin = require("next-intl/plugin");

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ── Redirects routes anglaises → françaises (301 permanent, SEO-safe) ────────
  async redirects() {
    return [
      // Pages publiques legacy
      { source: "/privacy",                destination: "/legal/confidentialite",       permanent: true },
      { source: "/terms",                  destination: "/legal/cgu",                   permanent: true },

      // Dashboard — URLs anglaises → françaises
      { source: "/app/properties/:path*",  destination: "/app/biens/:path*",            permanent: true },
      { source: "/app/openers/:path*",     destination: "/app/ouvreurs/:path*",         permanent: true },
      { source: "/app/tenant",             destination: "/app",                         permanent: true },
      { source: "/app/accounting",         destination: "/app/finances?tab=comptabilite", permanent: true },
      { source: "/app/advisor",            destination: "/app/sphere",                  permanent: true },
      { source: "/app/dashboard",          destination: "/app/sphere",                  permanent: true },
      { source: "/app/profile",            destination: "/app/profil",                  permanent: true },
      { source: "/app/listings",           destination: "/app/biens",                   permanent: true },
      { source: "/app/insurance",          destination: "/bientot/assurance",           permanent: true },

      // Redirects fonctionnels (pages consolidées)
      { source: "/app/overview",           destination: "/app",                         permanent: true },
      { source: "/app/companies",          destination: "/app/agence",                  permanent: true },
      { source: "/app/favorites",          destination: "/app/biens?tab=favoris",       permanent: true },
      { source: "/app/publications/:path*",destination: "/app/biens",                   permanent: true },
      { source: "/app/rfqs/:path*",        destination: "/app/artisans/devis",          permanent: true },
      { source: "/onboarding",             destination: "/bienvenue",                   permanent: true },

      // Cleanup orphan pages (audit 2026-04-21) — pages supprimées
      { source: "/app/comptabilite/:path*",destination: "/app/finances?tab=comptabilite", permanent: true },
      { source: "/app/messagerie",         destination: "/app/communication?tab=messages", permanent: true },
      { source: "/app/agenda",             destination: "/app/communication?tab=agenda",   permanent: true },
      { source: "/app/whatsapp",           destination: "/app/communication?tab=whatsapp", permanent: true },
      { source: "/app/annonces",           destination: "/app/biens",                   permanent: true },
      { source: "/app/transactions",       destination: "/app/finances",                permanent: true },
      { source: "/app/locataire",          destination: "/app",                         permanent: true },

      // Pages rôles désactivés → waitlist /bientot/[role]
      { source: "/app/acheteur",           destination: "/bientot/acheteur_premium",    permanent: true },
      { source: "/app/expert",             destination: "/bientot/expert",              permanent: true },
      { source: "/app/hunter",             destination: "/bientot/hunter",              permanent: true },
      { source: "/app/hunters",            destination: "/bientot/hunter",              permanent: true },
      { source: "/app/vente",              destination: "/bientot/vente",               permanent: true },
      { source: "/app/assurance",          destination: "/bientot/assurance",           permanent: true },
    ];
  },

  // ── Performance ─────────────────────────────────────────────────────────────
  compress: true,
  poweredByHeader: false,

  // Tree-shake lucide-react + recharts icon imports (biggest bundle wins)
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "@tanstack/react-query",
    ],
  },

  generateBuildId: async () => {
    return `build-${Date.now()}`;
  },

  webpack: (config, { isServer }) => {
    // Invalidate Vercel's persistent webpack cache so all chunks are rebuilt
    if (config.cache && typeof config.cache === "object") {
      config.cache.version = `v${Date.now()}`;
    }

    // Split recharts + leaflet into separate async chunks (not in initial bundle)
    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          ...(config.optimization.splitChunks || {}),
          cacheGroups: {
            ...(config.optimization.splitChunks?.cacheGroups || {}),
            recharts: {
              name: "recharts",
              test: /[\\/]node_modules[\\/](recharts|d3-.*)[\\/]/,
              chunks: "async",
              priority: 20,
            },
            leaflet: {
              name: "leaflet",
              test: /[\\/]node_modules[\\/](leaflet|react-leaflet)[\\/]/,
              chunks: "async",
              priority: 20,
            },
            mapbox: {
              name: "mapbox",
              test: /[\\/]node_modules[\\/](mapbox-gl)[\\/]/,
              chunks: "async",
              priority: 20,
            },
          },
        },
      };
    }
    return config;
  },

  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

module.exports = withSentryConfig(withNextIntl(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
  automaticVercelMonitors: false,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
});
