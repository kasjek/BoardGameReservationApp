import pytest
from rest_framework.test import APIClient

from apps.accounts.models import Role, User


@pytest.fixture
def client():
    return APIClient()


def mk(username, role=Role.USER):
    return User.objects.create_user(username=username, password="pw-testing-123", role=role)


def test_new_user_has_empty_avatar_seed(db, client):
    user = mk("alice")
    client.force_authenticate(user=user)
    resp = client.get("/api/auth/me")
    assert resp.status_code == 200
    assert resp.data["avatar_seed"] == ""


def test_roll_avatar_sets_and_changes_seed(db, client):
    user = mk("alice")
    client.force_authenticate(user=user)
    r1 = client.post("/api/me/avatar/roll")
    assert r1.status_code == 200
    seed1 = r1.data["avatar_seed"]
    assert seed1  # non-empty

    r2 = client.post("/api/me/avatar/roll")
    assert r2.status_code == 200
    assert r2.data["avatar_seed"]
    assert r2.data["avatar_seed"] != seed1  # re-rolled


def test_roll_avatar_requires_auth(db, client):
    assert client.post("/api/me/avatar/roll").status_code in (401, 403)


def test_public_profile_exposes_avatar_seed_not_email(db, client):
    user = mk("bob")
    user.avatar_seed = "abc123"
    user.save()
    resp = client.get(f"/api/users/{user.id}")
    assert resp.status_code == 200
    assert resp.data["avatar_seed"] == "abc123"
    assert "email" not in resp.data


def test_register_rejects_weak_passwords(db, client):
    cases = [
        ("short1!", "capital"),  # too short / missing capital
        ("alllowercase1!", "capital"),
        ("NoSpecial1", "special"),
        ("SHORT1!", "8"),  # 7 chars with capital + sign
    ]
    for i, (password, _) in enumerate(cases):
        resp = client.post(
            "/api/auth/register",
            {
                "username": f"weak{i}",
                "email": f"weak{i}@example.com",
                "password": password,
            },
            format="json",
        )
        assert resp.status_code == 400, (password, resp.data)
        assert "password" in resp.data


def test_register_accepts_strong_password(db, client):
    resp = client.post(
        "/api/auth/register",
        {
            "username": "stronguser",
            "email": "strong@example.com",
            "password": "GoodPass1!",
        },
        format="json",
    )
    assert resp.status_code == 201, resp.data
    assert User.objects.filter(username="stronguser").exists()


def test_change_password_requires_auth(db, client):
    assert client.post("/api/me/password", {}).status_code in (401, 403)


def test_change_password_rejects_wrong_current(db, client):
    user = mk("alice")
    client.force_authenticate(user=user)
    resp = client.post(
        "/api/me/password",
        {
            "current_password": "wrong-password",
            "new_password": "NewPass1!",
            "confirm_password": "NewPass1!",
        },
        format="json",
    )
    assert resp.status_code == 400
    assert "current_password" in resp.data


def test_change_password_rejects_mismatch_and_weak(db, client):
    user = mk("alice")
    client.force_authenticate(user=user)
    mismatch = client.post(
        "/api/me/password",
        {
            "current_password": "pw-testing-123",
            "new_password": "NewPass1!",
            "confirm_password": "NewPass2!",
        },
        format="json",
    )
    assert mismatch.status_code == 400
    assert "confirm_password" in mismatch.data

    weak = client.post(
        "/api/me/password",
        {
            "current_password": "pw-testing-123",
            "new_password": "alllowercase1!",
            "confirm_password": "alllowercase1!",
        },
        format="json",
    )
    assert weak.status_code == 400
    assert "new_password" in weak.data


def test_change_password_success_rotates_token(db, client):
    from rest_framework.authtoken.models import Token

    user = mk("alice")
    old_token = Token.objects.create(user=user)
    client.credentials(HTTP_AUTHORIZATION=f"Token {old_token.key}")
    resp = client.post(
        "/api/me/password",
        {
            "current_password": "pw-testing-123",
            "new_password": "NewPass1!",
            "confirm_password": "NewPass1!",
        },
        format="json",
    )
    assert resp.status_code == 200, resp.data
    assert resp.data["token"]
    assert resp.data["token"] != old_token.key
    assert not Token.objects.filter(key=old_token.key).exists()
    user.refresh_from_db()
    assert user.check_password("NewPass1!")
    assert not user.check_password("pw-testing-123")
