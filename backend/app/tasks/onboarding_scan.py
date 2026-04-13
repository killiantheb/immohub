"""Tâche Celery : scan au moment de l'inscription."""
from app.tasks.celery_app import celery_app


@celery_app.task(bind=True, max_retries=2, time_limit=300)
def scanner_nouvel_utilisateur(self, user_id: str, contexte: dict):
    """
    Lancée automatiquement après l'inscription.
    Résultats stockés en DB → frontend les affiche pour validation.
    """
    import asyncio, json
    from app.services.scanner import scanner_tout
    from app.core.database import sync_session
    from app.models.onboarding import OnboardingScan

    try:
        elements = asyncio.run(scanner_tout(contexte))
    except Exception as exc:
        raise self.retry(exc=exc, countdown=30)

    with sync_session() as db:
        scan = OnboardingScan(
            user_id          = user_id,
            status           = "pending_review",
            elements_trouves = json.dumps([{
                "source_site":  el.source_site,
                "source_url":   el.source_url,
                "source_id":    el.source_id,
                "type_element": el.type_element,
                "titre":        el.titre,
                "description":  el.description,
                "photos":       el.photos,
                "donnees":      el.donnees_brutes,
            } for el in elements], ensure_ascii=False),
            nb_elements = len(elements),
        )
        db.add(scan)

    return {"status": "done", "nb": len(elements)}
