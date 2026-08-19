"""Facebook Login: verify a user access token and provision a local USER."""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request

from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework.exceptions import APIException, ValidationError

from .google import unique_username
from .models import Role

User = get_user_model()

GRAPH_BASE = "https://graph.facebook.com"


class FacebookAuthError(Exception):
    def __init__(self, detail: str, status: int = 400):
        super().__init__(detail)
        self.detail = detail
        self.status = status


def facebook_app_id() -> str:
    return (getattr(settings, "FACEBOOK_APP_ID", "") or "").strip()


def facebook_app_secret() -> str:
    return (getattr(settings, "FACEBOOK_APP_SECRET", "") or "").strip()


def facebook_configured() -> bool:
    return bool(facebook_app_id() and facebook_app_secret())


def _get_json(url: str) -> dict:
    req = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            return json.loads(resp.read().decode())
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
        raise FacebookAuthError("Facebook sign-in could not be verified.") from exc


def verify_facebook_access_token(access_token: str) -> dict:
    """Confirm the token belongs to this app and return id/name/email."""
    app_id = facebook_app_id()
    secret = facebook_app_secret()
    if not app_id or not secret:
        raise FacebookAuthError("Facebook sign-in is not configured.", status=503)
    token = (access_token or "").strip()
    if not token:
        raise FacebookAuthError("Facebook access token is required.")

    app_token = f"{app_id}|{secret}"
    debug_qs = urllib.parse.urlencode({"input_token": token, "access_token": app_token})
    debug = _get_json(f"{GRAPH_BASE}/debug_token?{debug_qs}")
    data = debug.get("data") or {}
    if not data.get("is_valid"):
        raise FacebookAuthError("Facebook sign-in could not be verified.")
    if str(data.get("app_id") or "") != app_id:
        raise FacebookAuthError("Facebook sign-in could not be verified.")
    user_id = str(data.get("user_id") or "")
    if not user_id:
        raise FacebookAuthError("Facebook sign-in could not be verified.")

    me_qs = urllib.parse.urlencode({"fields": "id,name,email", "access_token": token})
    me = _get_json(f"{GRAPH_BASE}/me?{me_qs}")
    fb_id = str(me.get("id") or user_id)
    if not fb_id:
        raise FacebookAuthError("Facebook sign-in could not be verified.")
    email = str(me.get("email") or "").strip().lower()
    if not email:
        raise FacebookAuthError("Facebook did not provide an email.")
    return {"id": fb_id, "email": email, "name": me.get("name") or ""}


def user_from_facebook(info: dict):
    """Find or create a USER from a verified Facebook profile. Returns (user, created)."""
    fb_id = str(info["id"])
    email = str(info.get("email") or "").strip().lower()

    existing = User.objects.filter(facebook_id=fb_id).first()
    if existing:
        if email and not existing.email:
            existing.email = email
            existing.save(update_fields=["email"])
        return existing, False

    if email:
        by_email = User.objects.filter(email__iexact=email).first()
        if by_email:
            if by_email.facebook_id and by_email.facebook_id != fb_id:
                raise FacebookAuthError("This Facebook account cannot be linked.")
            by_email.facebook_id = fb_id
            update = ["facebook_id"]
            if email and not by_email.email:
                by_email.email = email
                update.append("email")
            by_email.save(update_fields=update)
            return by_email, False

    user = User(
        username=unique_username(email, info.get("name")),
        email=email,
        role=Role.USER,
        facebook_id=fb_id,
    )
    user.set_unusable_password()
    user.save()
    return user, True


class FacebookSignInUnavailable(APIException):
    status_code = 503
    default_detail = "Facebook sign-in is not configured."
    default_code = "facebook_unavailable"


def raise_facebook_as_api(exc: FacebookAuthError):
    if exc.status >= 500:
        err = FacebookSignInUnavailable()
        err.detail = exc.detail
        raise err
    raise ValidationError({"detail": exc.detail})
