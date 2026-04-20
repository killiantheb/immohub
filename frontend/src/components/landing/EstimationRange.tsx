"use client";

import Link from "next/link";
import { ArrowRight, TrendingUp } from "lucide-react";
import { C } from "@/lib/design-tokens";
import type { LandingEntities } from "./InlineChat";

const sans = "var(--font-sans)";

/**
 * Fourchettes indicatives CHF/m²/mois (Suisse romande, marché 2026).
 * Source : médianes observées sur Homegate + OFS 2024. Uniquement indicatif —
 * l'estimation précise exige surface + pièces + adresse (via /estimation).
 */
const VILLE_CHF_M2: Record<string, [number, number]> = {
  geneve:     [32, 45],
  "genève":   [32, 45],
  lausanne:   [28, 38],
  montreux:   [24, 32],
  vevey:      [23, 30],
  nyon:       [26, 34],
  fribourg:   [20, 28],
  neuchatel:  [19, 26],
  "neuchâtel":[19, 26],
  sion:       [18, 24],
  martigny:   [17, 23],
};

const DEFAULT_RANGE: [number, number] = [22, 32];

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function EstimationRange({ entities }: { entities: LandingEntities }) {
  const villeKey = entities.ville ? normalize(entities.ville) : "";
  const range = VILLE_CHF_M2[entities.ville?.toLowerCase() ?? ""]
            ?? VILLE_CHF_M2[villeKey]
            ?? DEFAULT_RANGE;
  const villeLabel = entities.ville ?? "Suisse romande";

  const surfaceNum = entities.surface ? parseInt(entities.surface.replace(/[^\d]/g, ""), 10) : null;
  const pieces = entities.type?.match(/(\d+(?:\.\d+)?)/)?.[1];

  const min = surfaceNum ? Math.round(surfaceNum * range[0]) : null;
  const max = surfaceNum ? Math.round(surfaceNum * range[1]) : null;

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <TrendingUp size={14} style={{ color: C.gold }} />
        <span>Estimation indicative — {villeLabel}</span>
      </div>

      {min && max ? (
        <>
          <div
            style={{
              marginTop: 10,
              padding: "12px 14px",
              borderRadius: 10,
              background: C.goldBg,
              border: `1px solid ${C.goldBorder}`,
            }}
          >
            <div style={{ fontSize: 11, color: C.text2, fontFamily: sans, letterSpacing: "0.03em" }}>
              Fourchette mensuelle estimée
            </div>
            <div
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 22,
                fontWeight: 300,
                color: C.prussian,
                marginTop: 2,
                letterSpacing: "-0.01em",
              }}
            >
              CHF {min.toLocaleString("fr-CH")} – {max.toLocaleString("fr-CH")}
            </div>
            <div style={{ fontSize: 11, color: C.text3, marginTop: 4 }}>
              Basé sur {range[0]}–{range[1]} CHF/m² · {surfaceNum} m²
              {pieces ? ` · ${pieces} pièces` : ""}
            </div>
          </div>
        </>
      ) : (
        <p style={{ margin: "10px 0 4px", fontSize: 13, color: C.text, lineHeight: 1.5 }}>
          Marché {villeLabel} :{" "}
          <strong style={{ color: C.prussian }}>
            CHF {range[0]} – {range[1]} / m² / mois
          </strong>
          . Indiquez la surface pour une fourchette précise.
        </p>
      )}

      <Link href="/estimation?source=landing_chat" style={ctaLink}>
        Obtenir l&apos;estimation complète gratuite <ArrowRight size={14} />
      </Link>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  marginTop: 8,
  padding: 14,
  borderRadius: 14,
  background: "#fff",
  border: `1px solid ${C.border}`,
  boxShadow: "0 1px 2px rgba(15,46,76,0.06)",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontFamily: sans,
  fontSize: 12,
  fontWeight: 600,
  color: C.text2,
  letterSpacing: "0.02em",
};

const ctaLink: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  marginTop: 12,
  fontFamily: sans,
  fontSize: 12,
  fontWeight: 600,
  color: C.prussian,
  textDecoration: "none",
};
