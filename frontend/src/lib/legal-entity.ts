/**
 * Constantes juridiques — source unique pour toutes les mentions légales.
 *
 * ⚠  À mettre à jour dès que la Sàrl est inscrite au RC.
 *     Champs marqués « TODO » = à compléter avec les données réelles.
 */
export const LEGAL = {
  /** Raison sociale affichée partout */
  name: "Killian Thébaud — Althy",

  /** Forme juridique actuelle */
  form: "Raison individuelle (Sàrl en cours de constitution)",

  /** Numéro IDE — à compléter après attribution */
  ide: "CHE-XXX.XXX.XXX" as const,   // TODO: remplacer par le vrai numéro

  /** Siège social */
  siege: "Genève, Suisse",

  /** Adresse postale complète — à compléter */
  adresse: "Genève, Suisse",         // TODO: adresse complète

  /** Représentant légal */
  representant: "Killian Thébaud",

  /** Contact général */
  email: "contact@althy.ch",

  /** Contact données personnelles */
  emailPrivacy: "privacy@althy.ch",

  /** Site web */
  url: "https://althy.ch",

  /** Ligne courte pour pieds de page PDF / emails */
  footer: "Killian Thébaud — Althy · Genève · althy.ch",

  /** Ligne copyright */
  copyright: (year = new Date().getFullYear()) =>
    `© ${year} Althy — Killian Thébaud · Tous droits réservés`,
} as const
