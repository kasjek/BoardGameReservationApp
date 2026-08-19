"""reCAPTCHA is required to create an account; missing/invalid tokens are rejected."""

from unittest.mock import patch
from urllib.error import URLError

import pytest
from django.test import override_settings
from rest_framework.test import APIClient

from apps.accounts.captcha import (
    TEST_SECRET_KEY,
    TEST_SITE_KEY,
    CaptchaError,
    captcha_public_config,
    verify_recaptcha,
)
from apps.accounts.models import User


@pytest.fixture
def client():
    return APIClient()


STRONG = {
    "username": "botproof",
    "email": "botproof@example.com",
    "password": "GoodPass1!",
}


class _FakeResp:
    def __init__(self, payload: dict):
        self._raw = __import__("json").dumps(payload).encode()

    def read(self):
        return self._raw

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


@override_settings(DEBUG=True, RECAPTCHA_SITE_KEY=TEST_SITE_KEY, RECAPTCHA_SECRET_KEY=TEST_SECRET_KEY)
def test_captcha_config_exposes_site_key_when_enabled():
    cfg = captcha_public_config()
    assert cfg["captcha_enabled"] is True
    assert cfg["recaptcha_site_key"] == TEST_SITE_KEY


@override_settings(DEBUG=False, RECAPTCHA_SITE_KEY=TEST_SITE_KEY, RECAPTCHA_SECRET_KEY=TEST_SECRET_KEY)
def test_captcha_config_rejects_google_test_keys_when_not_debug():
    cfg = captcha_public_config()
    assert cfg["captcha_enabled"] is False
    assert cfg["recaptcha_site_key"] is None


@override_settings(DEBUG=False, RECAPTCHA_SITE_KEY="", RECAPTCHA_SECRET_KEY="")
def test_captcha_config_disabled_without_keys():
    cfg = captcha_public_config()
    assert cfg["captcha_enabled"] is False


def test_captcha_config_endpoint(db, client):
    resp = client.get("/api/auth/captcha/config")
    assert resp.status_code == 200
    assert "captcha_enabled" in resp.data
    assert "recaptcha_site_key" in resp.data


@override_settings(DEBUG=True, RECAPTCHA_SITE_KEY=TEST_SITE_KEY, RECAPTCHA_SECRET_KEY=TEST_SECRET_KEY)
def test_register_rejects_missing_captcha(db, client):
    resp = client.post("/api/auth/register", STRONG, format="json")
    assert resp.status_code == 400
    assert "captcha_token" in resp.data
    assert not User.objects.filter(username="botproof").exists()


@override_settings(DEBUG=True, RECAPTCHA_SITE_KEY=TEST_SITE_KEY, RECAPTCHA_SECRET_KEY=TEST_SECRET_KEY)
def test_register_rejects_blank_captcha(db, client):
    resp = client.post("/api/auth/register", {**STRONG, "captcha_token": "  "}, format="json")
    assert resp.status_code == 400
    assert "captcha_token" in resp.data


@override_settings(DEBUG=True, RECAPTCHA_SITE_KEY=TEST_SITE_KEY, RECAPTCHA_SECRET_KEY=TEST_SECRET_KEY)
def test_register_rejects_failed_captcha(db, client):
    with patch("apps.accounts.captcha.urllib.request.urlopen", return_value=_FakeResp({"success": False})):
        resp = client.post(
            "/api/auth/register",
            {**STRONG, "captcha_token": "forged-token"},
            format="json",
        )
    assert resp.status_code == 400
    assert "captcha_token" in resp.data
    assert not User.objects.filter(username="botproof").exists()


@override_settings(DEBUG=True, RECAPTCHA_SITE_KEY=TEST_SITE_KEY, RECAPTCHA_SECRET_KEY=TEST_SECRET_KEY)
def test_register_accepts_verified_captcha(db, client):
    with patch("apps.accounts.captcha.urllib.request.urlopen", return_value=_FakeResp({"success": True})):
        resp = client.post(
            "/api/auth/register",
            {**STRONG, "captcha_token": "real-token"},
            format="json",
        )
    assert resp.status_code == 201, resp.data
    user = User.objects.get(username="botproof")
    assert user.is_active is False
    assert "token" not in resp.data


@override_settings(DEBUG=True, RECAPTCHA_SITE_KEY=TEST_SITE_KEY, RECAPTCHA_SECRET_KEY=TEST_SECRET_KEY)
def test_verify_recaptcha_fails_closed_on_network_error():
    with patch("apps.accounts.captcha.urllib.request.urlopen", side_effect=URLError("down")), pytest.raises(
        CaptchaError
    ):
        verify_recaptcha("token")


@override_settings(DEBUG=False, RECAPTCHA_SITE_KEY="", RECAPTCHA_SECRET_KEY="")
def test_register_fails_closed_when_captcha_unconfigured(db, client):
    resp = client.post(
        "/api/auth/register",
        {**STRONG, "captcha_token": "anything"},
        format="json",
    )
    assert resp.status_code == 400
    assert "captcha_token" in resp.data
    assert not User.objects.filter(username="botproof").exists()
