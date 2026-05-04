"use client";

/**
 * FieldLabel — libellé court + tooltip explicatif au hover (PR-A11.A.6.d).
 *
 * Pattern « grand-père friendly » (cf docs/3-ARCHITECTURE.md §3.6 DA
 * scientifique + docs/4-PRODUIT.md §4.2 cible UX double) :
 *   - Libellé en français simple, sans jargon (« Identifiant du bâtiment »
 *     plutôt que « EGID »).
 *   - Icône info gris pâle à droite ; au hover → tooltip Bleu de Prusse
 *     avec le terme technique + définition courte.
 *
 * Usage :
 *
 *   <FieldLabel
 *     label="Identifiant du bâtiment"
 *     tooltip="EGID — numéro officiel du bâtiment au registre fédéral RegBL"
 *   />
 *
 * Implémentation : tooltip CSS-only via `:hover` sur le wrapper, span
 * position absolute. Pas de dépendance JS, pas de portail. Aria-label sur
 * l'icône pour l'accessibilité.
 */

import { Info } from "lucide-react";
import { C } from "@/lib/design-tokens";

interface Props {
  label: string;
  tooltip?: string;
  /** Affiche un astérisque rouge « * » (PR-A11.A.6.f) pour les champs
   *  obligatoires backend (BienCreate Pydantic : adresse / ville / cp).
   *  Utilise C.red du design-tokens, pas de hex direct. */
  required?: boolean;
}

export function FieldLabel({ label, tooltip, required }: Props) {
  if (!tooltip && !required) {
    return <span style={labelStyle}>{label}</span>;
  }
  return (
    <span className="althy-field-label" style={labelWithTooltipStyle}>
      <span style={labelStyle}>{label}</span>
      {required && <RequiredMarker />}
      {tooltip && (
        <span
          className="althy-field-label__icon"
          aria-label={tooltip}
          tabIndex={0}
          style={iconWrapStyle}
        >
          <Info size={12} />
          <span className="althy-field-label__tooltip" style={tooltipStyle}>
            {tooltip}
          </span>
        </span>
      )}
    </span>
  );
}

/** Marker « * » rouge pour champs obligatoires. Tooltip natif via title. */
export function RequiredMarker() {
  return (
    <span
      className="althy-field-label__required"
      role="img"
      aria-label="Champ obligatoire"
      title="Champ obligatoire"
      style={requiredMarkerStyle}
    >
      *
    </span>
  );
}

const labelStyle: React.CSSProperties = {
  display: "inline-block",
  fontSize: 11,
  fontWeight: 500,
  color: C.text3,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const labelWithTooltipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  position: "relative",
};

const iconWrapStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  color: C.text3,
  cursor: "help",
  position: "relative",
  outline: "none",
};

const requiredMarkerStyle: React.CSSProperties = {
  color: C.red,
  fontSize: 13,
  fontWeight: 600,
  marginLeft: 2,
  cursor: "help",
  letterSpacing: 0,
  textTransform: "none",
};

const tooltipStyle: React.CSSProperties = {
  position: "absolute",
  top: "calc(100% + 6px)",
  left: 0,
  zIndex: 50,
  background: C.prussian,
  color: "#fff",
  padding: "8px 10px",
  borderRadius: 6,
  fontSize: 11,
  fontWeight: 400,
  lineHeight: 1.45,
  letterSpacing: "normal",
  textTransform: "none",
  width: "max-content",
  maxWidth: 280,
  whiteSpace: "normal",
  boxShadow: "0 6px 18px rgba(15, 46, 76, 0.18)",
  pointerEvents: "none",
  opacity: 0,
  visibility: "hidden",
  transition: "opacity 140ms ease, visibility 0s linear 140ms",
};
