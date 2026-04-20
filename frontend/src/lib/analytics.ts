/**
 * Analytics wrapper — PostHog events for Althy.
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

  // ── Marketplace ───────────────────────────────────────────────────────────

  listingViewed: (listingId: string, prix: number | null, ville: string) =>
    trackEvent("listing_viewed", { listing_id: listingId, prix, ville }),

  swipeRight: (listingId: string) =>
    trackEvent("swipe_right", { listing_id: listingId }),

  swipeLeft: (listingId: string) =>
    trackEvent("swipe_left", { listing_id: listingId }),

  candidatureSubmitted: (listingId: string) =>
    trackEvent("candidature_submitted", { listing_id: listingId }),

  bienPublie: (listingId: string, transactionType: string) =>
    trackEvent("bien_publie", { listing_id: listingId, transaction_type: transactionType }),

  interetExprime: (listingId: string) =>
    trackEvent("interet_exprime", { listing_id: listingId }),

  // ── Althy Autonomie (A4 — pivot stratégique) ─────────────────────────────

  autonomyPageViewed: (source: "public_landing" | "dashboard") =>
    trackEvent("autonomy_page_viewed", { source }),

  autonomyComparisonCalculated: (nbBiens: number, loyerMoyen: number, economie: number) =>
    trackEvent("autonomy_comparison_calculated", {
      nb_biens: nbBiens,
      loyer_moyen: loyerMoyen,
      economie_annuelle: economie,
    }),

  autonomySubscriptionStarted: (stage: "account_created" | "checkout_opened") =>
    trackEvent("autonomy_subscription_started", { stage }),

  autonomySubscriptionActivated: (previousPlan: string | null) =>
    trackEvent("autonomy_subscription_activated", { previous_plan: previousPlan }),

  autonomyVerificationUsed: (remaining: number) =>
    trackEvent("autonomy_verification_used", { remaining }),

  autonomyOpenerMissionUsed: (remaining: number) =>
    trackEvent("autonomy_opener_mission_used", { remaining }),

  autonomyCancelled: (reason: string | null) =>
    trackEvent("autonomy_cancelled", { reason }),

  // ── Dossier locataire (pivot CHF 45 owner — 2026-04-20) ──────────────────

  tenantDossierAccepted: (candidatureId: string) =>
    trackEvent("tenant_dossier_accepted", { candidature_id: candidatureId }),

  ownerFeeCharged: (candidatureId: string, amountChf: number) =>
    trackEvent("owner_fee_charged", {
      candidature_id: candidatureId,
      amount_chf: amountChf,
    }),

  ownerFeeFailed: (candidatureId: string, reason: string) =>
    trackEvent("owner_fee_failed", {
      candidature_id: candidatureId,
      reason,
    }),
};
