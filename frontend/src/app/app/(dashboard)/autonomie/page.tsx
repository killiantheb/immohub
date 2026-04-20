"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api";
import { useUser } from "@/lib/auth";
import { C } from "@/lib/design-tokens";
import { trackEvent } from "@/lib/analytics";
import { ComparisonCalculator } from "@/components/autonomie/ComparisonCalculator";
import { InclusionsGrid } from "@/components/autonomie/InclusionsGrid";
import { UsageTracker, type AutonomyUsage } from "@/components/autonomie/UsageTracker";
import { SupportPanel } from "@/components/autonomie/SupportPanel";

/**
 * Dashboard Autonomie — dual state.
 * - plan_id === "autonomie"  → dashboard complet (usage, support, CTA actions)
 * - plan_id === "invite"     → pitch spécial "quittez votre agence"
 * - autre                    → pitch standard + CTA souscription
 */

export default function DashboardAutonomiePage() {
  const { data: profile } = useUser();
  const planId = profile?.plan_id ?? null;

  const isSubscribed = planId === "autonomie";
  const isInvite = planId === "invite";

  const usageQuery = useQuery<AutonomyUsage>({
    queryKey: ["autonomie", "usage"],
    queryFn: async () => {
      const { data } = await api.get<AutonomyUsage>("/autonomie/usage");
      return data;
    },
    enabled: isSubscribed,
    retry: false,
  });

  useEffect(() => {
    trackEvent("autonomy_page_viewed", {
      source: "dashboard",
      plan: planId,
      subscribed: isSubscribed,
    });
  }, [planId, isSubscribed]);

  if (isSubscribed) {
    return <DashboardActive usage={usageQuery.data} loading={usageQuery.isLoading} />;
  }
  return <PitchState isInvite={isInvite} />;
}

// ═════════════════════════════════════════════════════════════════════════════
// État "abonné" — dashboard complet
// ═════════════════════════════════════════════════════════════════════════════

function DashboardActive({
  usage,
  loading,
}: {
  usage: AutonomyUsage | undefined;
  loading: boolean;
}) {
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
      <header style={{ marginBottom: 28 }}>
        <p
          style={{
            fontSize: 11,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: C.prussian,
            fontWeight: 700,
            margin: 0,
            marginBottom: 8,
          }}
        >
          Abonnement actif · CHF 39/mois
        </p>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 34,
            fontWeight: 300,
            color: C.text,
            margin: 0,
          }}
        >
          Althy Autonomie
        </h1>
      </header>

      {loading && (
        <p style={{ color: C.text3 }}>Chargement de votre usage…</p>
      )}

      {usage && (
        <>
          <section style={{ marginBottom: 32 }}>
            <h2
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 20,
                fontWeight: 400,
                color: C.text,
                margin: "0 0 14px",
              }}
            >
              Vos unités incluses cette année
            </h2>
            <UsageTracker usage={usage} />
          </section>

          <section
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 1fr",
              gap: 20,
              marginBottom: 32,
            }}
          >
            <ActionsPanel />
            <SupportPanel />
          </section>

          <section>
            <h2
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 20,
                fontWeight: 400,
                color: C.text,
                margin: "0 0 14px",
              }}
            >
              Gérer mon abonnement
            </h2>
            <div
              style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 14,
                padding: 20,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div>
                <p style={{ color: C.text, fontSize: 14, margin: 0 }}>
                  Démarré le{" "}
                  {new Date(usage.started_at).toLocaleDateString("fr-CH")}
                </p>
                <p style={{ color: C.text3, fontSize: 12, margin: "4px 0 0" }}>
                  Résiliable à tout moment, sans frais.
                </p>
              </div>
              <Link
                href="/app/abonnement"
                style={{
                  padding: "10px 18px",
                  border: `1px solid ${C.border}`,
                  borderRadius: 10,
                  color: C.text2,
                  fontSize: 13,
                  textDecoration: "none",
                }}
              >
                Paramètres de facturation
              </Link>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function ActionsPanel() {
  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: 20,
      }}
    >
      <h3
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: 18,
          fontWeight: 400,
          color: C.text,
          margin: "0 0 16px",
        }}
      >
        Services inclus
      </h3>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <ActionLink
          href="/app/candidatures"
          icon="🔍"
          title="Vérifier un locataire"
          hint="Scoring + pièces justificatives"
        />
        <ActionLink
          href="/app/ouvreurs"
          icon="🏠"
          title="Réserver un ouvreur"
          hint="Visite / check-in / check-out / EDL"
        />
        <ActionLink
          href="/app/contracts/new"
          icon="📄"
          title="Générer un contrat"
          hint="Bail Sunimmo suisse conforme"
        />
        <ActionLink
          href="/app/comptabilite"
          icon="🧾"
          title="Compta & export fiscal"
          hint="Réconciliation CAMT.054"
        />
      </div>
    </div>
  );
}

function ActionLink({
  href,
  icon,
  title,
  hint,
}: {
  href: string;
  icon: string;
  title: string;
  hint: string;
}) {
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        borderRadius: 10,
        border: `1px solid ${C.border}`,
        textDecoration: "none",
        color: C.text,
        transition: "all 0.15s",
      }}
    >
      <span style={{ fontSize: 20 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{title}</p>
        <p style={{ margin: 0, fontSize: 12, color: C.text3 }}>{hint}</p>
      </div>
      <span style={{ color: C.prussian, fontSize: 16 }}>→</span>
    </Link>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// État "non abonné" — pitch + CTA
// ═════════════════════════════════════════════════════════════════════════════

function PitchState({ isInvite }: { isInvite: boolean }) {
  const [economie, setEconomie] = useState(0);

  const ctaHref = isInvite
    ? "/app/abonnement?upgrade=autonomie"
    : "/app/abonnement?upgrade=autonomie";

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
      {isInvite && (
        <div
          style={{
            background: C.goldBg,
            border: `1px solid ${C.goldBorder}`,
            borderRadius: 14,
            padding: 20,
            marginBottom: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div>
            <p
              style={{
                color: C.prussian,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                margin: 0,
              }}
            >
              Pour les comptes invités
            </p>
            <h2
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 22,
                fontWeight: 300,
                color: C.text,
                margin: "4px 0 0",
              }}
            >
              Quittez votre agence pour CHF 39/mois
            </h2>
            <p style={{ color: C.text2, fontSize: 13, margin: "6px 0 0" }}>
              Votre agence est prévenue automatiquement. Vous gardez tous vos
              outils Althy.
            </p>
          </div>
          <Link
            href={ctaHref}
            style={{
              padding: "12px 22px",
              background: C.prussian,
              color: "#fff",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Passer en Autonomie →
          </Link>
        </div>
      )}

      <header style={{ marginBottom: 24 }}>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 34,
            fontWeight: 300,
            color: C.text,
            margin: 0,
            marginBottom: 8,
          }}
        >
          Althy Autonomie
        </h1>
        <p style={{ color: C.text2, fontSize: 15, margin: 0 }}>
          CHF 39/mois — tout ce qu'une régie fait, sans la commission. 4
          vérifications locataire + 4 missions ouvreur + assistance juridique
          incluses par an.
        </p>
      </header>

      <section style={{ marginBottom: 32 }}>
        <ComparisonCalculator onCalculated={setEconomie} />
        {economie > 2000 && (
          <div
            style={{
              background: C.prussianBg,
              border: `1px solid ${C.prussianBorder}`,
              borderRadius: 12,
              padding: 16,
              marginTop: 14,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <p style={{ margin: 0, color: C.text, fontSize: 14 }}>
              Avec cette configuration, vous économisez{" "}
              <strong>CHF {economie.toLocaleString("fr-CH")}/an</strong>.
            </p>
            <Link
              href={ctaHref}
              style={{
                padding: "10px 20px",
                background: C.prussian,
                color: "#fff",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              M'abonner →
            </Link>
          </div>
        )}
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 22,
            fontWeight: 400,
            color: C.text,
            margin: "0 0 16px",
          }}
        >
          Inclus dans votre forfait
        </h2>
        <InclusionsGrid />
      </section>
    </div>
  );
}
