from app.core.config import settings
from celery import Celery
from celery.schedules import crontab

celery_app = Celery(
    "althy",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.tasks.notifications",
        "app.tasks.rent_tasks",
        "app.tasks.mission_tasks",
        "app.tasks.ai_tasks",
        "app.tasks.alerts",
        "app.tasks.onboarding_scan",
        "app.tasks.import_elements",
        "app.tasks.email_sequences",
        "app.tasks.sync_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Europe/Zurich",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    # RedBeat — prevents duplicate tasks when beat restarts in production
    beat_scheduler="redbeat.RedBeatScheduler",
    redbeat_redis_url=settings.REDIS_URL,
    redbeat_lock_timeout=300,  # 5 min — kill stale scheduler lock
)

# ── Celery Beat periodic schedule ─────────────────────────────────────────────

celery_app.conf.beat_schedule = {
    # 1st of each month at 06:00 Zurich time
    "generate-monthly-rents": {
        "task": "tasks.generate_monthly_rents",
        "schedule": crontab(hour=6, minute=0, day_of_month=1),
    },
    # Every day at 08:00 Zurich time
    "send-rent-reminders": {
        "task": "tasks.send_rent_reminders",
        "schedule": crontab(hour=8, minute=0),
    },
    # Every day at 09:00 Zurich time
    "calculate-commissions": {
        "task": "tasks.calculate_commissions",
        "schedule": crontab(hour=9, minute=0),
    },
    # Every day at 07:00 Zurich time — AI daily briefing for all active users
    "daily-briefing-all-users": {
        "task": "tasks.daily_briefing_all_users",
        "schedule": crontab(hour=7, minute=0),
    },
    # 1st of each month at 06:30 Zurich — quittances automatiques
    "generate-monthly-quittances": {
        "task": "tasks.generate_monthly_quittances",
        "schedule": crontab(hour=6, minute=30, day_of_month=1),
    },
    # Every day at 10:00 Zurich — loyers impayés (J+7)
    "check-overdue-rents": {
        "task": "tasks.check_overdue_rents",
        "schedule": crontab(hour=10, minute=0),
    },
    # Every day at 08:30 Zurich — baux expirant dans 90/60/30/14j
    "check-expiring-leases": {
        "task": "tasks.check_expiring_leases",
        "schedule": crontab(hour=8, minute=30),
    },
    # Every hour — transit Airbnb : reverse les loyers reçus sur compte Althy
    "reverse-loyers": {
        "task": "tasks.reverse_loyers",
        "schedule": crontab(minute=0),   # toutes les heures pile
    },
    # Every hour at :30 — séquences emails post-inscription (J+0, J+3, J+7, J+14, J+30)
    "check-email-sequences": {
        "task": "tasks.check_email_sequences",
        "schedule": crontab(minute=30),  # décalé de 30min vs reverse-loyers
    },
}
