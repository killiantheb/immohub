/**
 * Système typographique partagé — Sprint 4A UX Polish (2026-05-12).
 *
 * Le projet utilise des inline styles + tokens design (`C.*`), pas de Tailwind
 * applicatif. Cette lib exporte donc des CSSProperties prêts à étaler dans les
 * composants pour standardiser les petits textes et corriger les zones où la
 * taille tombait sous le seuil de lisibilité (audit Killian 2026-05-12) :
 *
 *   - labels mini en 10-11px → minimum 12px
 *   - sous-textes timestamp / "brut estimé" en 9-10px → 11-12px
 *   - badges en 10-11px → 11-12px avec padding plus généreux
 *
 * Doctrine :
 *   - §B.4 : palette stricte. Les couleurs viennent de `C.*` côté composant,
 *     ce fichier ne fixe que la typo.
 *   - §B.10 : honnêteté. Les contrastes (text3 pâle) sont relevés vers text2
 *     pour les sub-labels critiques (LOYER/CHARGES) qui portent une info clé.
 */

import type { CSSProperties } from "react";

/** Label mini en majuscules + tracking (badges secondaires, sous-titres). */
export const TYPO_LABEL_SMALL: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

/** Label standard en majuscules (sous-titres de section : CONTACT & BAIL, etc.). */
export const TYPO_LABEL_MEDIUM: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

/** Caption / sub-label sous une valeur principale ("/ mois", "brut estimé"). */
export const TYPO_CAPTION: CSSProperties = {
  fontSize: 11,
  fontWeight: 400,
  lineHeight: 1.4,
};

/** Metadata neutre (timestamps "il y a 11h", filename · date). */
export const TYPO_METADATA: CSSProperties = {
  fontSize: 11,
  fontWeight: 400,
  lineHeight: 1.4,
};

/** Badge inline (Résolu, Actif, Validé, etc.). Couleurs définies par le caller. */
export const TYPO_BADGE: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  padding: "3px 10px",
  borderRadius: 99,
  whiteSpace: "nowrap",
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
};
