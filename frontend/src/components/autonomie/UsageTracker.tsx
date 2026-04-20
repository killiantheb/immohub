"use client";

import { C } from "@/lib/design-tokens";

export type AutonomyUsage = {
  status: "active" | "paused" | "cancelled";
  verifications_used: number;
  verifications_included: number;
  verifications_remaining: number;
  opener_missions_used: number;
  opener_missions_included: number;
  opener_missions_remaining: number;
  legal_assistance_included: boolean;
  started_at: string;
  cancelled_at: string | null;
};

export function UsageTracker({ usage }: { usage: AutonomyUsage }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        gap: 16,
      }}
    >
      <UsageCard
        icon="🔍"
        label="Vérifications locataire"
        used={usage.verifications_used}
        included={usage.verifications_included}
        remaining={usage.verifications_remaining}
        action="Demander une vérification"
        href="/app/candidatures"
      />
      <UsageCard
        icon="🏠"
        label="Missions ouvreur"
        used={usage.opener_missions_used}
        included={usage.opener_missions_included}
        remaining={usage.opener_missions_remaining}
        action="Réserver un ouvreur"
        href="/app/ouvreurs"
      />
    </div>
  );
}

function UsageCard({
  icon,
  label,
  used,
  included,
  remaining,
  action,
  href,
}: {
  icon: string;
  label: string;
  used: number;
  included: number;
  remaining: number;
  action: string;
  href: string;
}) {
  const pct = included > 0 ? (used / included) * 100 : 0;
  const exhausted = remaining === 0;

  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <span style={{ fontSize: 22 }}>{icon}</span>
        <h4
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 16,
            fontWeight: 400,
            color: C.text,
            margin: 0,
          }}
        >
          {label}
        </h4>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 28,
            fontWeight: 300,
            color: exhausted ? C.amber : C.prussian,
            lineHeight: 1,
          }}
        >
          {remaining}
        </span>
        <span style={{ color: C.text3, fontSize: 13 }}>
          sur {included} restantes
        </span>
      </div>

      <div
        style={{
          width: "100%",
          height: 6,
          background: C.border,
          borderRadius: 3,
          overflow: "hidden",
          marginBottom: 14,
        }}
      >
        <div
          style={{
            width: `${Math.min(100, pct)}%`,
            height: "100%",
            background: exhausted ? C.amber : C.prussian,
            transition: "width 0.3s",
          }}
        />
      </div>

      {exhausted ? (
        <p style={{ color: C.text3, fontSize: 12, margin: 0 }}>
          Quota annuel atteint — les prochaines unités seront facturées au tarif
          marketplace standard.
        </p>
      ) : (
        <a
          href={href}
          style={{
            display: "inline-block",
            padding: "8px 14px",
            borderRadius: 8,
            background: C.prussian,
            color: "#fff",
            fontSize: 13,
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          {action} →
        </a>
      )}
    </div>
  );
}
