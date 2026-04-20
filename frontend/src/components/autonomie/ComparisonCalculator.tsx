"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { C } from "@/lib/design-tokens";
import { trackEvent } from "@/lib/analytics";

/**
 * Calculateur d'économie Autonomie vs régie traditionnelle.
 * Calcul local (pas d'appel backend) pour réactivité instantanée ;
 * le backend /api/v1/autonomie/comparison sert au benchmark et aux audits.
 */

const AUTONOMIE_MONTHLY = 39;
const AGENCY_PCT = 0.05;
const AGENCY_ADMIN_YEARLY = 400;

export function ComparisonCalculator({
  onCalculated,
}: {
  onCalculated?: (economie: number) => void;
}) {
  const t = useTranslations("autonomie.calculator");
  const [nbBiens, setNbBiens] = useState(2);
  const [loyerMoyen, setLoyerMoyen] = useState(2000);

  const result = useMemo(() => {
    const loyersAnnuels = nbBiens * loyerMoyen * 12;
    const coutRegie = loyersAnnuels * AGENCY_PCT + AGENCY_ADMIN_YEARLY;
    const coutAutonomie = AUTONOMIE_MONTHLY * 12;
    const economie = coutRegie - coutAutonomie;
    const economiePct = coutRegie > 0 ? (economie / coutRegie) * 100 : 0;
    return {
      coutRegie: Math.round(coutRegie),
      coutAutonomie: Math.round(coutAutonomie),
      economie: Math.round(economie),
      economiePct: Math.round(economiePct),
    };
  }, [nbBiens, loyerMoyen]);

  const fireTracking = () => {
    trackEvent("autonomy_comparison_calculated", {
      nb_biens: nbBiens,
      loyer_moyen: loyerMoyen,
      economie_annuelle: result.economie,
    });
    onCalculated?.(result.economie);
  };

  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 16,
        padding: 28,
        boxShadow: C.shadowMd,
      }}
    >
      <h3
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: 24,
          fontWeight: 300,
          color: C.text,
          margin: 0,
          marginBottom: 4,
        }}
      >
        {t("title")}
      </h3>
      <p style={{ color: C.text3, fontSize: 13, margin: 0, marginBottom: 24 }}>
        {t("subtitle")}
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <Field
          label={t("fieldNbBiens")}
          value={nbBiens}
          suffix=""
          min={1}
          max={50}
          step={1}
          onChange={(v) => setNbBiens(v)}
          onRelease={fireTracking}
        />
        <Field
          label={t("fieldLoyer")}
          value={loyerMoyen}
          suffix=" CHF"
          min={800}
          max={8000}
          step={100}
          onChange={(v) => setLoyerMoyen(v)}
          onRelease={fireTracking}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <CostCard
          label={t("costRegieLabel")}
          amount={result.coutRegie}
          accent="muted"
          sublabel={t("costRegieSublabel", { admin: AGENCY_ADMIN_YEARLY })}
        />
        <CostCard
          label={t("costAutonomieLabel")}
          amount={result.coutAutonomie}
          accent="prussian"
          sublabel={t("costAutonomieSublabel")}
        />
      </div>

      <div
        style={{
          background: C.goldBg,
          border: `1px solid ${C.goldBorder}`,
          borderRadius: 12,
          padding: 18,
          textAlign: "center",
        }}
      >
        <p
          style={{
            color: C.text3,
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            margin: 0,
            marginBottom: 6,
          }}
        >
          {t("economyLabel")}
        </p>
        <p
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 38,
            fontWeight: 300,
            color: C.prussian,
            margin: 0,
            lineHeight: 1,
          }}
        >
          CHF&nbsp;{result.economie.toLocaleString("fr-CH")}
        </p>
        <p style={{ color: C.text2, fontSize: 13, margin: 0, marginTop: 6 }}>
          {t("economyPctSuffix", { pct: result.economiePct })}
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  suffix,
  min,
  max,
  step,
  onChange,
  onRelease,
}: {
  label: string;
  value: number;
  suffix: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  onRelease: () => void;
}) {
  return (
    <div>
      <label
        style={{
          display: "block",
          fontSize: 12,
          color: C.text3,
          marginBottom: 8,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </label>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 6,
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 28,
            fontWeight: 300,
            color: C.text,
          }}
        >
          {value.toLocaleString("fr-CH")}
        </span>
        {suffix && (
          <span style={{ color: C.text3, fontSize: 14 }}>{suffix}</span>
        )}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onMouseUp={onRelease}
        onTouchEnd={onRelease}
        style={{
          width: "100%",
          accentColor: "var(--althy-prussian)",
        }}
      />
    </div>
  );
}

function CostCard({
  label,
  amount,
  accent,
  sublabel,
}: {
  label: string;
  amount: number;
  accent: "muted" | "prussian";
  sublabel: string;
}) {
  const isPrussian = accent === "prussian";
  return (
    <div
      style={{
        border: `1px solid ${isPrussian ? C.prussianBorder : C.border}`,
        background: isPrussian ? C.prussianBg : C.surface2,
        borderRadius: 12,
        padding: 16,
      }}
    >
      <p style={{ color: C.text3, fontSize: 12, margin: 0 }}>{label}</p>
      <p
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: 22,
          fontWeight: 300,
          color: isPrussian ? C.prussian : C.text,
          margin: "4px 0 2px",
        }}
      >
        CHF&nbsp;{amount.toLocaleString("fr-CH")}
      </p>
      <p style={{ color: C.text3, fontSize: 11, margin: 0 }}>{sublabel}</p>
    </div>
  );
}
