from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App
    APP_NAME: str = "ALTHY"
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
    # Proprio solo
    STRIPE_PRICE_STARTER_MONTHLY: str = ""       # CHF 14/mois (1 bien, fonctions complètes)
    STRIPE_PRICE_PRO_MONTHLY: str = ""           # CHF 29/mois (2-5 biens)
    STRIPE_PRICE_PROPRIO_MONTHLY: str = ""       # Legacy CHF 29/mois → mappé sur "pro" (grandfathered)
    # Agence
    STRIPE_PRICE_AGENCY_MONTHLY: str = ""        # CHF 79/agent/mois (standard)
    STRIPE_PRICE_AGENCY_PREMIUM_MONTHLY: str = "" # CHF 129/agent/mois (premium)
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
    EMAILS_FROM: str = "noreply@althy.ch"

    # Resend (email transactionnel)
    RESEND_API_KEY: str = ""

    # Twilio (SMS)
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_FROM_NUMBER: str = ""

    # Google Maps / Places (scraping agences)
    GOOGLE_MAPS_API_KEY: str = ""

    # Frontend public URL (magic links)
    FRONTEND_URL: str = "https://althy.ch"

    # Google OAuth2 (Gmail + Google Calendar)
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    # Microsoft OAuth2 (Outlook + Outlook Calendar)
    MICROSOFT_CLIENT_ID: str = ""
    MICROSOFT_CLIENT_SECRET: str = ""
    MICROSOFT_TENANT_ID: str = "common"

    # WhatsApp Business API (Meta)
    WHATSAPP_VERIFY_TOKEN: str = ""
    WHATSAPP_API_TOKEN: str = ""
    WHATSAPP_PHONE_ID: str = ""
    META_APP_SECRET: str = ""

    # Portal syndication — Althy marge 15%
    PORTAL_MARGIN_PCT: float = 15.0

    # Transit Airbnb — QR-facture loyers
    ALTHY_QR_IBAN: str = ""                    # QR-IBAN du compte Althy (CH…)
    ALTHY_COMMISSION_PCT: float = 0.03         # 3% sur loyers en transit
    ALTHY_BANK_NAME: str = "PostFinance"       # Pour en-tête QR-factures
    ALTHY_CREDITOR_NAME: str = "Killian Thébaud — Althy"
    ALTHY_CREDITOR_STREET: str = "Rue de Rive 1"
    ALTHY_CREDITOR_CITY: str = "1204 Genève"
    ALTHY_CREDITOR_COUNTRY: str = "CH"

    # Feature flags — rôles autorisés à l'inscription
    # En prod Phase 1 : seuls proprio_solo + locataire + super_admin peuvent s'inscrire.
    # Les autres rôles sont en liste d'attente.
    FEATURE_FLAGS_STRICT: bool = True  # True en prod, False en staging/dev
    ALLOWED_SIGNUP_ROLES: list[str] = ["proprio_solo", "locataire", "super_admin"]

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"


settings = Settings()  # type: ignore[call-arg]
