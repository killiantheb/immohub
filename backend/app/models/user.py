from app.models.base import BaseModel
from sqlalchemy import Enum, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

UserRole = Enum(
    "super_admin",
    "agency",
    "owner",
    "tenant",
    "opener",
    "company",
    name="user_role_enum",
)


class User(BaseModel):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    hashed_password: Mapped[str | None] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(UserRole, nullable=False, default="owner")
    first_name: Mapped[str | None] = mapped_column(String(100))
    last_name: Mapped[str | None] = mapped_column(String(100))
    phone: Mapped[str | None] = mapped_column(String(20))
    avatar_url: Mapped[str | None] = mapped_column(Text)
    is_verified: Mapped[bool] = mapped_column(nullable=False, default=False, server_default="false")
    supabase_uid: Mapped[str | None] = mapped_column(String(36), unique=True)

    __table_args__ = (
        Index("ix_users_email", "email"),
        Index("ix_users_role", "role"),
        Index("ix_users_supabase_uid", "supabase_uid"),
    )
