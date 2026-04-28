/**
 * Helper : déduit le canton suisse depuis un code postal (NPA).
 *
 * Mapping simplifié (plages NPA → canton ISO). Couvre ~90% des cas courants.
 * Les frontières exactes sont complexes (un NPA peut chevaucher plusieurs
 * cantons, surtout en zones limitrophes). En cas de doute → `null`, l'utilisateur
 * complète manuellement depuis la fiche du bien après création.
 *
 * Sources : plages NPA officielles La Poste Suisse (approximation Phase 1).
 *
 * @param npa Code postal suisse à 4 chiffres
 * @returns Code canton ISO (VD, GE, ZH, …) ou null si incertain
 */
export function getCantonFromNpa(npa: string): string | null {
  if (!npa || npa.length !== 4) return null;
  const code = parseInt(npa, 10);
  if (isNaN(code)) return null;

  // Genève
  if (code >= 1200 && code <= 1299) return "GE";

  // Vaud (1000-1199, 1300-1499, 1800-1899)
  if (
    (code >= 1000 && code <= 1199) ||
    (code >= 1300 && code <= 1499) ||
    (code >= 1800 && code <= 1899)
  )
    return "VD";

  // Fribourg
  if (code >= 1500 && code <= 1799) return "FR";

  // Valais (1900-1999, 3900-3999)
  if ((code >= 1900 && code <= 1999) || (code >= 3900 && code <= 3999)) return "VS";

  // Neuchâtel (2000-2099, 2300-2399, 2500-2599)
  if (
    (code >= 2000 && code <= 2099) ||
    (code >= 2300 && code <= 2399) ||
    (code >= 2500 && code <= 2599)
  )
    return "NE";

  // Jura
  if (code >= 2800 && code <= 2999) return "JU";

  // Berne (3000-3899, hors NE/JU déjà capturés)
  if (code >= 3000 && code <= 3899) return "BE";

  // Bâle-Ville
  if (code >= 4000 && code <= 4099) return "BS";

  // Bâle-Campagne (4100-4199, 4400-4499)
  if ((code >= 4100 && code <= 4199) || (code >= 4400 && code <= 4499)) return "BL";

  // Soleure
  if (code >= 4500 && code <= 4599) return "SO";

  // Argovie
  if (code >= 5000 && code <= 5499) return "AG";

  // Lucerne
  if (code >= 6000 && code <= 6299) return "LU";

  // Zoug
  if (code >= 6300 && code <= 6399) return "ZG";

  // Schwyz
  if (code >= 6400 && code <= 6499) return "SZ";

  // Tessin
  if (code >= 6500 && code <= 6999) return "TI";

  // Grisons
  if (code >= 7000 && code <= 7599) return "GR";

  // Zurich
  if (code >= 8000 && code <= 8499) return "ZH";

  // Schaffhouse
  if (code >= 8200 && code <= 8299) return "SH";

  // Thurgovie
  if (code >= 8500 && code <= 8599) return "TG";

  // Glaris
  if (code >= 8700 && code <= 8799) return "GL";

  // Saint-Gall
  if (code >= 9000 && code <= 9499) return "SG";

  // Appenzell Rhodes-Extérieures
  if (code >= 9500 && code <= 9599) return "AR";

  // Appenzell Rhodes-Intérieures
  if (code >= 9600 && code <= 9699) return "AI";

  return null;
}

/**
 * Libellés français des 26 cantons suisses (ISO → nom complet).
 * Utile pour afficher "Vaud" plutôt que "VD".
 */
export const CANTON_LABELS: Record<string, string> = {
  AG: "Argovie",
  AI: "Appenzell Rhodes-Intérieures",
  AR: "Appenzell Rhodes-Extérieures",
  BE: "Berne",
  BL: "Bâle-Campagne",
  BS: "Bâle-Ville",
  FR: "Fribourg",
  GE: "Genève",
  GL: "Glaris",
  GR: "Grisons",
  JU: "Jura",
  LU: "Lucerne",
  NE: "Neuchâtel",
  NW: "Nidwald",
  OW: "Obwald",
  SG: "Saint-Gall",
  SH: "Schaffhouse",
  SO: "Soleure",
  SZ: "Schwyz",
  TG: "Thurgovie",
  TI: "Tessin",
  UR: "Uri",
  VD: "Vaud",
  VS: "Valais",
  ZG: "Zoug",
  ZH: "Zurich",
};
