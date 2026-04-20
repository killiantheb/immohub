/**
 * Analytics wrapper — PostHog events for Althy.
 *
 * Source unique des événements produit. Toute l'app doit passer par
 * `trackEvent` / `trackFirst` / `Analytics.xxx` — jamais `window.posthog` direct.
 *
 * Réf : docs/analytics-events.md (matrice complète).
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

// ── Primitives ────────────────────────────────────────────────────────────────

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

/**
 * Déclenche un événement "premier X" uniquement si pas déjà déclenché localement.
 * Guard basé sur localStorage — précision "par navigateur/user", suffisant pour
 * des funnels d'activation. Pour une précision absolue, dédupliquer côté PostHog
 * via un filtre "premier occurrence par distinct_id".
 */
export function trackFirst(
  event: string,
  properties?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  const key = `althy.first.${event}`;
  try {
    if (window.localStorage.getItem(key)) return;
    window.localStorage.setItem(key, new Date().toISOString());
  } catch {
    // localStorage indisponible (mode privé) — déclenche quand même
  }
  trackEvent(event, properties);
}

// ── Typed event helpers ───────────────────────────────────────────────────────
// Organisés par funnel : Acquisition → Signup → Activation → Conversion →
// Rétention → Expansion → Churn.

export const Analytics = {
  // ── A. ACQUISITION ─────────────────────────────────────────────────────────

  landingVisited: (path: string = "/") =>
    trackEvent("landing_visited", { path }),

  landingCtaClicked: (
    ctaLabel: string,
    location: "hero" | "nav" | "pricing" | "autonomie" | "final" | "footer",
    href?: string,
  ) =>
    trackEvent("landing_cta_clicked", { cta_label: ctaLabel, location, href }),

  pricingViewed: (surface: "landing" | "app_abonnement") =>
    trackEvent("pricing_viewed", { surface }),

  autonomiePageViewed: (source: "public_landing" | "dashboard" | "register") =>
    trackEvent("autonomie_page_viewed", { source }),

  /** Alias legacy — conservé pour ne pas casser les rapports existants */
  autonomyPageViewed: (source: "public_landing" | "dashboard" | "register") =>
    trackEvent("autonomy_page_viewed", { source }),

  estimationSubmitted: (ville: string, pieces: number, surface: number) =>
    trackEvent("estimation_submitted", { ville, pieces, surface }),

  waitlistJoined: (role: string, source: string = "bientot_page") =>
    trackEvent("waitlist_joined", { role, source }),

  // ── B. INSCRIPTION ─────────────────────────────────────────────────────────

  signupStarted: (referrer?: string | null) =>
    trackEvent("signup_started", { referrer }),

  signupRoleSelected: (role: string) =>
    trackEvent("signup_role_selected", { role }),

  signupCompleted: (role: string, method: "email" | "google" = "email") =>
    trackEvent("signup_completed", { role, method }),

  onboardingStepCompleted: (stepName: string, stepNumber: number) =>
    trackEvent("onboarding_step_completed", { step_name: stepName, step_number: stepNumber }),

  onboardingAbandoned: (lastStep: string) =>
    trackEvent("onboarding_abandoned", { last_step: lastStep }),

  onboardingCompleted: (totalSteps: number, role: string) =>
    trackEvent("onboarding_completed", { total_steps: totalSteps, role }),

  // ── C. ACTIVATION ──────────────────────────────────────────────────────────

  propertyCreated: (id: string, type: string, city: string) => {
    trackEvent("property_created", { id, type, city });
    trackFirst("first_property_added", { id, type, city });
  },

  propertyUpdated: (id: string) =>
    trackEvent("property_updated", { id }),

  listingPublished: (listingId: string, transactionType: string) => {
    trackEvent("bien_publie", { listing_id: listingId, transaction_type: transactionType });
    trackFirst("first_listing_published", { listing_id: listingId, transaction_type: transactionType });
  },

  /** Nom legacy, conservé pour les rapports en place. Préférer listingPublished. */
  bienPublie: (listingId: string, transactionType: string) =>
    Analytics.listingPublished(listingId, transactionType),

  tenantApplicationReceived: (candidatureId: string, listingId: string) => {
    trackEvent("tenant_application_received", { candidature_id: candidatureId, listing_id: listingId });
    trackFirst("first_tenant_application", { candidature_id: candidatureId });
  },

  contractCreated: (id: string, type: string) => {
    trackEvent("contract_signed", { id, type });
    trackFirst("first_contract_created", { id, type });
  },

  /** Alias — utilisé dans l'UI des baux (création effective, pas juste signature). */
  contractSigned: (id: string, type: string) => Analytics.contractCreated(id, type),

  qrInvoiceGenerated: (id: string, amount: number) => {
    trackEvent("qr_invoice_generated", { id, amount });
    trackFirst("first_qr_invoice_generated", { id, amount });
  },

  rentCollected: (id: string, amount: number, type: string = "rent") => {
    trackEvent("payment_received", { id, amount, type });
    trackFirst("first_rent_collected", { id, amount });
  },

  paymentLate: (id: string, amount: number) =>
    trackEvent("payment_late", { id, amount }),

  sphereMessageSent: (topic?: string) => {
    trackEvent("sphere_ia_message_sent", { topic });
    trackFirst("sphere_ia_first_message", { topic });
  },

  // ── D. CONVERSION (paiement) ───────────────────────────────────────────────

  planUpgradeViewed: (currentPlan: string | null) =>
    trackEvent("plan_upgrade_viewed", { current_plan: currentPlan }),

  planUpgradeStarted: (fromPlan: string | null, toPlan: string, planPrice: number) =>
    trackEvent("plan_upgrade_started", { from_plan: fromPlan, to_plan: toPlan, plan_price: planPrice }),

  planUpgradeCompleted: (fromPlan: string | null, toPlan: string, planPrice: number) =>
    trackEvent("plan_upgrade_completed", { from_plan: fromPlan, to_plan: toPlan, plan_price: planPrice }),

  planUpgradeFailed: (toPlan: string, errorCode: string, errorMessage?: string) =>
    trackEvent("plan_upgrade_failed", { to_plan: toPlan, error_code: errorCode, error_message: errorMessage }),

  autonomyComparisonCalculated: (nbBiens: number, loyerMoyen: number, economie: number) =>
    trackEvent("autonomy_comparison_calculated", {
      nb_biens: nbBiens,
      loyer_moyen: loyerMoyen,
      computed_savings: economie,
    }),

  autonomySubscriptionStarted: (stage: "account_created" | "checkout_opened") =>
    trackEvent("autonomy_subscription_started", { stage }),

  autonomySubscriptionActivated: (previousPlan: string | null) =>
    trackEvent("autonomy_subscription_activated", { previous_plan: previousPlan }),

  // ── E. RÉTENTION & ENGAGEMENT ──────────────────────────────────────────────
  // weekly_active / monthly_active = rollup automatique PostHog (aucun code).

  documentGenerated: (docType: string) =>
    trackEvent("document_generated", { doc_type: docType }),

  aiUsed: (feature: "listing" | "tenant_score" | "quote" | "chat" | "anomaly", context?: string) =>
    trackEvent("ai_used", { feature, context }),

  artisanContacted: (artisanId: string, missionId?: string | null) =>
    trackEvent("artisan_contacted", { artisan_id: artisanId, mission_id: missionId ?? null }),

  // ── Marketplace artisans (M1 — 2026-04-20) ───────────────────────────────
  artisanSignupCompleted: (canton: string, specialties: string[]) =>
    trackEvent("artisan_signup_completed", { canton, specialties }),
  artisanSubscriptionActivated: (plan: "artisan_free_early" | "artisan_verified", canton: string, isFoundingMember: boolean) =>
    trackEvent("artisan_subscription_activated", { plan, canton, is_founding_member: isFoundingMember }),
  artisanMissionReceived: (rfqId: string, category: string) =>
    trackEvent("artisan_mission_received", { rfq_id: rfqId, category }),
  artisanQuoteSent: (rfqId: string, amountChf: number) =>
    trackEvent("artisan_quote_sent", { rfq_id: rfqId, amount_chf: amountChf }),
  artisanInterventionCompleted: (interventionId: string, grossChf: number, commissionChf: number) =>
    trackEvent("artisan_intervention_completed", {
      intervention_id: interventionId,
      gross_chf: grossChf,
      commission_chf: commissionChf,
    }),

  interventionCreated: (id: string, category: string, urgency?: string) =>
    trackEvent("intervention_created", { id, category, urgency }),

  missionCreated: (id: string, category: string) =>
    trackEvent("mission_created", { id, category }),

  rfqCreated: (id: string, category: string, urgency: string) =>
    trackEvent("rfq_created", { id, category, urgency }),

  quoteAccepted: (id: string, amount: number) =>
    trackEvent("quote_accepted", { id, amount }),

  autonomyVerificationUsed: (remaining: number) =>
    trackEvent("autonomy_verification_used", { remaining }),

  autonomyOpenerMissionUsed: (remaining: number) =>
    trackEvent("autonomy_opener_mission_used", { remaining }),

  // ── F. EXPANSION ───────────────────────────────────────────────────────────

  diffusionPlatformActivated: (platformName: string) =>
    trackEvent("diffusion_platform_activated", { platform_name: platformName }),

  partnerLeadSent: (partnerName: string, vertical: string) =>
    trackEvent("partner_lead_sent", { partner_name: partnerName, vertical }),

  partnerLeadConverted: (partnerName: string, amount: number) =>
    trackEvent("partner_lead_converted", { partner_name: partnerName, amount }),

  featureUsageLimitHit: (feature: string, currentPlan: string | null) =>
    trackEvent("feature_usage_limit_hit", { feature, current_plan: currentPlan }),

  // ── G. CHURN RISK ──────────────────────────────────────────────────────────

  subscriptionPaused: (plan: string, reason?: string | null) =>
    trackEvent("subscription_paused", { plan, reason: reason ?? null }),

  subscriptionCancelled: (planBefore: string, reason?: string | null) =>
    trackEvent("subscription_cancelled", { plan_before: planBefore, reason: reason ?? null }),

  autonomyCancelled: (reason: string | null, monthsActive: number | null = null) =>
    trackEvent("autonomy_cancelled", { reason, months_active: monthsActive }),

  // ── Navigation / Auth ──────────────────────────────────────────────────────

  pageViewed: (path: string) =>
    trackEvent("page_viewed", { path }),

  userSignedIn: (role: string) =>
    trackEvent("user_signed_in", { role }),

  userSignedOut: () =>
    trackEvent("user_signed_out"),

  // ── Marketplace (biens) ────────────────────────────────────────────────────

  listingViewed: (listingId: string, prix: number | null, ville: string) =>
    trackEvent("listing_viewed", { listing_id: listingId, prix, ville }),

  swipeRight: (listingId: string) =>
    trackEvent("swipe_right", { listing_id: listingId }),

  swipeLeft: (listingId: string) =>
    trackEvent("swipe_left", { listing_id: listingId }),

  candidatureSubmitted: (listingId: string) =>
    trackEvent("candidature_submitted", { listing_id: listingId }),

  interetExprime: (listingId: string) =>
    trackEvent("interet_exprime", { listing_id: listingId }),

  // ── Dossier locataire (pivot CHF 45 owner — 2026-04-20) ───────────────────

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
