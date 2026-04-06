/**
 * Analytics wrapper — PostHog events for CATHY.
 * Import `Analytics` anywhere in the app to fire typed events.
 *
 * Install: npm install posthog-js
 * Env var: NEXT_PUBLIC_POSTHOG_KEY, NEXT_PUBLIC_POSTHOG_HOST
 */

declare global {
  interface Window {
    posthog?: {
      capture: (event: string, properties?: Record<string, unknown>) => void;
      identify: (id: string, properties?: Record<string, unknown>) => void;
      reset: () => void;
    };
  }
}

export function trackEvent(
  name: string,
  properties?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  if (!window.posthog) return;
  window.posthog.capture(name, properties);
}

export function identifyUser(
  userId: string,
  properties?: { email?: string; role?: string; name?: string },
): void {
  if (typeof window === "undefined") return;
  if (!window.posthog) return;
  window.posthog.identify(userId, properties);
}

export function resetAnalytics(): void {
  if (typeof window === "undefined") return;
  window.posthog?.reset();
}

// ── Typed event helpers ───────────────────────────────────────────────────────

export const Analytics = {
  // Properties
  propertyCreated: (id: string, type: string, city: string) =>
    trackEvent("property_created", { id, type, city }),

  propertyUpdated: (id: string) =>
    trackEvent("property_updated", { id }),

  // Contracts
  contractSigned: (id: string, type: string) =>
    trackEvent("contract_signed", { id, type }),

  contractTerminated: (id: string) =>
    trackEvent("contract_terminated", { id }),

  // Payments
  paymentReceived: (id: string, amount: number, type: string) =>
    trackEvent("payment_received", { id, amount, type }),

  paymentLate: (id: string, amount: number) =>
    trackEvent("payment_late", { id, amount }),

  // AI features
  aiUsed: (feature: "listing" | "tenant_score" | "quote" | "chat" | "anomaly", context?: string) =>
    trackEvent("ai_used", { feature, context }),

  // Marketplace
  missionCreated: (id: string, category: string) =>
    trackEvent("mission_created", { id, category }),

  quoteAccepted: (id: string, amount: number) =>
    trackEvent("quote_accepted", { id, amount }),

  rfqCreated: (id: string, category: string, urgency: string) =>
    trackEvent("rfq_created", { id, category, urgency }),

  // Navigation
  pageViewed: (path: string) =>
    trackEvent("page_viewed", { path }),

  // Auth
  userSignedIn: (role: string) =>
    trackEvent("user_signed_in", { role }),

  userSignedOut: () =>
    trackEvent("user_signed_out"),
};
