"""PostGIS — spatial extension + location columns + indexes.

Revision: 0020
Creates:
  - PostGIS extension (idempotent)
  - location GEOMETRY(Point, 4326) on properties, profiles
  - intervention_radius_km on profiles
  - temp_zones JSONB on profiles
  - Spatial GIST indexes for proximity queries
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0020"
down_revision = "0019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── PostGIS extension ─────────────────────────────────────────────────────
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    # ── Properties: location point ────────────────────────────────────────────
    op.execute("""
        ALTER TABLE properties
        ADD COLUMN IF NOT EXISTS lat FLOAT,
        ADD COLUMN IF NOT EXISTS lng FLOAT,
        ADD COLUMN IF NOT EXISTS location GEOMETRY(Point, 4326)
    """)

    # Populate geometry from existing lat/lng if any
    op.execute("""
        UPDATE properties
        SET location = ST_SetSRID(ST_MakePoint(lng, lat), 4326)
        WHERE lat IS NOT NULL AND lng IS NOT NULL AND location IS NULL
    """)

    # ── Profiles: zone fields ─────────────────────────────────────────────────
    op.execute("""
        ALTER TABLE profiles
        ADD COLUMN IF NOT EXISTS primary_lat FLOAT,
        ADD COLUMN IF NOT EXISTS primary_lng FLOAT,
        ADD COLUMN IF NOT EXISTS primary_address TEXT,
        ADD COLUMN IF NOT EXISTS location GEOMETRY(Point, 4326),
        ADD COLUMN IF NOT EXISTS intervention_radius_km INTEGER DEFAULT 20,
        ADD COLUMN IF NOT EXISTS temp_zones JSONB DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS availability JSONB DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS notice_hours TEXT DEFAULT '2h',
        ADD COLUMN IF NOT EXISTS max_simultaneous INTEGER DEFAULT 2,
        ADD COLUMN IF NOT EXISTS hourly_rate FLOAT,
        ADD COLUMN IF NOT EXISTS vacances_mode BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS vacances_from DATE,
        ADD COLUMN IF NOT EXISTS vacances_to DATE
    """)

    op.execute("""
        UPDATE profiles
        SET location = ST_SetSRID(ST_MakePoint(primary_lng, primary_lat), 4326)
        WHERE primary_lat IS NOT NULL AND primary_lng IS NOT NULL AND location IS NULL
    """)

    # ── Spatial indexes ───────────────────────────────────────────────────────
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_properties_location
        ON properties USING GIST(location)
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_profiles_location
        ON profiles USING GIST(location)
    """)

    # ── Function: find openers within radius ───────────────────────────────────
    # role is stored in users table, not profiles — join accordingly.
    # is_active is also on users, not profiles.
    op.execute("""
        CREATE OR REPLACE FUNCTION find_nearby_openers(
            p_lat FLOAT,
            p_lng FLOAT,
            p_radius_km INTEGER DEFAULT 20,
            p_date DATE DEFAULT NULL
        )
        RETURNS TABLE (
            profile_id UUID,
            user_id UUID,
            distance_km FLOAT,
            lat FLOAT,
            lng FLOAT,
            intervention_radius_km INTEGER,
            hourly_rate FLOAT
        )
        LANGUAGE SQL STABLE AS $$
            SELECT
                pr.id          AS profile_id,
                pr.user_id,
                ST_Distance(
                    pr.location::geography,
                    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
                ) / 1000.0     AS distance_km,
                pr.primary_lat AS lat,
                pr.primary_lng AS lng,
                pr.intervention_radius_km,
                pr.hourly_rate
            FROM profiles pr
            JOIN users u ON u.id = pr.user_id
            WHERE
                pr.location IS NOT NULL
                AND u.role IN ('opener', 'artisan', 'expert')
                AND u.is_active = TRUE
                AND (pr.vacances_mode IS FALSE OR pr.vacances_mode IS NULL)
                AND ST_DWithin(
                    pr.location::geography,
                    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
                    p_radius_km * 1000.0
                )
            ORDER BY distance_km ASC
            LIMIT 50
        $$
    """)


def downgrade() -> None:
    op.execute("DROP FUNCTION IF EXISTS find_nearby_openers")
    op.execute("DROP INDEX IF EXISTS idx_profiles_location")
    op.execute("DROP INDEX IF EXISTS idx_properties_location")
    # Note: not dropping PostGIS extension as it may be used elsewhere
    # Note: not dropping columns to preserve data
