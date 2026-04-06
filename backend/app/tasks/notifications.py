from app.tasks.celery_app import celery_app


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def send_contract_notification(self, contract_id: str, user_email: str) -> dict:
    """Send an email notification when a contract is created or updated."""
    try:
        # TODO: implement email sending via SMTP
        return {"status": "sent", "contract_id": contract_id, "email": user_email}
    except Exception as exc:
        raise self.retry(exc=exc)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def send_transaction_receipt(self, transaction_id: str, user_email: str) -> dict:
    """Send a receipt when a transaction is completed."""
    try:
        # TODO: implement email sending via SMTP
        return {"status": "sent", "transaction_id": transaction_id, "email": user_email}
    except Exception as exc:
        raise self.retry(exc=exc)
