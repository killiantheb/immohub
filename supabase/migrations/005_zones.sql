-- ═══════════════════════════════════════════════════════════════════════════
-- 005_zones.sql — table zones + PostGIS + index spatial
--                 + fonction find_openers_in_zone(lat, lng, radius_km)
-- Utilisé par : openers, artisans, experts, hunters pour définir leur
-- zone d'intervention ; missions pour le matching géographique.
-- ═══════════════════════════════════════════════════════════════════════════

-- Extension PostGIS (idempotente)
CREATE EXTENSION IF NOT EXISTS postgis;

-- ── Table zones ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS zones (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Type de zone
    zone_type       VARCHAR(20)  NOT NULL DEFAULT 'primary',
    -- primary : zone principale (une seule par utilisateur)
    -- temporary : zone ponctuelle avec dates de validité

    -- Géolocalisation
    location        GEOMETRY(Point, 4326) NOT NULL,
    -- SRID 4326 = WGS 84 (latitude/longitude standard)
    lat             FLOAT        NOT NULL,
    -- Redondant avec location pour requêtes simples sans PostGIS
    lng             FLOAT        NOT NULL,
    address         VARCHAR(300),
    city            VARCHAR(100),
    zip_code        VARCHAR(10),
    canton          VARCHAR(2),

    -- Rayon d'intervention
    radius_km       FLOAT        NOT NULL DEFAULT 20,
    -- En kilomètres

    -- Validité (zones temporaires)
    valid_from      DATE,
    valid_until     DATE,

    -- Métadonnées
    label           VARCHAR(100),
    -- Ex: "Genève centre", "Mission Lausanne mars"
    notes           TEXT,

    is_active       BOOLEAN      NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ── Index ─────────────────────────────────────────────────────────────────────

-- Index spatial GIST sur la géométrie (essentiel pour ST_DWithin)
CREATE INDEX IF NOT EXISTS ix_zones_location
    ON zones USING GIST(location);

-- Index standard pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS ix_zones_user_id
    ON zones(user_id);
CREATE INDEX IF NOT EXISTS ix_zones_type_active
    ON zones(zone_type, is_active);
CREATE INDEX IF NOT EXISTS ix_zones_city
    ON zones(city);

-- Trigger updated_at (réutilise la fonction créée dans 004_settings.sql)
DROP TRIGGER IF EXISTS trg_zones_updated_at ON zones;
CREATE TRIGGER trg_zones_updated_at
    BEFORE UPDATE ON zones
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Contrainte : une seule zone primaire active par utilisateur ───────────────
CREATE UNIQUE INDEX IF NOT EXISTS uq_zones_primary_per_user
    ON zones(user_id)
    WHERE zone_type = 'primary' AND is_active = true;

-- ── Fonction find_openers_in_zone ─────────────────────────────────────────────
-- Retourne les prestataires (openers/artisans/experts) dont la zone
-- d'intervention couvre le point (p_lat, p_lng).
-- Utilise ST_DWithin sur géographie (sphère) pour un calcul exact en mètres.
--
-- Paramètres :
--   p_lat       FLOAT    — latitude du point de mission
--   p_lng       FLOAT    — longitude du point de mission
--   p_radius_km FLOAT    — rayon de recherche additionnel (en km, défaut 0)
--                          s'ajoute au rayon déclaré par le prestataire
--
-- Retourne : user_id, lat, lng, radius_km, distance_km (trié par distance)

CREATE OR REPLACE FUNCTION find_openers_in_zone(
    p_lat       FLOAT,
    p_lng       FLOAT,
    p_radius_km FLOAT DEFAULT 0
)
RETURNS TABLE (
    user_id     UUID,
    lat         FLOAT,
    lng         FLOAT,
    radius_km   FLOAT,
    distance_km FLOAT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
    SELECT
        z.user_id,
        z.lat,
        z.lng,
        z.radius_km,
        -- Distance en km entre le point de mission et le centre de la zone
        ROUND(
            (ST_Distance(
                z.location::geography,
                ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
            ) / 1000.0)::NUMERIC,
            2
        )::FLOAT AS distance_km
    FROM zones z
    INNER JOIN profiles pr ON pr.user_id = z.user_id
    WHERE
        z.is_active = true
        AND z.zone_type = 'primary'
        -- Le point de mission est dans le rayon d'intervention du prestataire
        -- (rayon déclaré + rayon de recherche additionnel)
        AND ST_DWithin(
            z.location::geography,
            ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
            (z.radius_km + p_radius_km) * 1000  -- conversion km → mètres
        )
        -- Uniquement les rôles marketplace
        AND pr.role IN ('opener', 'artisan', 'expert')
        -- Zone temporaire : vérification de validité si applicable
        AND (
            z.valid_from  IS NULL OR z.valid_from  <= CURRENT_DATE
        )
        AND (
            z.valid_until IS NULL OR z.valid_until >= CURRENT_DATE
        )
    ORDER BY distance_km ASC
$$;

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE zones FORCE ROW LEVEL SECURITY;

-- SELECT : l'utilisateur voit ses propres zones + les zones des autres
-- prestataires (nécessaire pour le matching missions)
-- Les zones primaires actives des prestataires sont visibles par tous
-- (les propriétaires ont besoin de voir qui est disponible dans leur secteur).
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'zones' AND policyname = 'zones_own'
    ) THEN
        CREATE POLICY zones_own ON zones
            FOR ALL USING (user_id = auth.uid());
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'zones' AND policyname = 'zones_public_read'
    ) THEN
        -- Lecture publique des zones primaires actives (pour matching)
        CREATE POLICY zones_public_read ON zones
            FOR SELECT
            USING (
                is_active = true
                AND zone_type = 'primary'
                AND user_id IN (
                    SELECT user_id FROM profiles
                    WHERE role IN ('opener', 'artisan', 'expert')
                )
            );
    END IF;
END $$;
