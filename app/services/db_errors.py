from sqlalchemy.exc import IntegrityError


def is_duplicate_user_email_error(exc: IntegrityError) -> bool:
    """Return True when IntegrityError is caused by users.email unique constraint."""
    text = str(getattr(exc, "orig", exc)).lower()
    return "users.email" in text or ("email" in text and "unique" in text)
