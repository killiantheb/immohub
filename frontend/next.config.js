// @ts-check
const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ── Redirects routes anglaises → françaises ──────────────────────────────────
  async redirects() {
    return [
      { source: "/app/properties/:path*",  destination: "/app/biens/:path*",           permanent: true },
      { source: "/app/openers/:path*",     destination: "/app/ouvreurs/:path*",         permanent: true },
      { source: "/app/tenant",             destination: "/app/locataire",               permanent: true },
      { source: "/app/accounting",         destination: "/app/comptabilite",            permanent: true },
      { source: "/app/advisor",            destination: "/app/sphere",                  permanent: true },
      { source: "/app/dashboard",          destination: "/app/sphere",                  permanent: true },
      { source: "/app/rfqs/:path*",        destination: "/app/artisans/devis/:path*",   permanent: true },
      { source: "/onboarding",             destination: "/bienvenue",                   permanent: true },
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

module.exports = withSentryConfig(nextConfig, {
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
