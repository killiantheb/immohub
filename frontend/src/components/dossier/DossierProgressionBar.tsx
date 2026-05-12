"use client";

/**
 * DossierProgressionBar — barre de progression 0-100% du dossier locataire.
 *
 * Sprint 1B.1 (2026-05-12) : 100% strict pour finaliser la location, plus
 * de seuil 70% intermédiaire (décision Killian post E2E Sunimmo).
 *
 * Visuels (palette §B.4 stricte, 0 orange) :
 *   - < 100% : barre Prussian + texte « Pour finaliser votre location : 100% requis »
 *   - = 100% : barre Vert     + texte « ✅ Dossier complet »
 *
 * Compatible read-only côté bailleur (même rendu, pas d'action).
 */

import { CheckCircle2 } from "lucide-react";

import { C } from "@/lib/design-tokens";


interface Props {
  progression: number;
  /** Si true (vue bailleur), message contextualisé « Locataire prêt ». */
  bailleurView?: boolean;
}

export function DossierProgressionBar({ progression, bailleurView = false }: Props) {
  const pct = Math.min(100, Math.max(0, progression));
  const isComplete = pct >= 100;
  const barColor = isComplete ? C.green : C.prussian;
  const barBg = isComplete ? C.greenBg : C.prussianBg;

  const label = (() => {
    if (isComplete) return bailleurView ? "Dossier complet" : "Dossier complet, bravo !";
    return bailleurView
      ? `${pct}% — En attente de complétion`
      : "Pour finaliser votre location : 100% requis";
  })();

  return (
    <div
      aria-label="Progression du dossier"
      style={{
        background: C.surface,
        borderRadius: 14,
        border: `1px solid ${C.border}`,
        padding: "20px 24px",
        boxShadow: C.shadow,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isComplete && <CheckCircle2 size={18} style={{ color: C.green }} />}
          <p
            style={{
              fontFamily: "var(--font-serif, Georgia, serif)",
              fontSize: 17,
              color: C.text,
              margin: 0,
              fontWeight: 500,
              letterSpacing: "0.01em",
            }}
          >
            {label}
          </p>
        </div>
        <p
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: barColor,
            margin: 0,
            fontVariantNumeric: "tabular-nums",
          }}
          aria-live="polite"
        >
          {pct}
          <span style={{ fontSize: 14, color: C.text3, fontWeight: 500 }}>/100</span>
        </p>
      </div>

      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        style={{
          height: 10,
          borderRadius: 99,
          background: barBg,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            borderRadius: 99,
            background: barColor,
            transition: "width 0.6s cubic-bezier(0.4, 0, 0.2, 1), background 0.3s",
          }}
        />
      </div>

      {!bailleurView && !isComplete && (
        <p
          style={{
            fontSize: 12,
            color: C.text3,
            margin: "10px 0 0",
            lineHeight: 1.5,
          }}
        >
          Plus vite vous complétez, plus vite vous récupérez vos clés.
        </p>
      )}
    </div>
  );
}
