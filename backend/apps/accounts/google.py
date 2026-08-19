"""Google ID-token verification and local USER provisioning."""

from __future__ import annotations

import re

from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework.exceptions import APIException, ValidationError

from .activation import mark_email_verified
from .models import Role

User = get_user_model()


class GoogleAuthError(Exception):
    def __init__(self, detail: str, status: int = 400):
        super().__init__(detail)
        self.detail = detail
        self.status = status


def google_client_id() -> str:
    return (getattr(settings, "GOOGLE_CLIENT_ID", "") or "").strip()


def verify_google_id_token(credential: str) -> dict:
    """Verify a GIS ID token and return the payload (sub, email, ...)."""
    client_id = google_client_id()
    if not client_id:
        raise GoogleAuthError("Google sign-in is not configured.", status=503)
    if not credential or not isinstance(credential, str):
        raise GoogleAuthError("Google credential is required.")

    try:
        from google.auth.transport import requests as google_requests
        from google.oauth2 import id_token
    except ImportError as exc:  # pragma: no cover
        raise GoogleAuthError("Google sign-in is not available.", status=503) from exc

    try:
        info = id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            client_id,
            clock_skew_in_seconds=10,
        )
    except Exception as exc:
        raise GoogleAuthError("Google sign-in could not be verified.") from exc

    iss = info.get("iss")
    if iss not in ("accounts.google.com", "https://accounts.google.com"):
        raise GoogleAuthError("Google sign-in could not be verified.")
    if not info.get("email") or not info.get("email_verified"):
        raise GoogleAuthError("Google did not provide a verified email.")
    if not info.get("sub"):
        raise GoogleAuthError("Google sign-in could not be verified.")
    return info


def _username_base(email: str, name: str | None) -> str:
    local = (email or "").split("@", 1)[0]
    raw = local or (name or "") or "user"
    cleaned = re.sub(r"[^A-Za-z0-9._]", "", raw)[:24]
    if not cleaned:
        cleaned = "user"
    if cleaned[0].isdigit():
        cleaned = f"u{cleaned}"[:24]
    return cleaned


def unique_username(email: str, name: str | None = None) -> str:
    base = _username_base(email, name)
    candidate = base
    n = 2
    while User.objects.filter(username__iexact=candidate).exists():
        suffix = str(n)
        candidate = f"{base[: 150 - len(suffix)]}{suffix}"
        n += 1
        if n > 10_000:  # pragma: no cover
            raise ValidationError({"username": "Could not allocate a username."})
    return candidate


def user_from_google(info: dict):
    """Find or create a USER from a verified Google payload. Returns (user, created)."""
    sub = str(info["sub"])
    email = str(info.get("email") or "").strip().lower()

    existing = User.objects.filter(google_sub=sub).first()
    if existing:
        if email and not existing.email:
            existing.email = email
            existing.save(update_fields=["email"])
        return existing, False

    if email:
        by_email = User.objects.filter(email__iexact=email).first()
        if by_email:
            if by_email.google_sub and by_email.google_sub != sub:
                raise GoogleAuthError("This Google account cannot be linked.")
            by_email.google_sub = sub
            update = ["google_sub"]
            if email and not by_email.email:
                by_email.email = email
                update.append("email")
            by_email.save(update_fields=update)
            mark_email_verified(by_email)
            return by_email, False

    user = User(
        username=unique_username(email, info.get("name")),
        email=email,
        role=Role.USER,
        google_sub=sub,
    )
    user.set_unusable_password()
    user.save()
    return user, True


class GoogleSignInUnavailable(APIException):
    status_code = 503
    default_detail = "Google sign-in is not configured."
    default_code = "google_unavailable"


def raise_as_api(exc: GoogleAuthError):
    """Map GoogleAuthError to a DRF exception."""
    if exc.status >= 500:
        err = GoogleSignInUnavailable()
        err.detail = exc.detail
        raise err
    raise ValidationError({"detail": exc.detail})
