from alembic import op
import sqlalchemy as sa

revision = "0027"
down_revision = "0026"


def upgrade():
    op.create_table(
        "onboarding_scans",
        sa.Column("id",               sa.UUID(),     primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id",          sa.UUID(),     nullable=False),
        sa.Column("status",           sa.String(30), nullable=False, server_default="pending"),
        sa.Column("elements_trouves", sa.Text(),     nullable=True),
        sa.Column("nb_elements",      sa.Integer(),  nullable=False, server_default="0"),
        sa.Column("created_at",       sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_onboarding_scans_user_id", "onboarding_scans", ["user_id"])
    op.create_index("ix_onboarding_scans_status",  "onboarding_scans", ["status"])

    # Traçabilité source sur les listings importés depuis le scanner
    op.add_column("listings", sa.Column("source_site", sa.String(100), nullable=True))
    op.add_column("listings", sa.Column("source_id",   sa.String(100), nullable=True))
    op.add_column("listings", sa.Column("source_url",  sa.String(500), nullable=True))


def downgrade():
    op.drop_column("listings", "source_url")
    op.drop_column("listings", "source_id")
    op.drop_column("listings", "source_site")
    op.drop_index("ix_onboarding_scans_status",  table_name="onboarding_scans")
    op.drop_index("ix_onboarding_scans_user_id", table_name="onboarding_scans")
    op.drop_table("onboarding_scans")
