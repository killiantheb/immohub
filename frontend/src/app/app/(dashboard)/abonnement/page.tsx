"use client";

import { Suspense, useState, useCallback } from "react";
import { Check, Sparkles, Zap, Building2, Crown, Shield, Loader2, X, Star, ArrowRight } from "lucide-react";
import { useUser } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PLANS_PROPRIO, PLANS_AGENCE, PLAN_AUTONOMIE, LEGACY_PLAN_MAP } from "@/lib/plans.config";
import type { Plan } from "@/lib/plans.config";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { C } from "@/lib/design-tokens";
import { Analytics } from "@/lib/analytics";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""
);

const PLAN_META: Record<string, { icon: React.ReactNode; color: string }> = {
  gratuit:     { icon: <Sparkles size={20} />,   color: C.text2 },
  starter:     { icon: <Star size={20} />,       color: C.prussian },
  pro:         { icon: <Zap size={20} />,        color: C.prussian },
  proprio_pro: { icon: <Zap size={20} />,        color: C.prussian },
  autonomie:   { icon: <Sparkles size={20} />,   color: C.gold },
  agence:      { icon: <Building2 size={20} />,  color: C.text },
  enterprise:  { icon: <Crown size={20} />,      color: C.gold },
  invite:      { icon: <Shield size={20} />,     color: C.text2 },
};

const FEATURES_COMPARE_PROPRIO = [
  { name: "Biens gérés",              gratuit: "1",       starter: "1–3",   pro: "4–10",     proprio_pro: "11–50" },
  { name: "Documents IA",             gratuit: "—",       starter: "Illimité", pro: "Illimité", proprio_pro: "Illimité" },
  { name: "Chat Althy",               gratuit: "20/mois", starter: "Illimité", pro: "Illimité", proprio_pro: "Illimité" },
  { name: "QR-factures loyers",       gratuit: "Basique", starter: "✓",     pro: "✓",        proprio_pro: "✓" },
  { name: "Relances auto (email/WA)", gratuit: "—",       starter: "✓",     pro: "✓",        proprio_pro: "✓" },
  { name: "Rapports fiscaux",         gratuit: "—",       starter: "—",     pro: "✓",        proprio_pro: "✓" },
  { name: "Comptabilité avancée",     gratuit: "—",       starter: "—",     pro: "—",        proprio_pro: "✓" },
  { name: "Support prioritaire",      gratuit: "—",       starter: "—",     pro: "—",        proprio_pro: "✓" },
];

const FEATURES_COMPARE_AGENCE = [
  { name: "Biens gérés",       agence: "Illimités",          enterprise: "Illimités" },
  { name: "Multi-agents",      agence: "2–50",               enterprise: "Illimité" },
  { name: "CRM",               agence: "✓",                  enterprise: "✓" },
  { name: "Portail proprio",   agence: "✓",                  enterprise: "✓" },
  { name: "White-label",       agence: "—",                  enterprise: "✓" },
  { name: "API B2B",           agence: "—",                  enterprise: "✓" },
  { name: "SSO + SLA 99.9%",   agence: "—",                  enterprise: "✓" },
  { name: "Account manager",   agence: "—",                  enterprise: "✓" },
];

interface SubscriptionData {
  plan: string;
  status: string;
  current_period_end: string | null;
  agency_name?: string | null;
}

// ── Formulaire de paiement inline (Payment Element) ──────────────────────────

interface CheckoutFormProps {
  planId: string;
  planNom: string;
  clientSecret: string;
  onSuccess: () => void;
  onCancel: () => void;
}

function CheckoutForm({ planId, planNom, clientSecret, onSuccess, onCancel }: CheckoutFormProps) {
  void planId; void clientSecret;
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setErrorMsg(null);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/app/abonnement?checkout=success`,
      },
    });

    if (error) {
      setErrorMsg(error.message ?? "Erreur lors du paiement");
      setProcessing(false);
    } else {
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.text }}>
            Abonnement {planNom}
          </h3>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: C.text3 }}>
            Carte · TWINT · Apple Pay · Google Pay
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          style={{ background: "none", border: "none", cursor: "pointer", color: C.text3, padding: 4 }}
        >
          <X size={20} />
        </button>
      </div>

      <PaymentElement
        options={{
          layout: "tabs",
          wallets: { applePay: "auto", googlePay: "auto" },
        }}
      />

      {errorMsg && (
        <div style={{
          padding: "10px 14px", borderRadius: 8, fontSize: 13, color: "var(--althy-red)",
          background: "var(--althy-red-bg)", border: "1px solid rgba(185,28,28,0.2)",
        }}>
          {errorMsg}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || processing}
        style={{
          padding: "12px 0", borderRadius: 10, border: "none",
          background: C.prussian, color: "#fff",
          fontSize: 14, fontWeight: 700, cursor: processing ? "not-allowed" : "pointer",
          opacity: processing ? 0.7 : 1,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}
      >
        {processing && <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />}
        {processing ? "Traitement…" : `Souscrire au plan ${planNom}`}
      </button>

      <p style={{ textAlign: "center", fontSize: 11, color: C.text3, margin: 0 }}>
        Paiement sécurisé par Stripe · Résiliable à tout moment
      </p>
    </form>
  );
}

function StripeCheckout({ clientSecret, planId, planNom, onSuccess, onCancel }: {
  clientSecret: string; planId: string; planNom: string; onSuccess: () => void; onCancel: () => void;
}) {
  const appearance = {
    theme: "stripe" as const,
    variables: {
      colorPrimary: "#0F2E4C",
      colorBackground: "#FFFFFF",
      colorText: "#2B2B2B",
      colorDanger: "#B91C1C",
      borderRadius: "8px",
      fontFamily: "var(--font-sans), system-ui, sans-serif",
    },
  };

  return (
    <div style={{
      backgroundColor: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 16, padding: 28,
      boxShadow: "0 8px 32px rgba(0,0,0,0.10)",
    }}>
      <Elements
        stripe={stripePromise}
        options={{ clientSecret, appearance, locale: "fr" }}
      >
        <CheckoutForm
          planId={planId}
          planNom={planNom}
          clientSecret={clientSecret}
          onSuccess={onSuccess}
          onCancel={onCancel}
        />
      </Elements>
    </div>
  );
}

// ── Plan card ────────────────────────────────────────────────────────────────

function PlanCard({ plan, annual, isCurrent, subscribing, checkoutPlan, onSubscribe }: {
  plan: Plan; annual: boolean; isCurrent: boolean;
  subscribing: string | null; checkoutPlan: { id: string } | null;
  onSubscribe: (id: string, nom: string) => void;
}) {
  const prix = annual && plan.prixAnnuel ? plan.prixAnnuel : plan.prix;
  const isSelected = checkoutPlan?.id === plan.id;
  const meta = PLAN_META[plan.id] ?? { icon: <Sparkles size={20} />, color: C.text2 };
  const isContactPlan = plan.id === "agence" || plan.id === "enterprise";
  const isGold = plan.id === "autonomie" || plan.id === "enterprise";
  const accent = isGold ? C.gold : C.prussian;

  return (
    <div style={{
      backgroundColor: C.surface,
      border: isSelected
        ? `2px solid ${accent}`
        : plan.vedette
          ? `2px solid ${accent}`
          : `1px solid ${C.border}`,
      borderRadius: 20, padding: 24, position: "relative",
      boxShadow: plan.vedette
        ? (isGold ? "0 8px 32px rgba(201,169,97,0.20)" : "0 8px 32px rgba(15,46,76,0.15)")
        : C.shadow,
    }}>
      {plan.vedette && (
        <div style={{
          position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
          backgroundColor: accent, color: "#fff",
          padding: "3px 12px", borderRadius: 20,
          fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
          textTransform: "uppercase", letterSpacing: "0.04em",
        }}>
          {plan.badge ?? "Recommandé"}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, color: meta.color }}>
        {meta.icon}
        <span style={{ fontWeight: 700, fontSize: 16 }}>{plan.nom}</span>
      </div>

      <p style={{ margin: "0 0 16px", fontSize: 12, color: C.text3, lineHeight: 1.4 }}>
        {plan.description}
      </p>

      <div style={{ marginBottom: 20 }}>
        <span style={{ fontSize: 36, fontWeight: 800, color: C.text }}>
          {prix > 0 ? `CHF ${prix}` : "Gratuit"}
        </span>
        <span style={{ fontSize: 12, color: C.text3, marginLeft: 4 }}>
          {annual && plan.prixAnnuel ? "/mois · facturé annuellement" : plan.periode}
        </span>
      </div>

      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 20px", display: "flex", flexDirection: "column", gap: 8 }}>
        {plan.fonctionnalites.map(f => (
          <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: C.text2 }}>
            <Check size={14} color={accent} style={{ flexShrink: 0, marginTop: 2 }} />
            {f}
          </li>
        ))}
      </ul>

      <button
        disabled={isCurrent || subscribing === plan.id || !!checkoutPlan}
        onClick={() => {
          if (isCurrent || plan.id === "gratuit" || !!checkoutPlan) return;
          if (isContactPlan) {
            window.location.href = `/contact?source=${plan.id}`;
            return;
          }
          onSubscribe(plan.id, plan.nom);
        }}
        style={{
          width: "100%", padding: "10px 0",
          backgroundColor: isCurrent ? C.surface2 : (isSelected || plan.vedette) ? accent : C.surface2,
          color: isCurrent ? C.text3 : (isSelected || plan.vedette) ? "#fff" : C.text,
          border: isCurrent ? `1px solid ${C.border}` : (isSelected || plan.vedette) ? "none" : `1px solid ${C.border}`,
          borderRadius: 10, fontSize: 13, fontWeight: 600,
          cursor: (isCurrent || plan.id === "gratuit" || !!checkoutPlan) ? "default" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          opacity: subscribing && subscribing !== plan.id ? 0.6 : 1,
        }}
      >
        {subscribing === plan.id
          ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Chargement…</>
          : isCurrent ? "Plan actuel" : plan.cta}
      </button>
      {!isCurrent && plan.note && (
        <p style={{ textAlign: "center", fontSize: 11, color: C.text3, margin: "6px 0 0" }}>{plan.note}</p>
      )}
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

function AbonnementContent() {
  const { data: profile } = useUser();
  const [annual, setAnnual] = useState(false);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [checkoutPlan, setCheckoutPlan] = useState<{ id: string; nom: string; clientSecret: string } | null>(null);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);

  const { data: subscription, refetch: refetchSub } = useQuery<SubscriptionData>({
    queryKey: ["subscription"],
    queryFn: () => api.get("/stripe/subscription").then(r => r.data),
    staleTime: 60_000,
  });

  // Normalise legacy plan names
  const rawPlan = subscription?.plan ?? "gratuit";
  const currentPlan = LEGACY_PLAN_MAP[rawPlan] ?? rawPlan;
  const subStatus = subscription?.status ?? "no_subscription";

  const isAgence = profile?.role === "agence";
  const isInvited = currentPlan === "invite";
  const agencyName = subscription?.agency_name ?? "votre agence";

  const handleSubscribe = useCallback(async (planId: string, planNom: string) => {
    if (planId === "gratuit") return;
    setSubscribing(planId);
    try {
      const res = await api.post("/stripe/create-subscription-intent", { plan: planId });
      if (planId === "autonomie") {
        Analytics.autonomySubscriptionStarted("checkout_opened");
      }
      setCheckoutPlan({ id: planId, nom: planNom, clientSecret: res.data.client_secret });
    } catch {
      // silencieux
    } finally {
      setSubscribing(null);
    }
  }, []);

  const handleSuccess = useCallback(() => {
    setCheckoutSuccess(true);
    if (checkoutPlan?.id === "autonomie") {
      Analytics.autonomySubscriptionActivated(currentPlan ?? null);
    }
    setCheckoutPlan(null);
    refetchSub();
  }, [refetchSub, checkoutPlan, currentPlan]);

  // Plans à afficher : 5 cards proprio (gratuit + 3 paliers + autonomie) OU 2 cards agence
  const proprioCards: Plan[] = [...PLANS_PROPRIO, PLAN_AUTONOMIE];

  return (
    <div style={{ padding: "32px 24px", maxWidth: 1280, margin: "0 auto" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Succès paiement */}
      {checkoutSuccess && (
        <div style={{
          marginBottom: 24, padding: "14px 20px", borderRadius: 12,
          background: "var(--althy-green-bg)", border: "1px solid rgba(46,94,34,0.2)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <Check size={18} color="var(--althy-green)" />
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--althy-green)" }}>
            Abonnement activé — bienvenue dans Althy !
          </p>
          <button
            onClick={() => setCheckoutSuccess(false)}
            style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--althy-green)" }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: C.text, margin: "0 0 8px", letterSpacing: "-0.02em" }}>
          Mon abonnement
        </h1>
        <p style={{ color: C.text3, fontSize: 14, margin: 0 }}>
          {isAgence
            ? "Pour votre agence : à partir de CHF 49/agent/mois — biens illimités."
            : "Gérez vos biens sans agence — gratuit pour 1 bien, à partir de CHF 14/mois."}
        </p>
      </div>

      {/* Banner spécial : compte invité (A6) */}
      {isInvited && (
        <div style={{
          marginBottom: 28, padding: "18px 22px", borderRadius: 16,
          background: `linear-gradient(135deg, ${C.goldBg}, rgba(201,169,97,0.18))`,
          border: `1px solid ${C.gold}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 16,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 280 }}>
            <Sparkles size={22} color={C.gold} />
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.text }}>
                Vous êtes invité par {agencyName}
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: C.text2, lineHeight: 1.5 }}>
                Passez en <strong>Althy Autonomie</strong> pour CHF 39/mois et reprenez la main sur vos biens.
                Économisez jusqu'à <strong>CHF 1 600/an</strong> vs une régie classique.
              </p>
            </div>
          </div>
          <button
            onClick={() => handleSubscribe("autonomie", "Althy Autonomie")}
            disabled={subscribing === "autonomie"}
            style={{
              padding: "10px 18px", borderRadius: 10, border: "none",
              background: C.gold, color: "#fff",
              fontSize: 13, fontWeight: 700, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
            }}
          >
            {subscribing === "autonomie"
              ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Chargement…</>
              : <>Passer à Althy Autonomie <ArrowRight size={14} /></>}
          </button>
        </div>
      )}

      {/* Current plan banner */}
      <div style={{
        backgroundColor: C.prussianBg,
        border: "1px solid rgba(15,46,76,0.22)",
        borderRadius: 14, padding: "14px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 32, flexWrap: "wrap", gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Shield size={18} color={C.prussian} />
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.text }}>
              Plan actuel : <span style={{ color: C.prussian, textTransform: "capitalize" }}>{currentPlan}</span>
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: C.text3 }}>
              {subscription?.current_period_end
                ? `Renouvellement le ${new Date(subscription.current_period_end).toLocaleDateString("fr-CH")}`
                : "30 jours d'essai gratuit · Carte requise à l'expiration"}
            </p>
          </div>
        </div>
        <div style={{
          padding: "6px 14px", borderRadius: 20,
          backgroundColor: subStatus === "active" ? "var(--althy-green-bg)" : C.surface2,
          border: subStatus === "active" ? "1px solid rgba(46,94,34,0.2)" : `1px solid ${C.border}`,
          fontSize: 12, fontWeight: 600, color: subStatus === "active" ? "var(--althy-green)" : C.text3,
        }}>
          {subStatus === "active" ? "Actif" : subStatus === "no_subscription" ? "Essai gratuit" : subStatus}
        </div>
      </div>

      {/* Formulaire paiement inline */}
      {checkoutPlan && (
        <div style={{ marginBottom: 40 }}>
          <StripeCheckout
            clientSecret={checkoutPlan.clientSecret}
            planId={checkoutPlan.id}
            planNom={checkoutPlan.nom}
            onSuccess={handleSuccess}
            onCancel={() => setCheckoutPlan(null)}
          />
        </div>
      )}

      {/* Annual toggle */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 32 }}>
        <span style={{ fontSize: 13, color: annual ? C.text3 : C.text, fontWeight: annual ? 400 : 600 }}>Mensuel</span>
        <button
          onClick={() => setAnnual(v => !v)}
          style={{
            width: 44, height: 24, borderRadius: 12, border: "none",
            backgroundColor: annual ? C.prussian : C.surface2,
            cursor: "pointer", position: "relative", transition: "background 0.2s",
          }}
        >
          <div style={{
            position: "absolute", top: 3, left: annual ? 22 : 3,
            width: 18, height: 18, borderRadius: "50%",
            backgroundColor: "#fff",
            transition: "left 0.2s",
            boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
          }} />
        </button>
        <span style={{ fontSize: 13, color: annual ? C.text : C.text3, fontWeight: annual ? 600 : 400 }}>
          Annuel <span style={{ color: "var(--althy-green)", fontWeight: 700 }}>−15%</span>
        </span>
      </div>

      {/* Section proprio (5 plans) */}
      {!isAgence && (
        <>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: "0 0 16px" }}>
            Pour les propriétaires
          </h2>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 18, marginBottom: 48,
          }}>
            {proprioCards.map(plan => (
              <PlanCard
                key={plan.id}
                plan={plan}
                annual={annual}
                isCurrent={plan.id === currentPlan}
                subscribing={subscribing}
                checkoutPlan={checkoutPlan}
                onSubscribe={handleSubscribe}
              />
            ))}
          </div>

          {/* Comparison table proprio */}
          <div style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, overflow: "hidden", marginBottom: 32 }}>
            <div style={{ padding: "20px 24px", borderBottom: `1px solid ${C.border}` }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.text }}>Comparaison propriétaire</h2>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: C.surface2 }}>
                    <th style={{ padding: "12px 20px", textAlign: "left", fontSize: 12, fontWeight: 600, color: C.text3, textTransform: "uppercase", letterSpacing: "0.06em" }}>Fonctionnalité</th>
                    {["Gratuit", "Particulier", "Actif", "Professionnel"].map(h => (
                      <th key={h} style={{ padding: "12px 16px", textAlign: "center", fontSize: 12, fontWeight: 600, color: h === "Actif" ? C.prussian : C.text3, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {FEATURES_COMPARE_PROPRIO.map((row, i) => {
                    const cols = [row.gratuit, row.starter, row.pro, row.proprio_pro];
                    return (
                      <tr key={row.name} style={{ borderTop: `1px solid ${C.border}`, backgroundColor: i % 2 === 0 ? "transparent" : C.surface2 }}>
                        <td style={{ padding: "10px 20px", fontSize: 13, color: C.text2 }}>{row.name}</td>
                        {cols.map((val, j) => (
                          <td key={j} style={{ padding: "10px 16px", textAlign: "center", fontSize: 13, color: val === "✓" ? "var(--althy-green)" : val === "—" ? C.text3 : C.text, fontWeight: val === "✓" ? 600 : 400 }}>
                            {val}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Section agence (2 plans) */}
      {isAgence && (
        <>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: "0 0 16px" }}>
            Pour les agences
          </h2>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 20, marginBottom: 48,
          }}>
            {PLANS_AGENCE.map(plan => (
              <PlanCard
                key={plan.id}
                plan={plan}
                annual={annual}
                isCurrent={plan.id === currentPlan}
                subscribing={subscribing}
                checkoutPlan={checkoutPlan}
                onSubscribe={handleSubscribe}
              />
            ))}
          </div>

          {/* Comparison table agence */}
          <div style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, overflow: "hidden", marginBottom: 32 }}>
            <div style={{ padding: "20px 24px", borderBottom: `1px solid ${C.border}` }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.text }}>Comparaison agence</h2>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: C.surface2 }}>
                    <th style={{ padding: "12px 20px", textAlign: "left", fontSize: 12, fontWeight: 600, color: C.text3, textTransform: "uppercase", letterSpacing: "0.06em" }}>Fonctionnalité</th>
                    {["Agence", "Enterprise"].map(h => (
                      <th key={h} style={{ padding: "12px 16px", textAlign: "center", fontSize: 12, fontWeight: 600, color: h === "Agence" ? C.prussian : C.gold, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {FEATURES_COMPARE_AGENCE.map((row, i) => {
                    const cols = [row.agence, row.enterprise];
                    return (
                      <tr key={row.name} style={{ borderTop: `1px solid ${C.border}`, backgroundColor: i % 2 === 0 ? "transparent" : C.surface2 }}>
                        <td style={{ padding: "10px 20px", fontSize: 13, color: C.text2 }}>{row.name}</td>
                        {cols.map((val, j) => (
                          <td key={j} style={{ padding: "10px 16px", textAlign: "center", fontSize: 13, color: val === "✓" ? "var(--althy-green)" : val === "—" ? C.text3 : C.text, fontWeight: val === "✓" ? 600 : 400 }}>
                            {val}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Savings */}
      <div style={{
        marginTop: 24, padding: 24, borderRadius: 16,
        background: "linear-gradient(135deg, rgba(15,46,76,0.06), rgba(15,46,76,0.12))",
        border: "1px solid rgba(15,46,76,0.22)",
        display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap",
      }}>
        <div style={{ fontSize: 32 }}>💰</div>
        <div>
          <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: C.text }}>
            {isAgence
              ? "2× moins cher que les outils d'agence classiques"
              : "Économisez CHF 150+/mois vs une régie"}
          </p>
          <p style={{ margin: 0, fontSize: 13, color: C.text3 }}>
            {isAgence
              ? "Les outils classiques facturent CHF 80–150/agent/mois. Althy démarre à CHF 49 avec l'IA incluse."
              : "Une régie facture 4–8% du loyer. Pour un loyer moyen CHF 2 300/mois, c'est CHF 92–184/mois. Althy Autonomie : CHF 39/mois + 3% transit (vs 4-8% en régie)."}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AbonnementPage() {
  return (
    <Suspense>
      <AbonnementContent />
    </Suspense>
  );
}
