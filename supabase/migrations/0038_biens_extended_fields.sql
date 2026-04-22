-- ============================================================================
-- 0038_biens_extended_fields.sql
-- ----------------------------------------------------------------------------
-- Refonte du modèle `biens` (Sprint wizard 6 étapes).
--
-- Contexte (2026-04-22) :
--   Le modèle `biens` actuel ne couvre que la location annuelle de base
--   (adresse, type, surface, loyer, charges, statut). On ajoute :
--     * Nommage métier (immeuble + unité ou nom personnalisé)
--     * Type de location (annuelle | saisonnière) + meublé
--     * Tarification saisonnière (par nuit, ménage, taxe, min/max nuits)
--     * Caractéristiques étendues (pièces 3.5 CH, chambres, sdb, années,
--       classe énergétique CECB)
--     * Équipements booléens (balcon, terrasse, jardin, parking, garage,
--       cave, ascenseur, cheminée, lave-vaisselle, lave-linge)
--     * Description libre + date de disponibilité
--
-- Toutes les colonnes ont une DEFAULT ou sont NULLABLE → aucune donnée
-- existante n'est touchée. Retrocompatible 100%.
-- ============================================================================

-- ── 1. Enum type_location ───────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'type_location_enum') THEN
        CREATE TYPE type_location_enum AS ENUM ('annuelle', 'saisonniere');
    END IF;
END$$;

-- ── 2. Nommage métier ───────────────────────────────────────────────────────
ALTER TABLE biens
    ADD COLUMN IF NOT EXISTS nom_immeuble     VARCHAR(100),
    ADD COLUMN IF NOT EXISTS unite            VARCHAR(20),
    ADD COLUMN IF NOT EXISTS nom_personnalise VARCHAR(100);

-- ── 3. Type de location & meublé ────────────────────────────────────────────
ALTER TABLE biens
    ADD COLUMN IF NOT EXISTS type_location type_location_enum NOT NULL DEFAULT 'annuelle',
    ADD COLUMN IF NOT EXISTS meuble        BOOLEAN             NOT NULL DEFAULT false;

-- ── 4. Caractéristiques étendues ────────────────────────────────────────────
ALTER TABLE biens
    ADD COLUMN IF NOT EXISTS nb_pieces          NUMERIC(3, 1),
    ADD COLUMN IF NOT EXISTS nb_chambres        INTEGER,
    ADD COLUMN IF NOT EXISTS nb_salles_bain     INTEGER,
    ADD COLUMN IF NOT EXISTS annee_construction INTEGER,
    ADD COLUMN IF NOT EXISTS annee_renovation   INTEGER,
    ADD COLUMN IF NOT EXISTS classe_energetique VARCHAR(2);

-- ── 5. Équipements booléens ────────────────────────────────────────────────
ALTER TABLE biens
    ADD COLUMN IF NOT EXISTS balcon         BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS terrasse       BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS jardin         BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS parking        BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS garage_inclus  BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS cave           BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS ascenseur      BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS cheminee       BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS lave_vaisselle BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS lave_linge     BOOLEAN NOT NULL DEFAULT false;

-- ── 6. Tarification saisonnière (utilisée si type_location = 'saisonniere') ─
ALTER TABLE biens
    ADD COLUMN IF NOT EXISTS prix_nuit_basse_saison NUMERIC(10, 2),
    ADD COLUMN IF NOT EXISTS prix_nuit_mi_saison    NUMERIC(10, 2),
    ADD COLUMN IF NOT EXISTS prix_nuit_haute_saison NUMERIC(10, 2),
    ADD COLUMN IF NOT EXISTS taxe_sejour_par_nuit   NUMERIC(10, 2),
    ADD COLUMN IF NOT EXISTS frais_menage_fixe      NUMERIC(10, 2),
    ADD COLUMN IF NOT EXISTS nuitees_min            INTEGER,
    ADD COLUMN IF NOT EXISTS nuitees_max            INTEGER;

-- ── 7. Texte libre & disponibilité ─────────────────────────────────────────
ALTER TABLE biens
    ADD COLUMN IF NOT EXISTS description    TEXT,
    ADD COLUMN IF NOT EXISTS disponible_des DATE;

-- ── 8. Contraintes de cohérence ────────────────────────────────────────────
-- Classe énergétique : 1 lettre majuscule (CECB suisse : A, B, C, D, E, F, G)
-- Nullable, mais si renseignée doit matcher.
ALTER TABLE biens DROP CONSTRAINT IF EXISTS biens_classe_energetique_fmt;
ALTER TABLE biens ADD  CONSTRAINT biens_classe_energetique_fmt
    CHECK (classe_energetique IS NULL OR classe_energetique ~ '^[A-G]$');

-- Nuitées min/max : si les deux renseignés, min <= max
ALTER TABLE biens DROP CONSTRAINT IF EXISTS biens_nuitees_range;
ALTER TABLE biens ADD  CONSTRAINT biens_nuitees_range
    CHECK (nuitees_min IS NULL OR nuitees_max IS NULL OR nuitees_min <= nuitees_max);

-- Année rénovation >= année construction si les deux renseignées
ALTER TABLE biens DROP CONSTRAINT IF EXISTS biens_annee_renovation_after_construction;
ALTER TABLE biens ADD  CONSTRAINT biens_annee_renovation_after_construction
    CHECK (annee_renovation IS NULL OR annee_construction IS NULL
           OR annee_renovation >= annee_construction);

-- ── 9. Index pour filtres dashboard ────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_biens_type_location ON biens(type_location);
CREATE INDEX IF NOT EXISTS idx_biens_meuble        ON biens(meuble) WHERE meuble = true;
CREATE INDEX IF NOT EXISTS idx_biens_nom_immeuble  ON biens(nom_immeuble) WHERE nom_immeuble IS NOT NULL;

-- ── 10. Documentation ──────────────────────────────────────────────────────
COMMENT ON COLUMN biens.nom_immeuble        IS 'Ex: "Les Pierres B", "Résidence du Lac". NULL si villa unique.';
COMMENT ON COLUMN biens.unite               IS 'Numéro/identifiant d''unité dans l''immeuble. Ex: "12", "3A", "Rdc droite".';
COMMENT ON COLUMN biens.nom_personnalise    IS 'Nom donné par le propriétaire. Ex: "Perle". Priorité affichage : nom_personnalise > nom_immeuble+unite > adresse.';
COMMENT ON COLUMN biens.type_location       IS 'annuelle (default, cas Sunimmo majoritaire) | saisonniere (Airbnb-like).';
COMMENT ON COLUMN biens.meuble              IS 'Obligatoire à true si type_location = saisonniere.';
COMMENT ON COLUMN biens.nb_pieces           IS 'Nombre de pièces au sens suisse (3.5, 4.5, etc.).';
COMMENT ON COLUMN biens.classe_energetique  IS 'CECB suisse : A à G. NULL si non audité.';
COMMENT ON COLUMN biens.prix_nuit_basse_saison IS 'CHF/nuit basse saison. Utilisé si type_location = saisonniere.';
COMMENT ON COLUMN biens.prix_nuit_mi_saison    IS 'CHF/nuit mi-saison. Utilisé si type_location = saisonniere.';
COMMENT ON COLUMN biens.prix_nuit_haute_saison IS 'CHF/nuit haute saison. Utilisé si type_location = saisonniere.';
COMMENT ON COLUMN biens.taxe_sejour_par_nuit   IS 'Taxe de séjour CHF/nuit (ex: Vaud ~CHF 4.20).';
COMMENT ON COLUMN biens.frais_menage_fixe      IS 'Supplément ménage fixe par séjour (CHF).';
COMMENT ON COLUMN biens.disponible_des         IS 'Date d''entrée possible (annuelle). Saisonnière : géré via calendrier dédié hors scope sprint.';
