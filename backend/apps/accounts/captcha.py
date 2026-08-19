"""Google reCAPTCHA v2 verification for self-registration."""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request

from django.conf import settings
from rest_framework.exceptions import ValidationError

SITEVERIFY_URL = "https://www.google.com/recaptcha/api/siteverify"
# Google's documented always-pass keys — local/CI only, never production.
TEST_SITE_KEY = "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"
TEST_SECRET_KEY = "6LeIxAcTAAAAAGG-vFI1TnRWxMZNLuL5rOJbpCII"


class CaptchaError(ValidationError):
    """Registration rejected because captcha is missing, invalid, or unconfigured."""


def recaptcha_site_key() -> str:
    return (getattr(settings, "RECAPTCHA_SITE_KEY", "") or "").strip()


def recaptcha_secret_key() -> str:
    return (getattr(settings, "RECAPTCHA_SECRET_KEY", "") or "").strip()


def captcha_enabled() -> bool:
    site = recaptcha_site_key()
    secret = recaptcha_secret_key()
    if not site or not secret:
        return False
    debug = bool(getattr(settings, "DEBUG", False))
    using_test_keys = secret == TEST_SECRET_KEY or site == TEST_SITE_KEY
    return debug or not using_test_keys


def captcha_public_config() -> dict:
    enabled = captcha_enabled()
    return {
        "captcha_enabled": enabled,
        "recaptcha_site_key": recaptcha_site_key() if enabled else None,
    }


def verify_recaptcha(token: str, remote_ip: str | None = None) -> None:
    if not captcha_enabled():
        raise CaptchaError({"captcha_token": ["Captcha is not configured."]})
    value = (token or "").strip()
    if not value:
        raise CaptchaError({"captcha_token": ["Captcha is required."]})

    payload: dict[str, str] = {
        "secret": recaptcha_secret_key(),
        "response": value,
    }
    if remote_ip:
        payload["remoteip"] = remote_ip
    data = urllib.parse.urlencode(payload).encode()
    req = urllib.request.Request(SITEVERIFY_URL, data=data, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            body = json.loads(resp.read().decode())
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
        raise CaptchaError({"captcha_token": ["Captcha verification failed."]}) from exc
    if not body.get("success"):
        raise CaptchaError({"captcha_token": ["Captcha verification failed."]})
