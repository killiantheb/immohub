import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/biens",
          "/biens/",
          "/biens/*",
          "/estimation",
          "/register",
          "/login",
          "/contact",
          "/legal/",
          "/legal/*",
        ],
        disallow: [
          "/app/",     // dashboard authentifié
          "/admin/",
          "/api/",
          "/rejoindre/",  // liens magiques privés
          "/portail/",    // portails privés
          "/bienvenue",
          "/onboarding",
        ],
      },
    ],
    sitemap: "https://althy.ch/sitemap.xml",
  };
}
