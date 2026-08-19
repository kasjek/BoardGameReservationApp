"""Password registration stays inactive until the emailed activation link is used."""

from datetime import timedelta

import pytest
from django.core import mail
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.activation import email_delivery_configured
from apps.accounts.models import EmailActivationToken, Role, User


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def pass_captcha(monkeypatch):
    monkeypatch.setattr("apps.accounts.captcha.verify_recaptcha", lambda token, remote_ip=None: None)


STRONG = {
    "username": "newplayer",
    "email": "newplayer@example.com",
    "password": "GoodPass1!",
    "captcha_token": "test-ok",
}

MAIL = {
    "EMAIL_BACKEND": "django.core.mail.backends.locmem.EmailBackend",
    "EMAIL_HOST": "",
    "DEBUG": True,
    "PUBLIC_APP_URL": "http://test.example",
    "DEFAULT_FROM_EMAIL": "Too Many Games <noreply@test.example>",
}


@override_settings(**MAIL)
def test_register_creates_inactive_user_and_sends_mail(db, client, pass_captcha):
    resp = client.post("/api/auth/register", STRONG, format="json")
    assert resp.status_code == 201, resp.data
    assert "token" not in resp.data
    assert resp.data["email"] == "newplayer@example.com"
    user = User.objects.get(username="newplayer")
    assert user.is_active is False
    assert user.role == Role.USER
    assert EmailActivationToken.objects.filter(user=user).count() == 1
    assert len(mail.outbox) == 1
    assert "Activate" in mail.outbox[0].subject
    assert "http://test.example/activate?token=" in mail.outbox[0].body
    token = EmailActivationToken.objects.get(user=user)
    assert token.key in mail.outbox[0].body


@override_settings(**MAIL)
def test_register_requires_email(db, client, pass_captcha):
    resp = client.post(
        "/api/auth/register",
        {**STRONG, "email": ""},
        format="json",
    )
    assert resp.status_code == 400
    assert "email" in resp.data
    assert not User.objects.filter(username="newplayer").exists()


@override_settings(**MAIL)
def test_login_blocked_until_activated(db, client, pass_captcha):
    client.post("/api/auth/register", STRONG, format="json")
    denied = client.post(
        "/api/auth/login",
        {"username": "newplayer", "password": "GoodPass1!"},
        format="json",
    )
    assert denied.status_code == 403
    assert "activat" in str(denied.data["detail"]).lower()

    key = EmailActivationToken.objects.get().key
    activated = client.post("/api/auth/activate", {"token": key}, format="json")
    assert activated.status_code == 200

    user = User.objects.get(username="newplayer")
    assert user.is_active is True
    assert not EmailActivationToken.objects.exists()

    again = client.post("/api/auth/activate", {"token": key}, format="json")
    assert again.status_code == 400

    logged = client.post(
        "/api/auth/login",
        {"username": "newplayer", "password": "GoodPass1!"},
        format="json",
    )
    assert logged.status_code == 200
    assert logged.data["token"]

    me = client.get("/api/auth/me", HTTP_AUTHORIZATION=f"Token {logged.data['token']}")
    assert me.status_code == 200
    assert me.data["username"] == "newplayer"


@override_settings(**MAIL)
def test_wrong_password_does_not_reveal_inactive(db, client, pass_captcha):
    client.post("/api/auth/register", STRONG, format="json")
    resp = client.post(
        "/api/auth/login",
        {"username": "newplayer", "password": "WrongPass1!"},
        format="json",
    )
    assert resp.status_code == 400
    assert "non_field_errors" in resp.data


@override_settings(**MAIL)
def test_expired_activation_link_is_rejected(db, client, pass_captcha):
    client.post("/api/auth/register", STRONG, format="json")
    row = EmailActivationToken.objects.get()
    row.expires_at = timezone.now() - timedelta(minutes=1)
    row.save(update_fields=["expires_at"])
    resp = client.get(f"/api/auth/activate?token={row.key}")
    assert resp.status_code == 400
    assert User.objects.get(username="newplayer").is_active is False


@override_settings(**MAIL)
def test_resend_activation_rotates_token(db, client, pass_captcha):
    client.post("/api/auth/register", STRONG, format="json")
    old = EmailActivationToken.objects.get().key
    mail.outbox.clear()
    resp = client.post(
        "/api/auth/activate/resend",
        {"email": "newplayer@example.com"},
        format="json",
    )
    assert resp.status_code == 200
    new = EmailActivationToken.objects.get()
    assert new.key != old
    assert len(mail.outbox) == 1
    assert new.key in mail.outbox[0].body


@override_settings(**MAIL)
def test_resend_unknown_email_is_generic(db, client):
    resp = client.post(
        "/api/auth/activate/resend",
        {"email": "nobody@example.com"},
        format="json",
    )
    assert resp.status_code == 200
    assert mail.outbox == []


@override_settings(DEBUG=False, EMAIL_HOST="")
def test_register_fails_closed_without_mail_in_production(db, client, pass_captcha):
    assert email_delivery_configured() is False
    resp = client.post("/api/auth/register", STRONG, format="json")
    assert resp.status_code == 503
    assert not User.objects.filter(username="newplayer").exists()


@override_settings(**MAIL)
def test_google_link_activates_pending_password_account(db, client, pass_captcha, monkeypatch):
    client.post("/api/auth/register", STRONG, format="json")
    user = User.objects.get(username="newplayer")
    assert user.is_active is False

    from django.conf import settings as dj_settings

    dj_settings.GOOGLE_CLIENT_ID = "gid"
    monkeypatch.setattr(
        "apps.accounts.views.verify_google_id_token",
        lambda _c: {
            "sub": "g-sub-1",
            "email": "newplayer@example.com",
            "email_verified": True,
            "name": "New",
        },
    )
    resp = client.post("/api/auth/google", {"credential": "id-token"}, format="json")
    assert resp.status_code == 200, resp.data
    user.refresh_from_db()
    assert user.is_active is True
    assert user.google_sub == "g-sub-1"
    assert resp.data["token"]
