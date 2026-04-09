"""0019 — RLS audit : enable RLS + policies on all sprint 6-9 tables."""

from __future__ import annotations
from alembic import op

revision = "0019"
down_revision = "0018"
branch_labels = None
depends_on = None

# Helper SQL — althy_current_user_id() and althy_current_role() defined in 0006
_HELPERS_EXIST = """
    CREATE OR REPLACE FUNCTION althy_current_user_id()
    RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
      SELECT id FROM users WHERE supabase_uid = auth.uid()::text
    $$;

    CREATE OR REPLACE FUNCTION althy_current_role()
    RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
      SELECT role FROM users WHERE supabase_uid = auth.uid()::text
    $$;
"""


def _rls_table(table: str, policies: list[str]) -> str:
    lines = [f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;"]
    lines += policies
    return "\n".join(lines)


def upgrade() -> None:
    # Ensure helpers exist (idempotent)
    op.execute(_HELPERS_EXIST)

    # ── user_integrations ─────────────────────────────────────────────────────
    op.execute(_rls_table("user_integrations", [
        "DROP POLICY IF EXISTS admin_all_user_integrations ON user_integrations;",
        """CREATE POLICY admin_all_user_integrations ON user_integrations
            FOR ALL TO authenticated
            USING (althy_current_role() IN ('admin','super_admin'));""",
        "DROP POLICY IF EXISTS owner_own_integrations ON user_integrations;",
        """CREATE POLICY owner_own_integrations ON user_integrations
            FOR ALL TO authenticated
            USING (user_id = althy_current_user_id());""",
    ]))

    # ── calendar_events ───────────────────────────────────────────────────────
    op.execute(_rls_table("calendar_events", [
        "DROP POLICY IF EXISTS admin_all_calendar_events ON calendar_events;",
        """CREATE POLICY admin_all_calendar_events ON calendar_events
            FOR ALL TO authenticated
            USING (althy_current_role() IN ('admin','super_admin'));""",
        "DROP POLICY IF EXISTS owner_own_calendar_events ON calendar_events;",
        """CREATE POLICY owner_own_calendar_events ON calendar_events
            FOR ALL TO authenticated
            USING (user_id = althy_current_user_id());""",
    ]))

    # ── depenses_scannees ─────────────────────────────────────────────────────
    op.execute(_rls_table("depenses_scannees", [
        "DROP POLICY IF EXISTS admin_all_depenses_scannees ON depenses_scannees;",
        """CREATE POLICY admin_all_depenses_scannees ON depenses_scannees
            FOR ALL TO authenticated
            USING (althy_current_role() IN ('admin','super_admin'));""",
        "DROP POLICY IF EXISTS owner_own_depenses_scannees ON depenses_scannees;",
        """CREATE POLICY owner_own_depenses_scannees ON depenses_scannees
            FOR ALL TO authenticated
            USING (owner_id = althy_current_user_id());""",
    ]))

    # ── sale_mandates ─────────────────────────────────────────────────────────
    op.execute(_rls_table("sale_mandates", [
        "DROP POLICY IF EXISTS admin_all_sale_mandates ON sale_mandates;",
        """CREATE POLICY admin_all_sale_mandates ON sale_mandates
            FOR ALL TO authenticated
            USING (althy_current_role() IN ('admin','super_admin'));""",
        "DROP POLICY IF EXISTS owner_own_sale_mandates ON sale_mandates;",
        """CREATE POLICY owner_own_sale_mandates ON sale_mandates
            FOR ALL TO authenticated
            USING (owner_id = althy_current_user_id());""",
        # Agences peuvent voir les mandats "agency"
        "DROP POLICY IF EXISTS agency_read_agency_mandates ON sale_mandates;",
        """CREATE POLICY agency_read_agency_mandates ON sale_mandates
            FOR SELECT TO authenticated
            USING (
                mandate_type = 'agency'
                AND status IN ('actif','offre')
                AND althy_current_role() IN ('agence','agent','admin','super_admin')
            );""",
    ]))

    # ── sale_offers ───────────────────────────────────────────────────────────
    op.execute(_rls_table("sale_offers", [
        "DROP POLICY IF EXISTS admin_all_sale_offers ON sale_offers;",
        """CREATE POLICY admin_all_sale_offers ON sale_offers
            FOR ALL TO authenticated
            USING (althy_current_role() IN ('admin','super_admin'));""",
        "DROP POLICY IF EXISTS owner_own_sale_offers ON sale_offers;",
        """CREATE POLICY owner_own_sale_offers ON sale_offers
            FOR ALL TO authenticated
            USING (
                mandate_id IN (
                    SELECT id FROM sale_mandates WHERE owner_id = althy_current_user_id()
                )
            );""",
    ]))

    # ── hunters ───────────────────────────────────────────────────────────────
    op.execute(_rls_table("hunters", [
        "DROP POLICY IF EXISTS admin_all_hunters ON hunters;",
        """CREATE POLICY admin_all_hunters ON hunters
            FOR ALL TO authenticated
            USING (althy_current_role() IN ('admin','super_admin'));""",
        "DROP POLICY IF EXISTS hunter_own_submissions ON hunters;",
        """CREATE POLICY hunter_own_submissions ON hunters
            FOR ALL TO authenticated
            USING (hunter_id = althy_current_user_id());""",
        # Agents premium peuvent voir les leads off-market
        "DROP POLICY IF EXISTS agent_read_offmarket ON hunters;",
        """CREATE POLICY agent_read_offmarket ON hunters
            FOR SELECT TO authenticated
            USING (
                off_market_visible = TRUE
                AND althy_current_role() IN ('agence','agent','admin','super_admin')
            );""",
    ]))

    # ── portail_invitations ───────────────────────────────────────────────────
    op.execute(_rls_table("portail_invitations", [
        "DROP POLICY IF EXISTS admin_all_portail_inv ON portail_invitations;",
        """CREATE POLICY admin_all_portail_inv ON portail_invitations
            FOR ALL TO authenticated
            USING (althy_current_role() IN ('admin','super_admin'));""",
        "DROP POLICY IF EXISTS agency_own_portail_inv ON portail_invitations;",
        """CREATE POLICY agency_own_portail_inv ON portail_invitations
            FOR ALL TO authenticated
            USING (agency_user_id = althy_current_user_id());""",
    ]))

    # ── portail_messages ──────────────────────────────────────────────────────
    op.execute(_rls_table("portail_messages", [
        "DROP POLICY IF EXISTS admin_all_portail_msg ON portail_messages;",
        """CREATE POLICY admin_all_portail_msg ON portail_messages
            FOR ALL TO authenticated
            USING (althy_current_role() IN ('admin','super_admin'));""",
        "DROP POLICY IF EXISTS agency_own_portail_messages ON portail_messages;",
        """CREATE POLICY agency_own_portail_messages ON portail_messages
            FOR ALL TO authenticated
            USING (
                invitation_id IN (
                    SELECT id FROM portail_invitations WHERE agency_user_id = althy_current_user_id()
                )
            );""",
    ]))

    # ── generated_documents — add sprint 7 policies ───────────────────────────
    op.execute("""
        ALTER TABLE generated_documents ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS admin_all_gen_docs ON generated_documents;
        CREATE POLICY admin_all_gen_docs ON generated_documents
            FOR ALL TO authenticated
            USING (althy_current_role() IN ('admin','super_admin'));
        DROP POLICY IF EXISTS owner_own_gen_docs ON generated_documents;
        CREATE POLICY owner_own_gen_docs ON generated_documents
            FOR ALL TO authenticated
            USING (owner_id = althy_current_user_id());
    """)


def downgrade() -> None:
    pass
