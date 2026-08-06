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
