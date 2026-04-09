from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App
    APP_NAME: str = "CATHY"
    APP_ENV: str = "development"
    DEBUG: bool = False
    SECRET_KEY: str
    ALLOWED_ORIGINS: list[str] = ["http://localhost:3000", "https://althy.ch", "https://www.althy.ch"]

    # Database
    DATABASE_URL: str

    # Supabase
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_KEY: str
    SUPABASE_JWT_SECRET: str

    # Redis / Celery
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/1"

    # Stripe
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_CONNECT_CLIENT_ID: str = ""
    # Stripe Connect — frais plateforme
    STRIPE_PLATFORM_FEE_PCT: float = 4.0        # 4% loyers (affiché "loyer net reçu")
    STRIPE_OPENER_FEE_PCT: float = 15.0          # 15% openers (10% Pro)
    STRIPE_ARTISAN_FEE_PCT: float = 10.0         # 10% artisans
    STRIPE_APPLICATION_FEE_CHF: int = 90         # CHF 90 frais dossier locataire
    # Stripe Billing — prix des plans (IDs Stripe Price)
    STRIPE_PRICE_PROPRIO_MONTHLY: str = ""       # CHF 29/mois
    STRIPE_PRICE_PRO_MONTHLY: str = ""           # CHF 19/mois
    STRIPE_PRICE_AGENCY_MONTHLY: str = ""        # CHF 29/agent/mois
    STRIPE_PRICE_PORTAL_MONTHLY: str = ""        # CHF 9/mois portail proprio

    # AI
    ANTHROPIC_API_KEY: str = ""
    AI_RATE_LIMIT_STANDARD: int = 30    # interactions/jour standard
    AI_RATE_LIMIT_PRO: int = 100         # interactions/jour Pro

    # Commission rates (immutable — do not change)
    COMMISSION_FRONT_PCT: float = 3.0
    COMMISSION_BACK_PCT: float = 10.0
    COMMISSION_FIRST_RENT_PCT: float = 50.0

    # Monitoring
    SENTRY_DSN: str = ""

    # Email
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAILS_FROM: str = "noreply@immohub.fr"

    # Google OAuth2 (Gmail + Google Calendar)
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    # Microsoft OAuth2 (Outlook + Outlook Calendar)
    MICROSOFT_CLIENT_ID: str = ""
    MICROSOFT_CLIENT_SECRET: str = ""
    MICROSOFT_TENANT_ID: str = "common"

    # Portal syndication — Althy marge 15%
    PORTAL_MARGIN_PCT: float = 15.0

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"


settings = Settings()  # type: ignore[call-arg]
