"""Normalize legacy roles (owner→proprio_solo, agency→agence, tenant→locataire, company→artisan).

Adds CHECK constraint to prevent re-insertion of legacy role values.
"""

from alembic import op

revision = "0028"
down_revision = "0027"

# ── Canonical roles allowed after migration ──────────────────────────────────

CANONICAL_ROLES = (
    "super_admin",
    "proprio_solo",
    "agence",
    "portail_proprio",
    "opener",
    "artisan",
    "expert",
    "hunter",
    "locataire",
    "acheteur_premium",
)

LEGACY_MAP = {
    "owner":   "proprio_solo",
    "agency":  "agence",
    "tenant":  "locataire",
    "company": "artisan",
}


def upgrade():
    # 1. Rename legacy roles to canonical names
    for old, new in LEGACY_MAP.items():
        op.execute(f"UPDATE users SET role = '{new}' WHERE role = '{old}';")

    # 2. Also normalize in auth.users metadata (Supabase)
    for old, new in LEGACY_MAP.items():
        op.execute(f"""
            UPDATE auth.users
            SET raw_user_meta_data = jsonb_set(raw_user_meta_data, '{{role}}', '"{new}"')
            WHERE raw_user_meta_data->>'role' = '{old}';
        """)

    # 3. Add CHECK constraint — prevent legacy roles from being inserted again
    roles_list = ", ".join(f"'{r}'" for r in CANONICAL_ROLES)
    op.execute(f"""
        ALTER TABLE users
        ADD CONSTRAINT chk_role_canonical
        CHECK (role::text IN ({roles_list}));
    """)

    # 4. Remove legacy values from the PostgreSQL ENUM type
    #    Strategy: create new enum, drop default, alter column, drop old enum, restore default
    #    (PostgreSQL does not support DROP VALUE from enum directly)
    #    Must drop DEFAULT first — PostgreSQL cannot auto-cast it to the new enum type.
    new_values = ", ".join(f"'{r}'" for r in CANONICAL_ROLES)
    op.execute(f"CREATE TYPE user_role_enum_v2 AS ENUM ({new_values});")
    op.execute("ALTER TABLE users ALTER COLUMN role DROP DEFAULT;")
    op.execute("""
        ALTER TABLE users
        ALTER COLUMN role TYPE user_role_enum_v2
        USING role::text::user_role_enum_v2;
    """)
    op.execute("DROP TYPE IF EXISTS user_role_enum;")
    op.execute("ALTER TYPE user_role_enum_v2 RENAME TO user_role_enum;")
    op.execute("ALTER TABLE users ALTER COLUMN role SET DEFAULT 'proprio_solo';")


def downgrade():
    # Recreate enum with legacy values
    all_roles = list(CANONICAL_ROLES) + list(LEGACY_MAP.keys())
    all_values = ", ".join(f"'{r}'" for r in all_roles)
    op.execute(f"CREATE TYPE user_role_enum_v2 AS ENUM ({all_values});")
    op.execute("ALTER TABLE users ALTER COLUMN role DROP DEFAULT;")
    op.execute("""
        ALTER TABLE users
        ALTER COLUMN role TYPE user_role_enum_v2
        USING role::text::user_role_enum_v2;
    """)
    op.execute("DROP TYPE IF EXISTS user_role_enum;")
    op.execute("ALTER TYPE user_role_enum_v2 RENAME TO user_role_enum;")
    op.execute("ALTER TABLE users ALTER COLUMN role SET DEFAULT 'proprio_solo';")

    # Drop the CHECK constraint
    op.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_role_canonical;")

    # Reverse role renames
    for old, new in LEGACY_MAP.items():
        op.execute(f"UPDATE users SET role = '{old}' WHERE role = '{new}';")
        op.execute(f"""
            UPDATE auth.users
            SET raw_user_meta_data = jsonb_set(raw_user_meta_data, '{{role}}', '"{old}"')
            WHERE raw_user_meta_data->>'role' = '{new}';
        """)
