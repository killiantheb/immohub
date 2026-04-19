"use client";

import { Suspense, useState, useCallback } from "react";
import { Check, Sparkles, Zap, Building2, Crown, Shield, Loader2, X, Star } from "lucide-react";
import { useUser } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PLANS_PROPRIO, PLANS_AGENCE, LEGACY_PLAN_MAP } from "@/lib/plans.config";
import type { Plan } from "@/lib/plans.config";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { C } from "@/lib/design-tokens";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""
);

const PLAN_META: Record<string, { icon: React.ReactNode; color: string }> = {
  gratuit:        { icon: <Sparkles size={20} />, color: C.text2 },
  starter:        { icon: <Star size={20} />,     color: C.orange },
  pro:            { icon: <Zap size={20} />,      color: C.orange },
  agence:         { icon: <Building2 size={20} />, color: C.text },
  agence_premium: { icon: <Crown size={20} />,    color: C.text },
};

const FEATURES_COMPARE = [
  { name: "Biens gérés",                 gratuit: "1",    starter: "1",        pro: "2–5",      agence: "30",       agence_premium: "Illimité" },
  { name: "Documents IA",                gratuit: "—",    starter: "Illimité", pro: "Illimité", agence: "Illimité", agence_premium: "Illimité" },
  { name: "Chat Althy",                  gratuit: "20/mois", starter: "Illimité", pro: "Illimité", agence: "Illimité", agence_premium: "Illimité" },
  { name: "QR-factures loyers",          gratuit: "Basique", starter: "✓",     pro: "✓",        agence: "✓",        agence_premium: "✓" },
  { name: "Relances auto (email/WA)",    gratuit: "—",    starter: "✓",        pro: "✓",        agence: "✓",        agence_premium: "✓" },
  { name: "Rapports fiscaux",            gratuit: "—",    starter: "—",        pro: "✓",        agence: "✓",        agence_premium: "✓" },
  { name: "Portail proprio",             gratuit: "—",    starter: "—",        pro: "—",        agence: "—",        agence_premium: "✓" },
  { name: "API B2B",                     gratuit: "—",    starter: "—",        pro: "—",        agence: "—",        agence_premium: "✓" },
  { name: "Utilisateurs",                gratuit: "1",    starter: "1",        pro: "1",        agence: "2–50",     agence_premium: "2–50" },
];

interface SubscriptionData {
  plan: string;
  status: string;
  current_period_end: string | null;
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
          background: C.orange, color: "#fff",
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
      colorPrimary: "#E8602C",
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
  const isContactPlan = plan.id === "agence" || plan.id === "agence_premium";

  return (
    <div style={{
      backgroundColor: C.surface,
      border: isSelected
        ? `2px solid ${C.orange}`
        : plan.vedette
          ? `2px solid ${C.orange}`
          : `1px solid ${C.border}`,
      borderRadius: 20, padding: 24, position: "relative",
      boxShadow: plan.vedette ? "0 8px 32px rgba(232,96,44,0.15)" : C.shadow,
    }}>
      {plan.vedette && (
        <div style={{
          position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
          backgroundColor: C.orange, color: "#fff",
          padding: "3px 12px", borderRadius: 20,
          fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
        }}>
          RECOMMAND&Eacute;
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, color: meta.color }}>
        {meta.icon}
        <span style={{ fontWeight: 700, fontSize: 16 }}>{plan.nom}</span>
      </div>

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
            <Check size={14} color={C.orange} style={{ flexShrink: 0, marginTop: 2 }} />
            {f}
          </li>
        ))}
      </ul>

      <button
        disabled={isCurrent || subscribing === plan.id || !!checkoutPlan}
        onClick={() => {
          if (isCurrent || plan.id === "gratuit" || !!checkoutPlan) return;
          if (isContactPlan) {
            window.location.href = "/contact?source=agence";
            return;
          }
          onSubscribe(plan.id, plan.nom);
        }}
        style={{
          width: "100%", padding: "10px 0",
          backgroundColor: isCurrent ? C.surface2 : (isSelected || plan.vedette) ? C.orange : C.surface2,
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

  const handleSubscribe = useCallback(async (planId: string, planNom: string) => {
    if (planId === "gratuit") return;
    setSubscribing(planId);
    try {
      const res = await api.post("/stripe/create-subscription-intent", { plan: planId });
      setCheckoutPlan({ id: planId, nom: planNom, clientSecret: res.data.client_secret });
    } catch {
      // silencieux
    } finally {
      setSubscribing(null);
    }
  }, []);

  const handleSuccess = useCallback(() => {
    setCheckoutSuccess(true);
    setCheckoutPlan(null);
    refetchSub();
  }, [refetchSub]);

  const plans = isAgence ? PLANS_AGENCE : PLANS_PROPRIO;

  return (
    <div style={{ padding: "32px 24px", maxWidth: 1100, margin: "0 auto" }}>
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
      <div style={{ marginBottom: 40 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: C.text, margin: "0 0 8px", letterSpacing: "-0.02em" }}>
          Mon abonnement
        </h1>
        <p style={{ color: C.text3, fontSize: 14, margin: 0 }}>
          {isAgence
            ? "Gérez votre agence avec Althy — à partir de CHF 79/agent/mois."
            : "Gérez vos biens sans agence — gratuit pour 1 bien, CHF 14/mois pour tout débloquer."}
        </p>
      </div>

      {/* Current plan banner */}
      <div style={{
        backgroundColor: C.orangeBg,
        border: "1px solid rgba(232,96,44,0.22)",
        borderRadius: 14, padding: "14px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 32, flexWrap: "wrap", gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Shield size={18} color={C.orange} />
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.text }}>
              Plan actuel : <span style={{ color: C.orange, textTransform: "capitalize" }}>{currentPlan}</span>
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
            backgroundColor: annual ? C.orange : C.surface2,
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
          Annuel <span style={{ color: "var(--althy-green)", fontWeight: 700 }}>−20%</span>
        </span>
      </div>

      {/* Plan cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: `repeat(${plans.length}, minmax(220px, 1fr))`,
        gap: 20, marginBottom: 48,
      }}>
        {plans.map(plan => (
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

      {/* Comparison table */}
      <div style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, overflow: "hidden" }}>
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${C.border}` }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.text }}>Comparaison détaillée</h2>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: C.surface2 }}>
                <th style={{ padding: "12px 20px", textAlign: "left", fontSize: 12, fontWeight: 600, color: C.text3, textTransform: "uppercase", letterSpacing: "0.06em" }}>Fonctionnalité</th>
                {(isAgence
                  ? ["Agence Standard", "Agence Premium"]
                  : ["Gratuit", "Starter", "Pro"]
                ).map(h => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "center", fontSize: 12, fontWeight: 600, color: h === "Starter" || h === "Agence Standard" ? C.orange : C.text3, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURES_COMPARE.map((row, i) => {
                const cols = isAgence
                  ? [row.agence, row.agence_premium]
                  : [row.gratuit, row.starter, row.pro];
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

      {/* Savings */}
      <div style={{
        marginTop: 32, padding: 24, borderRadius: 16,
        background: "linear-gradient(135deg, rgba(232,96,44,0.06), rgba(232,96,44,0.12))",
        border: "1px solid rgba(232,96,44,0.22)",
        display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap",
      }}>
        <div style={{ fontSize: 32 }}>💰</div>
        <div>
          <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: C.text }}>
            {isAgence
              ? "2x moins cher qu'Immomig"
              : "Économisez CHF 150+/mois vs une régie"}
          </p>
          <p style={{ margin: 0, fontSize: 13, color: C.text3 }}>
            {isAgence
              ? "Les outils classiques facturent CHF 80–150/agent/mois. Althy démarre à CHF 79 avec l'IA incluse."
              : "Une régie facture 8–12% du loyer. Pour un loyer moyen CHF 1 800/mois, c'est CHF 180–216/mois. Althy Starter : CHF 14/mois."}
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
