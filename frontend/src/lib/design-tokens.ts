/**
 * design-tokens.ts — Source unique des tokens de design Althy.
 *
 * Chaque valeur est un pointeur vers une CSS variable définie dans globals.css.
 * Usage : import { C } from "@/lib/design-tokens"
 *         style={{ color: C.prussian, background: C.prussianBg }}
 *
 * Palette Bleu de Prusse + Or (2026-04-20) :
 *   - Principale   : Bleu de Prusse #0F2E4C (C.prussian)
 *   - Hover/accent : Bleu signature #1A4975 (C.signature)
 *   - Premium      : Or Althy     #C9A961 (C.gold)
 *
 * RÈGLE : ne jamais déclarer `const S = { ... }` ou `const PRUSSIAN = "#0F2E4C"`
 *         dans un fichier composant. Toujours importer C depuis ce fichier.
 *         Exception : `const PRUSSIAN_HEX` dans les fichiers map/ (Mapbox exige du hex).
 *
 * Rétro-compat : C.orange* = alias vers C.prussian* (à supprimer après migration).
 */

export const C = {
  // ── Surfaces ────────────────────────────────────────────────────────────────
  bg:           "var(--althy-bg)",
  surface:      "var(--althy-surface)",
  surface2:     "var(--althy-surface-2)",
  glacier:      "var(--althy-glacier)",

  // ── Bordures ────────────────────────────────────────────────────────────────
  border:       "var(--althy-border)",
  border2:      "var(--althy-border-2)",

  // ── Texte ───────────────────────────────────────────────────────────────────
  text:         "var(--althy-text)",
  text2:        "var(--althy-text-2)",
  text3:        "var(--althy-text-3)",
  textMid:      "var(--althy-text-2)",
  textMuted:    "var(--althy-text-3)",

  // ── Bleu de Prusse (couleur principale) ─────────────────────────────────────
  prussian:       "var(--althy-prussian)",
  prussianLight:  "var(--althy-prussian-light)",
  prussianBg:     "var(--althy-prussian-bg)",
  prussianBorder: "var(--althy-prussian-border)",
  signature:      "var(--althy-signature)",

  // ── Or Althy (accents premium : badges "populaire", CTA valorisation) ───────
  gold:         "var(--althy-gold)",
  goldLight:    "var(--althy-gold-light)",
  goldBg:       "var(--althy-gold-bg)",
  goldHover:    "var(--althy-gold-hover)",
  goldBorder:   "var(--althy-gold-border)",

  // ── Alias transition (ex-orange → prussian) — à supprimer après migration ─
  orange:       "var(--althy-prussian)",
  orangeLight:  "var(--althy-prussian-light)",
  orangeBg:     "var(--althy-prussian-bg)",
  orangeHover:  "var(--althy-signature)",
  orangeBorder: "var(--althy-prussian-border)",

  // ── Couleurs sémantiques ────────────────────────────────────────────────────
  green:        "var(--althy-green)",
  greenBg:      "var(--althy-green-bg)",
  red:          "var(--althy-red)",
  redBg:        "var(--althy-red-bg)",
  amber:        "var(--althy-amber)",
  amberBg:      "var(--althy-amber-bg)",
  warning:      "var(--althy-warning)",
  warningBg:    "var(--althy-warning-bg)",
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

  // ── Ombres ──────────────────────────────────────────────────────────────────
  shadow:       "var(--althy-shadow)",
  shadowMd:     "var(--althy-shadow-md)",
  shadowLg:     "var(--althy-shadow-lg)",

  // ── Rayons ──────────────────────────────────────────────────────────────────
  radiusCard:   "var(--radius-card)",
  radiusElem:   "var(--radius-elem)",
} as const;

export type TokenKey = keyof typeof C;
