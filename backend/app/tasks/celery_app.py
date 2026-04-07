from app.core.config import settings
from celery import Celery
from celery.schedules import crontab

celery_app = Celery(
    "immohub",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.tasks.notifications",
        "app.tasks.rent_tasks",
        "app.tasks.mission_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Europe/Paris",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)

# ── Celery Beat periodic schedule ─────────────────────────────────────────────

celery_app.conf.beat_schedule = {
    # 1st of each month at 06:00 Paris time
    "generate-monthly-rents": {
        "task": "tasks.generate_monthly_rents",
        "schedule": crontab(hour=6, minute=0, day_of_month=1),
    },
    # Every day at 08:00 Paris time
    "send-rent-reminders": {
        "task": "tasks.send_rent_reminders",
        "schedule": crontab(hour=8, minute=0),
    },
    # Every day at 09:00 Paris time
    "calculate-commissions": {
        "task": "tasks.calculate_commissions",
        "schedule": crontab(hour=9, minute=0),
    },
}
