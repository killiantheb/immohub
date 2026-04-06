"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Analytics } from "@/lib/analytics";

/**
 * Initialises PostHog once on mount and tracks page views on route changes.
 * Add <PostHogProvider /> inside the root layout body (after <Providers>).
 *
 * Install: npm install posthog-js
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.posthog.com";

    if (!key || typeof window === "undefined") return;

    // Lazy-load posthog-js so it doesn't block the initial render
    import("posthog-js").then(({ default: posthog }) => {
      if (!window.posthog) {
        posthog.init(key, {
          api_host: host,
          capture_pageview: false, // we track manually below
          autocapture: false,
          persistence: "localStorage",
        });
        // Expose globally for the lightweight wrapper in analytics.ts
        (window as typeof window & { posthog: typeof posthog }).posthog = posthog;
      }
    });
  }, []);

  // Track every route change as a page view
  useEffect(() => {
    Analytics.pageViewed(pathname);
  }, [pathname]);

  return <>{children}</>;
}
