/**
 * Constantes juridiques — source unique pour toutes les mentions légales.
 */
export const LEGAL = {
  /** Raison sociale affichée partout */
  name: "HBM Swiss Sàrl",

  /** Forme juridique actuelle */
  form: "Société à responsabilité limitée (Sàrl)",

  /** Numéro IDE (sert aussi de N° TVA) */
  ide: "CHE-179.984.757" as const,

  /** Siège social */
  siege: "Genève, Suisse",

  /** Adresse postale complète — à compléter */
  adresse: "Genève, Suisse",         // TODO: adresse complète

  /** Représentant légal (personne physique) */
  representant: "Killian Thébaud",

  /** Contact général */
  email: "contact@althy.ch",

  /** Contact données personnelles */
  emailPrivacy: "privacy@althy.ch",

  /** Site web */
  url: "https://althy.ch",

  /** Ligne courte pour pieds de page PDF / emails */
  footer: "HBM Swiss Sàrl · Genève · althy.ch",

  /** Ligne copyright */
  copyright: (year = new Date().getFullYear()) =>
    `© ${year} Althy — HBM Swiss Sàrl · Tous droits réservés`,
} as const
