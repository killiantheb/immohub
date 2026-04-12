/**
 * design-tokens.ts — Source unique des tokens de design Althy.
 *
 * Chaque valeur est un pointeur vers une CSS variable définie dans globals.css.
 * Usage : import { C } from "@/lib/design-tokens"
 *         style={{ color: C.orange, background: C.orangeBg }}
 */

export const C = {
  // ── Surfaces ────────────────────────────────────────────────────────────────
  bg:           "var(--althy-bg)",
  surface:      "var(--althy-surface)",
  surface2:     "var(--althy-surface-2)",

  // ── Bordures ────────────────────────────────────────────────────────────────
  border:       "var(--althy-border)",
  border2:      "var(--althy-border-2)",

  // ── Texte ───────────────────────────────────────────────────────────────────
  text:         "var(--althy-text)",
  textMid:      "var(--althy-text-2)",
  textMuted:    "var(--althy-text-3)",

  // ── Orange (couleur principale) ─────────────────────────────────────────────
  orange:       "var(--althy-orange)",
  orangeLight:  "var(--althy-orange-light)",
  orangeBg:     "var(--althy-orange-bg)",
  orangeHover:  "var(--althy-orange-hover)",
  orangeBorder: "var(--althy-orange-border)",

  // ── Couleurs sémantiques ────────────────────────────────────────────────────
  green:        "var(--althy-green)",
  greenBg:      "var(--althy-green-bg)",
  red:          "var(--althy-red)",
  redBg:        "var(--althy-red-bg)",
  amber:        "var(--althy-amber)",
  amberBg:      "var(--althy-amber-bg)",
  blue:         "var(--althy-blue)",
  blueBg:       "var(--althy-blue-bg)",
  purple:       "var(--althy-purple)",
  purpleBg:     "var(--althy-purple-bg)",

  // ── Mode nuit ───────────────────────────────────────────────────────────────
  night:        "var(--althy-night)",
  nightSurface: "var(--althy-night-surface)",
  nightBorder:  "var(--althy-night-border)",
  nightText:    "var(--althy-night-text)",

  // ── Carte / map overlay ─────────────────────────────────────────────────────
  mapOverlay:   "var(--althy-map-overlay)",
  mapCard:      "var(--althy-map-card)",

  // ── Swipe (oui / non) ───────────────────────────────────────────────────────
  swipeYes:     "var(--althy-swipe-yes)",
  swipeYesBg:   "var(--althy-swipe-yes-bg)",
  swipeNo:      "var(--althy-swipe-no)",
  swipeNoBg:    "var(--althy-swipe-no-bg)",

  // ── Premium gold ────────────────────────────────────────────────────────────
  gold:         "var(--althy-gold)",
  goldBg:       "var(--althy-gold-bg)",

  // ── Ombres ──────────────────────────────────────────────────────────────────
  shadow:       "var(--althy-shadow)",
  shadowMd:     "var(--althy-shadow-md)",
  shadowLg:     "var(--althy-shadow-lg)",
} as const;

export type ColorKey = keyof typeof C;
