"""Facebook Login creates or links a USER after Graph token verification."""

from unittest.mock import patch

import pytest
from rest_framework.test import APIClient

from apps.accounts.facebook import FacebookAuthError, verify_facebook_access_token
from apps.accounts.models import Role, User


@pytest.fixture
def client():
    return APIClient()


def _graph(url: str):
    if "debug_token" in url:
        return {
            "data": {
                "app_id": "app-123",
                "is_valid": True,
                "user_id": "fb-99",
            }
        }
    if "/me?" in url:
        return {"id": "fb-99", "name": "Pat Facebook", "email": "pat.fb@example.com"}
    raise AssertionError(url)


def test_facebook_config_disabled_without_keys(db, client, settings):
    settings.FACEBOOK_APP_ID = ""
    settings.FACEBOOK_APP_SECRET = ""
    resp = client.get("/api/auth/facebook/config")
    assert resp.status_code == 200
    assert resp.data["facebook_enabled"] is False
    assert resp.data["facebook_app_id"] is None


def test_facebook_config_enabled_with_keys(db, client, settings):
    settings.FACEBOOK_APP_ID = "app-123"
    settings.FACEBOOK_APP_SECRET = "secret-xyz"
    resp = client.get("/api/auth/facebook/config")
    assert resp.status_code == 200
    assert resp.data["facebook_enabled"] is True
    assert resp.data["facebook_app_id"] == "app-123"


def test_facebook_login_not_configured(db, client, settings):
    settings.FACEBOOK_APP_ID = ""
    settings.FACEBOOK_APP_SECRET = ""
    resp = client.post("/api/auth/facebook", {"access_token": "fake"}, format="json")
    assert resp.status_code == 503


def test_facebook_login_rejects_bad_token(db, client, settings, monkeypatch):
    settings.FACEBOOK_APP_ID = "app-123"
    settings.FACEBOOK_APP_SECRET = "secret-xyz"

    def boom(_token):
        raise FacebookAuthError("Facebook sign-in could not be verified.")

    monkeypatch.setattr("apps.accounts.views.verify_facebook_access_token", boom)
    resp = client.post("/api/auth/facebook", {"access_token": "nope"}, format="json")
    assert resp.status_code == 400
    assert "detail" in resp.data


def _stub_facebook(monkeypatch, settings, payload):
    settings.FACEBOOK_APP_ID = "app-123"
    settings.FACEBOOK_APP_SECRET = "secret-xyz"
    monkeypatch.setattr("apps.accounts.views.verify_facebook_access_token", lambda _t: payload)


def test_facebook_login_creates_user(db, client, settings, monkeypatch):
    _stub_facebook(
        monkeypatch,
        settings,
        {"id": "fb-new-1", "email": "pat.fb@example.com", "name": "Pat Facebook"},
    )
    resp = client.post("/api/auth/facebook", {"access_token": "user-token"}, format="json")
    assert resp.status_code == 201, resp.data
    assert resp.data["token"]
    user = User.objects.get(facebook_id="fb-new-1")
    assert user.email == "pat.fb@example.com"
    assert user.role == Role.USER
    assert not user.has_usable_password()
    assert user.username.startswith("pat.fb") or user.username == "pat.fb"
    assert resp.data["user"]["has_usable_password"] is False

    again = client.post("/api/auth/facebook", {"access_token": "user-token"}, format="json")
    assert again.status_code == 200
    assert User.objects.filter(facebook_id="fb-new-1").count() == 1


def test_facebook_login_links_existing_email(db, client, settings, monkeypatch):
    existing = User.objects.create_user(
        username="already",
        email="same.fb@example.com",
        password="pw-testing-123",
        role=Role.USER,
    )
    _stub_facebook(
        monkeypatch,
        settings,
        {"id": "fb-link-1", "email": "same.fb@example.com", "name": "Same"},
    )
    resp = client.post("/api/auth/facebook", {"access_token": "user-token"}, format="json")
    assert resp.status_code == 200, resp.data
    existing.refresh_from_db()
    assert existing.facebook_id == "fb-link-1"
    assert existing.has_usable_password()
    assert resp.data["user"]["id"] == existing.id


def test_facebook_only_user_cannot_change_password(db, client, settings, monkeypatch):
    _stub_facebook(
        monkeypatch,
        settings,
        {"id": "fb-nopw", "email": "fb.nopw@example.com", "name": "No Pw"},
    )
    created = client.post("/api/auth/facebook", {"access_token": "user-token"}, format="json")
    token = created.data["token"]
    client.credentials(HTTP_AUTHORIZATION=f"Token {token}")
    resp = client.post(
        "/api/me/password",
        {
            "current_password": "anything",
            "new_password": "NewPass1!",
            "confirm_password": "NewPass1!",
        },
        format="json",
    )
    assert resp.status_code == 400
    assert "social" in resp.data["detail"].lower()


def test_verify_facebook_token_checks_app_id(db, settings):
    settings.FACEBOOK_APP_ID = "app-123"
    settings.FACEBOOK_APP_SECRET = "secret-xyz"
    with patch("apps.accounts.facebook._get_json", side_effect=_graph):
        info = verify_facebook_access_token("good-token")
    assert info["id"] == "fb-99"
    assert info["email"] == "pat.fb@example.com"


def test_verify_facebook_token_requires_email(db, settings):
    settings.FACEBOOK_APP_ID = "app-123"
    settings.FACEBOOK_APP_SECRET = "secret-xyz"

    def graph(url: str):
        if "debug_token" in url:
            return {"data": {"app_id": "app-123", "is_valid": True, "user_id": "fb-99"}}
        return {"id": "fb-99", "name": "Pat Facebook"}

    with (
        patch("apps.accounts.facebook._get_json", side_effect=graph),
        pytest.raises(FacebookAuthError, match="email"),
    ):
        verify_facebook_access_token("good-token")
