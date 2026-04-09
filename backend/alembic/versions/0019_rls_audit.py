"""0019 — RLS audit : enable RLS + policies on all sprint 6-9 tables."""

from __future__ import annotations
from alembic import op
import sqlalchemy as sa

revision = "0019"
down_revision = "0018"
branch_labels = None
depends_on = None


def _exec(sql: str) -> None:
    """Execute a single SQL statement — asyncpg forbids multi-statement strings."""
    op.execute(sa.text(sql.strip()))


def _rls(table: str, *policies: str) -> None:
    """Enable RLS on table, then execute each policy statement individually."""
    _exec(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
    for stmt in policies:
        _exec(stmt)


def upgrade() -> None:
    # ── helpers (idempotent) ─────────────────────────────────────────────────
    _exec("""
        CREATE OR REPLACE FUNCTION althy_current_user_id()
        RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
          SELECT id FROM users WHERE supabase_uid = auth.uid()::text
        $$
    """)
    _exec("""
        CREATE OR REPLACE FUNCTION althy_current_role()
        RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
          SELECT role FROM users WHERE supabase_uid = auth.uid()::text
        $$
    """)

    # ── user_integrations ─────────────────────────────────────────────────────
    _rls("user_integrations",
        "DROP POLICY IF EXISTS admin_all_user_integrations ON user_integrations",
        """CREATE POLICY admin_all_user_integrations ON user_integrations
            FOR ALL TO authenticated
            USING (althy_current_role() IN ('admin','super_admin'))""",
        "DROP POLICY IF EXISTS owner_own_integrations ON user_integrations",
        """CREATE POLICY owner_own_integrations ON user_integrations
            FOR ALL TO authenticated
            USING (user_id = althy_current_user_id())""",
    )

    # ── calendar_events ───────────────────────────────────────────────────────
    _rls("calendar_events",
        "DROP POLICY IF EXISTS admin_all_calendar_events ON calendar_events",
        """CREATE POLICY admin_all_calendar_events ON calendar_events
            FOR ALL TO authenticated
            USING (althy_current_role() IN ('admin','super_admin'))""",
        "DROP POLICY IF EXISTS owner_own_calendar_events ON calendar_events",
        """CREATE POLICY owner_own_calendar_events ON calendar_events
            FOR ALL TO authenticated
            USING (user_id = althy_current_user_id())""",
    )

    # ── depenses_scannees ─────────────────────────────────────────────────────
    _rls("depenses_scannees",
        "DROP POLICY IF EXISTS admin_all_depenses_scannees ON depenses_scannees",
        """CREATE POLICY admin_all_depenses_scannees ON depenses_scannees
            FOR ALL TO authenticated
            USING (althy_current_role() IN ('admin','super_admin'))""",
        "DROP POLICY IF EXISTS owner_own_depenses_scannees ON depenses_scannees",
        """CREATE POLICY owner_own_depenses_scannees ON depenses_scannees
            FOR ALL TO authenticated
            USING (owner_id = althy_current_user_id())""",
    )

    # ── sale_mandates ─────────────────────────────────────────────────────────
    _rls("sale_mandates",
        "DROP POLICY IF EXISTS admin_all_sale_mandates ON sale_mandates",
        """CREATE POLICY admin_all_sale_mandates ON sale_mandates
            FOR ALL TO authenticated
            USING (althy_current_role() IN ('admin','super_admin'))""",
        "DROP POLICY IF EXISTS owner_own_sale_mandates ON sale_mandates",
        """CREATE POLICY owner_own_sale_mandates ON sale_mandates
            FOR ALL TO authenticated
            USING (owner_id = althy_current_user_id())""",
        "DROP POLICY IF EXISTS agency_read_agency_mandates ON sale_mandates",
        """CREATE POLICY agency_read_agency_mandates ON sale_mandates
            FOR SELECT TO authenticated
            USING (
                mandate_type = 'agency'
                AND status IN ('actif','offre')
                AND althy_current_role() IN ('agence','agent','admin','super_admin')
            )""",
    )

    # ── sale_offers ───────────────────────────────────────────────────────────
    _rls("sale_offers",
        "DROP POLICY IF EXISTS admin_all_sale_offers ON sale_offers",
        """CREATE POLICY admin_all_sale_offers ON sale_offers
            FOR ALL TO authenticated
            USING (althy_current_role() IN ('admin','super_admin'))""",
        "DROP POLICY IF EXISTS owner_own_sale_offers ON sale_offers",
        """CREATE POLICY owner_own_sale_offers ON sale_offers
            FOR ALL TO authenticated
            USING (
                mandate_id IN (
                    SELECT id FROM sale_mandates WHERE owner_id = althy_current_user_id()
                )
            )""",
    )

    # ── hunters ───────────────────────────────────────────────────────────────
    _rls("hunters",
        "DROP POLICY IF EXISTS admin_all_hunters ON hunters",
        """CREATE POLICY admin_all_hunters ON hunters
            FOR ALL TO authenticated
            USING (althy_current_role() IN ('admin','super_admin'))""",
        "DROP POLICY IF EXISTS hunter_own_submissions ON hunters",
        """CREATE POLICY hunter_own_submissions ON hunters
            FOR ALL TO authenticated
            USING (hunter_id = althy_current_user_id())""",
        "DROP POLICY IF EXISTS agent_read_offmarket ON hunters",
        """CREATE POLICY agent_read_offmarket ON hunters
            FOR SELECT TO authenticated
            USING (
                off_market_visible = TRUE
                AND althy_current_role() IN ('agence','agent','admin','super_admin')
            )""",
    )

    # ── portail_invitations ───────────────────────────────────────────────────
    _rls("portail_invitations",
        "DROP POLICY IF EXISTS admin_all_portail_inv ON portail_invitations",
        """CREATE POLICY admin_all_portail_inv ON portail_invitations
            FOR ALL TO authenticated
            USING (althy_current_role() IN ('admin','super_admin'))""",
        "DROP POLICY IF EXISTS agency_own_portail_inv ON portail_invitations",
        """CREATE POLICY agency_own_portail_inv ON portail_invitations
            FOR ALL TO authenticated
            USING (agency_user_id = althy_current_user_id())""",
    )

    # ── portail_messages ──────────────────────────────────────────────────────
    _rls("portail_messages",
        "DROP POLICY IF EXISTS admin_all_portail_msg ON portail_messages",
        """CREATE POLICY admin_all_portail_msg ON portail_messages
            FOR ALL TO authenticated
            USING (althy_current_role() IN ('admin','super_admin'))""",
        "DROP POLICY IF EXISTS agency_own_portail_messages ON portail_messages",
        """CREATE POLICY agency_own_portail_messages ON portail_messages
            FOR ALL TO authenticated
            USING (
                invitation_id IN (
                    SELECT id FROM portail_invitations
                    WHERE agency_user_id = althy_current_user_id()
                )
            )""",
    )

    # ── generated_documents ───────────────────────────────────────────────────
    _rls("generated_documents",
        "DROP POLICY IF EXISTS admin_all_gen_docs ON generated_documents",
        """CREATE POLICY admin_all_gen_docs ON generated_documents
            FOR ALL TO authenticated
            USING (althy_current_role() IN ('admin','super_admin'))""",
        "DROP POLICY IF EXISTS owner_own_gen_docs ON generated_documents",
        """CREATE POLICY owner_own_gen_docs ON generated_documents
            FOR ALL TO authenticated
            USING (owner_id = althy_current_user_id())""",
    )


def downgrade() -> None:
    pass
