"""Fusion properties → biens (refonte complète location annuelle).

Contexte métier :
    Althy fusionne les deux systèmes de gestion de biens (properties legacy EN +
    biens FR) en une seule table `biens` enrichie à 43 colonnes. Le scope est
    strictement location annuelle (le saisonnier et la vente sont reportés).

Actions :
    1.  TRUNCATE biens + properties (5 lignes prod, accepté par le fondateur).
    2.  DROP property_images, property_documents (legacy annexes).
    3.  Créer l'enum parking_type_enum (4 valeurs).
    4.  Ajouter 29 colonnes à biens (identité, localisation, caractéristiques,
        équipements, situation, transports, descriptions, finances, opérationnel).
    5.  Renommer property_id → bien_id (FK vers biens(id)) dans 9 tables liées :
        contracts, quotes, listings, inspections, missions, rfqs, transactions,
        crm_contacts, crm_notes.
    6.  Créer bien_images, bien_documents (mêmes colonnes qu'avant).
    7.  Créer catalogue_equipements + seed de 49 équipements répartis en 7 catégories.
    8.  Créer bien_equipements (jonction N:N).
    9.  Créer ch_postal_codes + seed d'environ 230 NPAs (GE/VD/VS/FR/NE/JU
        prioritaires pour Phase 1, plus chefs-lieux ZH/BE/BS/TI).
    10. DROP properties + les trois enums legacy (property_type_enum,
        property_status_enum, property_document_type_enum).

ATTENTION : migration destructive. Validée par le fondateur avec :
    - Aucune donnée prod à préserver (2 properties + 3 biens)
    - Backup Supabase à télécharger manuellement AVANT l'exécution
    - Execution uniquement sur validation manuelle (pas de CI auto)

TODO post-Phase 1 :
    - Étendre ch_postal_codes avec le CSV Swisstopo complet (~4100 NPAs) — nécessite
      import manuel du fichier officiel. Non bloquant pour le lancement.

Revision ID: 0029
Revises: 0028
Create Date: 2026-04-23
"""

from __future__ import annotations

from alembic import op

revision = "0029"
down_revision = "0028"
branch_labels = None
depends_on = None


# ── Tables portant une FK property_id à migrer vers bien_id → biens(id) ──────
# Format : (nom_table, clause ON DELETE, nullable)
_TABLES_FK = [
    ("contracts",    "RESTRICT",  False),
    ("quotes",       "RESTRICT",  False),
    ("listings",     "CASCADE",   False),  # UNIQUE sur property_id → reste unique
    ("inspections",  "RESTRICT",  False),
    ("missions",     "RESTRICT",  False),
    ("rfqs",         "SET NULL",  True),
    ("transactions", "SET NULL",  True),
    ("crm_contacts", "SET NULL",  True),
    ("crm_notes",    "SET NULL",  True),
]


def upgrade() -> None:
    # ═════════════════════════════════════════════════════════════════════════
    # 1. Wipe des données existantes (accepté par le fondateur)
    # ═════════════════════════════════════════════════════════════════════════
    op.execute("TRUNCATE TABLE biens RESTART IDENTITY CASCADE")
    op.execute("TRUNCATE TABLE properties RESTART IDENTITY CASCADE")

    # ═════════════════════════════════════════════════════════════════════════
    # 2. Drop des tables annexes legacy
    # ═════════════════════════════════════════════════════════════════════════
    op.execute("DROP TABLE IF EXISTS property_images CASCADE")
    op.execute("DROP TABLE IF EXISTS property_documents CASCADE")

    # ═════════════════════════════════════════════════════════════════════════
    # 3. Créer l'enum parking_type_enum
    # ═════════════════════════════════════════════════════════════════════════
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'parking_type_enum') THEN
                CREATE TYPE parking_type_enum AS ENUM (
                    'exterieur',
                    'exterieur_couvert',
                    'interieur',
                    'interieur_box'
                );
            END IF;
        END $$;
    """)

    # ═════════════════════════════════════════════════════════════════════════
    # 4. Ajouter les 29 nouvelles colonnes à biens
    # ═════════════════════════════════════════════════════════════════════════
    op.execute("""
        ALTER TABLE biens
            -- Identité & relations (5)
            ADD COLUMN IF NOT EXISTS agency_id           UUID REFERENCES users(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS created_by_id       UUID REFERENCES users(id) ON DELETE RESTRICT,
            ADD COLUMN IF NOT EXISTS building_name       VARCHAR(200),
            ADD COLUMN IF NOT EXISTS unit_number         VARCHAR(20),
            ADD COLUMN IF NOT EXISTS reference_number    VARCHAR(50),
            -- Localisation enrichie (1)
            ADD COLUMN IF NOT EXISTS canton              VARCHAR(2),
            -- Caractéristiques (5)
            ADD COLUMN IF NOT EXISTS rooms               NUMERIC(3,1),
            ADD COLUMN IF NOT EXISTS bedrooms            INTEGER,
            ADD COLUMN IF NOT EXISTS bathrooms           INTEGER,
            ADD COLUMN IF NOT EXISTS annee_construction  INTEGER,
            ADD COLUMN IF NOT EXISTS annee_renovation    INTEGER,
            -- Équipements (9)
            ADD COLUMN IF NOT EXISTS is_furnished            BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS has_balcony             BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS has_terrace             BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS has_garden              BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS has_storage             BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS has_fireplace           BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS has_laundry_private     BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS has_laundry_building    BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS classe_energetique      VARCHAR(2),
            -- Parking (1) — utilise l'enum
            ADD COLUMN IF NOT EXISTS parking_type        parking_type_enum,
            -- Règles (2)
            ADD COLUMN IF NOT EXISTS pets_allowed        BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS smoking_allowed     BOOLEAN NOT NULL DEFAULT FALSE,
            -- Situation / transports (6)
            ADD COLUMN IF NOT EXISTS distance_gare_minutes        INTEGER,
            ADD COLUMN IF NOT EXISTS distance_arret_bus_minutes   INTEGER,
            ADD COLUMN IF NOT EXISTS distance_telecabine_minutes  INTEGER,
            ADD COLUMN IF NOT EXISTS distance_lac_minutes         INTEGER,
            ADD COLUMN IF NOT EXISTS distance_aeroport_minutes    INTEGER,
            ADD COLUMN IF NOT EXISTS situation_notes              TEXT,
            -- Présentation (3)
            ADD COLUMN IF NOT EXISTS description_lieu     TEXT,
            ADD COLUMN IF NOT EXISTS description_logement TEXT,
            ADD COLUMN IF NOT EXISTS remarques            TEXT,
            -- Finances (1)
            ADD COLUMN IF NOT EXISTS deposit              NUMERIC(12,2),
            -- Opérationnel (1)
            ADD COLUMN IF NOT EXISTS keys_count           INTEGER DEFAULT 3
    """)

    # Contrainte classe énergétique (format CECB suisse : A..G)
    op.execute("ALTER TABLE biens DROP CONSTRAINT IF EXISTS biens_classe_energetique_fmt")
    op.execute("""
        ALTER TABLE biens ADD CONSTRAINT biens_classe_energetique_fmt
            CHECK (classe_energetique IS NULL OR classe_energetique ~ '^[A-G]$')
    """)

    # Contrainte cohérence années
    op.execute("ALTER TABLE biens DROP CONSTRAINT IF EXISTS biens_annee_renovation_after_construction")
    op.execute("""
        ALTER TABLE biens ADD CONSTRAINT biens_annee_renovation_after_construction
            CHECK (annee_renovation IS NULL OR annee_construction IS NULL
                   OR annee_renovation >= annee_construction)
    """)

    # ═════════════════════════════════════════════════════════════════════════
    # 5. Index sur nouvelles colonnes
    # ═════════════════════════════════════════════════════════════════════════
    op.execute("CREATE INDEX IF NOT EXISTS ix_biens_agency_id     ON biens(agency_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_biens_created_by_id ON biens(created_by_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_biens_canton        ON biens(canton) WHERE canton IS NOT NULL")
    op.execute("CREATE INDEX IF NOT EXISTS ix_biens_ville         ON biens(ville)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_biens_cp            ON biens(cp)")

    # ═════════════════════════════════════════════════════════════════════════
    # 6. Renommer property_id → bien_id + repointer FK vers biens(id)
    # ═════════════════════════════════════════════════════════════════════════
    for table, on_delete, _nullable in _TABLES_FK:
        op.execute(f"ALTER TABLE {table} DROP CONSTRAINT IF EXISTS {table}_property_id_fkey")
        op.execute(f"ALTER TABLE {table} RENAME COLUMN property_id TO bien_id")
        op.execute(f"""
            ALTER TABLE {table}
            ADD CONSTRAINT {table}_bien_id_fkey
            FOREIGN KEY (bien_id) REFERENCES biens(id) ON DELETE {on_delete}
        """)
        # Renommer l'index s'il existait avec l'ancien nom
        op.execute(f"ALTER INDEX IF EXISTS ix_{table}_property_id RENAME TO ix_{table}_bien_id")

    # Tables avec property_id SANS FK SQLAlchemy (UUID simple) : favorites, generated_documents
    # Renommer la colonne et la contrainte UNIQUE le cas échéant.
    op.execute("ALTER TABLE favorites RENAME COLUMN property_id TO bien_id")
    op.execute(
        "ALTER TABLE favorites "
        "DROP CONSTRAINT IF EXISTS uq_favorites_user_property"
    )
    op.execute(
        "ALTER TABLE favorites "
        "ADD CONSTRAINT uq_favorites_user_bien UNIQUE (user_id, bien_id)"
    )

    op.execute("ALTER TABLE generated_documents RENAME COLUMN property_id TO bien_id")

    # ═════════════════════════════════════════════════════════════════════════
    # 7. Créer bien_images
    # ═════════════════════════════════════════════════════════════════════════
    op.execute("""
        CREATE TABLE IF NOT EXISTS bien_images (
            id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
            bien_id    UUID         NOT NULL REFERENCES biens(id) ON DELETE CASCADE,
            url        TEXT         NOT NULL,
            "order"    INTEGER      NOT NULL DEFAULT 0,
            is_cover   BOOLEAN      NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
            is_active  BOOLEAN      NOT NULL DEFAULT TRUE
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_bien_images_bien_id ON bien_images(bien_id)")
    op.execute('CREATE INDEX IF NOT EXISTS ix_bien_images_order   ON bien_images(bien_id, "order")')

    # ═════════════════════════════════════════════════════════════════════════
    # 8. Créer bien_documents
    # ═════════════════════════════════════════════════════════════════════════
    op.execute("""
        CREATE TABLE IF NOT EXISTS bien_documents (
            id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
            bien_id    UUID         NOT NULL REFERENCES biens(id) ON DELETE CASCADE,
            type       VARCHAR(30)  NOT NULL,
            url        TEXT         NOT NULL,
            name       VARCHAR(255) NOT NULL,
            created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
            is_active  BOOLEAN      NOT NULL DEFAULT TRUE
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_bien_documents_bien_id ON bien_documents(bien_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_bien_documents_type    ON bien_documents(type)")

    # ═════════════════════════════════════════════════════════════════════════
    # 9. Créer catalogue_equipements + seed
    # ═════════════════════════════════════════════════════════════════════════
    op.execute("""
        CREATE TABLE IF NOT EXISTS catalogue_equipements (
            id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
            nom             VARCHAR(100) NOT NULL UNIQUE,
            categorie       VARCHAR(30)  NOT NULL,
            icone           VARCHAR(50),
            ordre_affichage INTEGER      NOT NULL DEFAULT 0,
            is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
            created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
            updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
        )
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_catalogue_equipements_categorie
            ON catalogue_equipements(categorie)
    """)

    # Contrainte enum-like sur categorie (7 valeurs)
    op.execute("ALTER TABLE catalogue_equipements DROP CONSTRAINT IF EXISTS catalogue_equipements_categorie_valid")
    op.execute("""
        ALTER TABLE catalogue_equipements ADD CONSTRAINT catalogue_equipements_categorie_valid
            CHECK (categorie IN ('cuisine', 'literie', 'salle_bain', 'tech',
                                 'loisirs', 'entretien', 'confort'))
    """)

    # Seed catalogue — 49 équipements
    op.execute("""
        INSERT INTO catalogue_equipements (nom, categorie, icone, ordre_affichage) VALUES
            -- CUISINE (16)
            ('Machine à café Nespresso',      'cuisine',    'coffee',           10),
            ('Machine à café à grains',       'cuisine',    'coffee',           11),
            ('Bouilloire',                    'cuisine',    'kettle',           12),
            ('Grille-pain',                   'cuisine',    'sandwich',         13),
            ('Micro-ondes',                   'cuisine',    'microwave',        14),
            ('Four',                          'cuisine',    'oven',             15),
            ('Plaques induction',             'cuisine',    'flame',            16),
            ('Lave-vaisselle',                'cuisine',    'washing-machine',  17),
            ('Réfrigérateur',                 'cuisine',    'refrigerator',     18),
            ('Congélateur',                   'cuisine',    'snowflake',        19),
            ('Robot cuisinier',               'cuisine',    'chef-hat',         20),
            ('Vaisselle complète (6 pers.)',  'cuisine',    'utensils',         21),
            ('Verres à vin',                  'cuisine',    'wine',             22),
            ('Couverts inox',                 'cuisine',    'utensils-crossed', 23),
            ('Casseroles et poêles',          'cuisine',    'cooking-pot',      24),
            ('Torchons',                      'cuisine',    'square',           25),

            -- LITERIE (7)
            ('Draps',                         'literie',    'bed',              30),
            ('Housses de couette',            'literie',    'bed-double',       31),
            ('Oreillers',                     'literie',    'pillow',           32),
            ('Couvertures',                   'literie',    'blanket',          33),
            ('Linge de lit complet',          'literie',    'bed-double',       34),
            ('Lit bébé',                      'literie',    'baby',             35),
            ('Chaise haute',                  'literie',    'baby',             36),

            -- SALLE_BAIN (5)
            ('Serviettes de bain',            'salle_bain', 'bath',             40),
            ('Serviettes de douche',          'salle_bain', 'droplet',          41),
            ('Tapis de bain',                 'salle_bain', 'square',           42),
            ('Sèche-cheveux',                 'salle_bain', 'wind',             43),
            ('Peignoirs',                     'salle_bain', 'shirt',            44),

            -- TECH (6)
            ('Wi-Fi fibre',                   'tech',       'wifi',             50),
            ('TV 4K',                         'tech',       'tv',               51),
            ('Netflix',                       'tech',       'play',             52),
            ('Enceinte Bluetooth',            'tech',       'speaker',          53),
            ('Chargeurs USB-C',               'tech',       'plug-zap',         54),
            ('Chargeurs iPhone',              'tech',       'smartphone',       55),

            -- LOISIRS (5)
            ('Livres',                        'loisirs',    'book-open',        60),
            ('Jeux de société',               'loisirs',    'dices',            61),
            ('Console de jeu',                'loisirs',    'gamepad-2',        62),
            ('Vélos',                         'loisirs',    'bike',             63),
            ('Skis (saison hiver)',           'loisirs',    'snowflake',        64),

            -- ENTRETIEN (4)
            ('Aspirateur',                    'entretien',  'wind',             70),
            ('Fer à repasser',                'entretien',  'iron',             71),
            ('Planche à repasser',            'entretien',  'table',            72),
            ('Produits ménagers de base',     'entretien',  'spray-can',        73),

            -- CONFORT (6)
            ('Climatisation',                 'confort',    'air-vent',         80),
            ('Chauffage au sol',              'confort',    'thermometer',      81),
            ('Cheminée fonctionnelle',        'confort',    'flame',            82),
            ('Humidificateur',                'confort',    'droplets',         83),
            ('Ventilateur',                   'confort',    'fan',              84),
            ('Coffre-fort',                   'confort',    'lock',             85)
        ON CONFLICT (nom) DO NOTHING
    """)

    # ═════════════════════════════════════════════════════════════════════════
    # 10. Créer bien_equipements (jonction N:N bien ⇄ catalogue)
    # ═════════════════════════════════════════════════════════════════════════
    op.execute("""
        CREATE TABLE IF NOT EXISTS bien_equipements (
            id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            bien_id       UUID        NOT NULL REFERENCES biens(id) ON DELETE CASCADE,
            equipement_id UUID        NOT NULL REFERENCES catalogue_equipements(id) ON DELETE RESTRICT,
            created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE(bien_id, equipement_id)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_bien_equipements_bien ON bien_equipements(bien_id)")

    # ═════════════════════════════════════════════════════════════════════════
    # 11. Créer ch_postal_codes + seed NPA → canton (environ 230 NPAs)
    # ═════════════════════════════════════════════════════════════════════════
    op.execute("""
        CREATE TABLE IF NOT EXISTS ch_postal_codes (
            code_postal      VARCHAR(4) PRIMARY KEY,
            canton           VARCHAR(2) NOT NULL,
            ville_principale VARCHAR(100) NOT NULL
        )
    """)

    # Seed Phase 1 — couverture prioritaire Suisse romande + chefs-lieux secondaires.
    # Source : connaissance générale des codes postaux CH + priorités Sunimmo.
    # Enrichissable plus tard avec le CSV officiel Swisstopo (~4100 NPAs).
    op.execute("""
        INSERT INTO ch_postal_codes (code_postal, canton, ville_principale) VALUES
            -- ═══ GE — GENÈVE (47) ═══
            ('1200', 'GE', 'Genève'),
            ('1201', 'GE', 'Genève'),
            ('1202', 'GE', 'Genève'),
            ('1203', 'GE', 'Genève'),
            ('1204', 'GE', 'Genève'),
            ('1205', 'GE', 'Genève'),
            ('1206', 'GE', 'Genève'),
            ('1207', 'GE', 'Genève'),
            ('1208', 'GE', 'Genève'),
            ('1209', 'GE', 'Genève'),
            ('1211', 'GE', 'Genève'),
            ('1212', 'GE', 'Grand-Lancy'),
            ('1213', 'GE', 'Onex'),
            ('1214', 'GE', 'Vernier'),
            ('1216', 'GE', 'Cointrin'),
            ('1217', 'GE', 'Meyrin'),
            ('1218', 'GE', 'Le Grand-Saconnex'),
            ('1219', 'GE', 'Châtelaine'),
            ('1220', 'GE', 'Les Avanchets'),
            ('1222', 'GE', 'Vésenaz'),
            ('1223', 'GE', 'Cologny'),
            ('1224', 'GE', 'Chêne-Bougeries'),
            ('1225', 'GE', 'Chêne-Bourg'),
            ('1226', 'GE', 'Thônex'),
            ('1227', 'GE', 'Carouge'),
            ('1228', 'GE', 'Plan-les-Ouates'),
            ('1231', 'GE', 'Conches'),
            ('1232', 'GE', 'Confignon'),
            ('1233', 'GE', 'Bernex'),
            ('1236', 'GE', 'Cartigny'),
            ('1237', 'GE', 'Avully'),
            ('1242', 'GE', 'Satigny'),
            ('1245', 'GE', 'Collonge-Bellerive'),
            ('1246', 'GE', 'Corsier GE'),
            ('1247', 'GE', 'Anières'),
            ('1248', 'GE', 'Hermance'),
            ('1252', 'GE', 'Meinier'),
            ('1253', 'GE', 'Vandœuvres'),
            ('1254', 'GE', 'Jussy'),
            ('1255', 'GE', 'Veyrier'),
            ('1256', 'GE', 'Troinex'),
            ('1258', 'GE', 'Perly'),
            ('1283', 'GE', 'Dardagny'),
            ('1284', 'GE', 'Chancy'),
            ('1290', 'GE', 'Versoix'),
            ('1293', 'GE', 'Bellevue'),
            ('1294', 'GE', 'Genthod'),

            -- ═══ VD — VAUD (65) ═══
            ('1000', 'VD', 'Lausanne'),
            ('1003', 'VD', 'Lausanne'),
            ('1004', 'VD', 'Lausanne'),
            ('1005', 'VD', 'Lausanne'),
            ('1006', 'VD', 'Lausanne'),
            ('1007', 'VD', 'Lausanne'),
            ('1010', 'VD', 'Lausanne'),
            ('1012', 'VD', 'Lausanne'),
            ('1015', 'VD', 'Lausanne'),
            ('1018', 'VD', 'Lausanne'),
            ('1020', 'VD', 'Renens'),
            ('1022', 'VD', 'Chavannes-près-Renens'),
            ('1023', 'VD', 'Crissier'),
            ('1024', 'VD', 'Ecublens'),
            ('1025', 'VD', 'St-Sulpice'),
            ('1026', 'VD', 'Denges'),
            ('1028', 'VD', 'Préverenges'),
            ('1030', 'VD', 'Bussigny'),
            ('1032', 'VD', 'Romanel-sur-Lausanne'),
            ('1033', 'VD', 'Cheseaux-sur-Lausanne'),
            ('1040', 'VD', 'Echallens'),
            ('1052', 'VD', 'Le Mont-sur-Lausanne'),
            ('1066', 'VD', 'Epalinges'),
            ('1068', 'VD', 'Les Monts-de-Pully'),
            ('1070', 'VD', 'Puidoux'),
            ('1071', 'VD', 'Chexbres'),
            ('1073', 'VD', 'Savigny'),
            ('1091', 'VD', 'Grandvaux'),
            ('1092', 'VD', 'Belmont-sur-Lausanne'),
            ('1093', 'VD', 'La Conversion'),
            ('1094', 'VD', 'Paudex'),
            ('1095', 'VD', 'Lutry'),
            ('1096', 'VD', 'Cully'),
            ('1110', 'VD', 'Morges'),
            ('1170', 'VD', 'Aubonne'),
            ('1180', 'VD', 'Rolle'),
            ('1196', 'VD', 'Gland'),
            ('1197', 'VD', 'Prangins'),
            ('1260', 'VD', 'Nyon'),
            ('1295', 'VD', 'Mies'),
            ('1296', 'VD', 'Coppet'),
            ('1297', 'VD', 'Founex'),
            ('1400', 'VD', 'Yverdon-les-Bains'),
            ('1510', 'VD', 'Moudon'),
            ('1530', 'VD', 'Payerne'),
            ('1580', 'VD', 'Avenches'),
            ('1800', 'VD', 'Vevey'),
            ('1801', 'VD', 'Le Mont-Pèlerin'),
            ('1802', 'VD', 'Corseaux'),
            ('1803', 'VD', 'Chardonne'),
            ('1804', 'VD', 'Corsier-sur-Vevey'),
            ('1806', 'VD', 'St-Légier-La Chiésaz'),
            ('1807', 'VD', 'Blonay'),
            ('1814', 'VD', 'La Tour-de-Peilz'),
            ('1815', 'VD', 'Clarens'),
            ('1820', 'VD', 'Montreux'),
            ('1822', 'VD', 'Chernex'),
            ('1823', 'VD', 'Glion'),
            ('1824', 'VD', 'Caux'),
            ('1844', 'VD', 'Villeneuve'),
            ('1852', 'VD', 'Roche VD'),
            ('1854', 'VD', 'Leysin'),
            ('1860', 'VD', 'Aigle'),
            ('1865', 'VD', 'Les Diablerets'),
            ('1880', 'VD', 'Bex'),
            ('1884', 'VD', 'Villars-sur-Ollon'),
            ('1885', 'VD', 'Chesières'),

            -- ═══ VS — VALAIS (55) — incluant priorités Sunimmo ═══
            ('1890', 'VS', 'St-Maurice'),
            ('1895', 'VS', 'Vionnaz'),
            ('1896', 'VS', 'Vouvry'),
            ('1897', 'VS', 'Le Bouveret'),
            ('1902', 'VS', 'Evionnaz'),
            ('1904', 'VS', 'Vernayaz'),
            ('1907', 'VS', 'Saxon'),
            ('1908', 'VS', 'Riddes'),
            ('1912', 'VS', 'Leytron'),
            ('1913', 'VS', 'Saillon'),
            ('1920', 'VS', 'Martigny'),
            ('1921', 'VS', 'Martigny-Croix'),
            ('1926', 'VS', 'Fully'),
            ('1933', 'VS', 'Sembrancher'),
            ('1934', 'VS', 'Le Châble VS'),
            ('1936', 'VS', 'Verbier'),
            ('1937', 'VS', 'Orsières'),
            ('1938', 'VS', 'Champex-Lac'),
            ('1950', 'VS', 'Sion'),
            ('1955', 'VS', 'Chamoson'),
            ('1957', 'VS', 'Ardon'),
            ('1958', 'VS', 'St-Léonard'),
            ('1962', 'VS', 'Pont-de-la-Morge'),
            ('1963', 'VS', 'Vétroz'),
            ('1964', 'VS', 'Conthey'),
            ('1965', 'VS', 'Savièse'),
            ('1966', 'VS', 'Ayent'),
            ('1967', 'VS', 'Bramois'),
            ('1971', 'VS', 'Grimisuat'),
            ('1972', 'VS', 'Anzère'),
            ('1978', 'VS', 'Lens'),
            ('1983', 'VS', 'Evolène'),
            ('1987', 'VS', 'Hérémence'),
            ('1997', 'VS', 'Haute-Nendaz'),
            ('3900', 'VS', 'Brig'),
            ('3904', 'VS', 'Naters'),
            ('3906', 'VS', 'Saas-Fee'),
            ('3910', 'VS', 'Saas-Grund'),
            ('3920', 'VS', 'Zermatt'),
            ('3925', 'VS', 'Grächen'),
            ('3929', 'VS', 'Täsch'),
            ('3930', 'VS', 'Visp'),
            ('3940', 'VS', 'Steg'),
            ('3941', 'VS', 'Gampel'),
            ('3944', 'VS', 'Unterbäch'),
            ('3952', 'VS', 'Susten'),
            ('3954', 'VS', 'Leukerbad'),
            ('3960', 'VS', 'Sierre'),
            ('3961', 'VS', 'Chandolin'),
            ('3962', 'VS', 'Montana'),
            ('3963', 'VS', 'Crans-Montana'),
            ('3965', 'VS', 'Chippis'),
            ('3966', 'VS', 'Chalais'),
            ('3967', 'VS', 'Vercorin'),
            ('3970', 'VS', 'Salgesch'),

            -- ═══ FR — FRIBOURG (18) ═══
            ('1700', 'FR', 'Fribourg'),
            ('1701', 'FR', 'Fribourg'),
            ('1702', 'FR', 'Fribourg'),
            ('1712', 'FR', 'Tafers'),
            ('1720', 'FR', 'Corminboeuf'),
            ('1723', 'FR', 'Marly'),
            ('1725', 'FR', 'Posieux'),
            ('1740', 'FR', 'Neyruz FR'),
            ('1752', 'FR', 'Villars-sur-Glâne'),
            ('1762', 'FR', 'Givisiez'),
            ('1763', 'FR', 'Granges-Paccot'),
            ('1772', 'FR', 'Grolley'),
            ('1782', 'FR', 'Belfaux'),
            ('1784', 'FR', 'Courtepin'),
            ('1630', 'FR', 'Bulle'),
            ('1636', 'FR', 'Broc'),
            ('1663', 'FR', 'Moléson-sur-Gruyères'),
            ('1680', 'FR', 'Romont FR'),

            -- ═══ NE — NEUCHÂTEL (14) ═══
            ('2000', 'NE', 'Neuchâtel'),
            ('2013', 'NE', 'Colombier NE'),
            ('2014', 'NE', 'Bôle'),
            ('2016', 'NE', 'Cortaillod'),
            ('2017', 'NE', 'Boudry'),
            ('2022', 'NE', 'Bevaix'),
            ('2034', 'NE', 'Peseux'),
            ('2053', 'NE', 'Cernier'),
            ('2068', 'NE', 'Hauterive NE'),
            ('2072', 'NE', 'St-Blaise'),
            ('2074', 'NE', 'Marin-Epagnier'),
            ('2088', 'NE', 'Cressier NE'),
            ('2114', 'NE', 'Fleurier'),
            ('2300', 'NE', 'La Chaux-de-Fonds'),
            ('2400', 'NE', 'Le Locle'),

            -- ═══ JU — JURA (10) ═══
            ('2800', 'JU', 'Delémont'),
            ('2830', 'JU', 'Courrendlin'),
            ('2853', 'JU', 'Courtételle'),
            ('2854', 'JU', 'Bassecourt'),
            ('2855', 'JU', 'Glovelier'),
            ('2900', 'JU', 'Porrentruy'),
            ('2902', 'JU', 'Fontenais'),
            ('2905', 'JU', 'Courtedoux'),
            ('2942', 'JU', 'Alle'),
            ('2950', 'JU', 'Courgenay'),

            -- ═══ ZH — ZÜRICH ville (13) ═══
            ('8000', 'ZH', 'Zürich'),
            ('8001', 'ZH', 'Zürich'),
            ('8002', 'ZH', 'Zürich'),
            ('8003', 'ZH', 'Zürich'),
            ('8004', 'ZH', 'Zürich'),
            ('8005', 'ZH', 'Zürich'),
            ('8006', 'ZH', 'Zürich'),
            ('8008', 'ZH', 'Zürich'),
            ('8032', 'ZH', 'Zürich'),
            ('8050', 'ZH', 'Zürich'),
            ('8053', 'ZH', 'Zürich'),
            ('8055', 'ZH', 'Zürich'),
            ('8057', 'ZH', 'Zürich'),

            -- ═══ BE — BERNE ville (10) ═══
            ('3000', 'BE', 'Bern'),
            ('3001', 'BE', 'Bern'),
            ('3005', 'BE', 'Bern'),
            ('3006', 'BE', 'Bern'),
            ('3007', 'BE', 'Bern'),
            ('3008', 'BE', 'Bern'),
            ('3010', 'BE', 'Bern'),
            ('3012', 'BE', 'Bern'),
            ('3013', 'BE', 'Bern'),
            ('3014', 'BE', 'Bern'),

            -- ═══ BS — BÂLE ville (8) ═══
            ('4000', 'BS', 'Basel'),
            ('4001', 'BS', 'Basel'),
            ('4051', 'BS', 'Basel'),
            ('4052', 'BS', 'Basel'),
            ('4053', 'BS', 'Basel'),
            ('4054', 'BS', 'Basel'),
            ('4055', 'BS', 'Basel'),
            ('4056', 'BS', 'Basel'),

            -- ═══ TI — LUGANO zone (7) ═══
            ('6900', 'TI', 'Lugano'),
            ('6901', 'TI', 'Lugano'),
            ('6903', 'TI', 'Lugano'),
            ('6932', 'TI', 'Breganzona'),
            ('6962', 'TI', 'Viganello'),
            ('6976', 'TI', 'Castagnola'),
            ('6977', 'TI', 'Ruvigliana')
        ON CONFLICT (code_postal) DO NOTHING
    """)

    # ═════════════════════════════════════════════════════════════════════════
    # 12. Drop properties et les enums legacy
    # ═════════════════════════════════════════════════════════════════════════
    # Note : les tables annexes property_images / property_documents ont déjà été
    # droppées à l'étape 2 pour permettre les renames FK. La table `properties`
    # elle-même ne peut être droppée qu'après les renommages FK, car
    # elle pouvait être référencée par des FK entrantes encore non renommées.
    op.execute("DROP TABLE IF EXISTS properties CASCADE")
    op.execute("DROP TYPE IF EXISTS property_type_enum")
    op.execute("DROP TYPE IF EXISTS property_status_enum")
    op.execute("DROP TYPE IF EXISTS property_document_type_enum")


def downgrade() -> None:
    """Downgrade non implémenté — la fusion est destructive.

    Pour revenir en arrière : restaurer un backup Supabase antérieur à la migration.
    Aucune donnée métier à récupérer côté properties (wipe accepté par le fondateur).
    """
    raise NotImplementedError(
        "Fusion properties→biens non réversible (destructive). "
        "Restaurer un backup Supabase antérieur pour revenir en arrière."
    )
