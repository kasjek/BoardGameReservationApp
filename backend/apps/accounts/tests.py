import pytest
from rest_framework.test import APIClient

from apps.accounts.models import Role, User


@pytest.fixture
def client():
    return APIClient()


def mk(username, role=Role.USER):
    """Password-backed test user. Demo seed migrations already create alice/bob/etc."""
    user, _ = User.objects.get_or_create(username=username, defaults={"role": role})
    user.role = role
    user.set_password("pw-testing-123")
    user.save()
    return user


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


def test_google_config_disabled_without_client_id(db, client, settings):
    settings.GOOGLE_CLIENT_ID = ""
    resp = client.get("/api/auth/google/config")
    assert resp.status_code == 200
    assert resp.data["google_enabled"] is False
    assert resp.data["google_client_id"] is None


def test_google_config_enabled_with_client_id(db, client, settings):
    settings.GOOGLE_CLIENT_ID = "test-client.apps.googleusercontent.com"
    resp = client.get("/api/auth/google/config")
    assert resp.status_code == 200
    assert resp.data["google_enabled"] is True
    assert resp.data["google_client_id"] == "test-client.apps.googleusercontent.com"


def test_google_login_not_configured(db, client, settings):
    settings.GOOGLE_CLIENT_ID = ""
    resp = client.post("/api/auth/google", {"credential": "fake"}, format="json")
    assert resp.status_code == 503


def test_google_login_rejects_bad_token(db, client, settings, monkeypatch):
    settings.GOOGLE_CLIENT_ID = "test-client.apps.googleusercontent.com"

    def boom(_credential):
        from apps.accounts.google import GoogleAuthError

        raise GoogleAuthError("Google sign-in could not be verified.")

    monkeypatch.setattr("apps.accounts.views.verify_google_id_token", boom)
    resp = client.post("/api/auth/google", {"credential": "nope"}, format="json")
    assert resp.status_code == 400
    assert "detail" in resp.data


def _stub_google(monkeypatch, settings, payload):
    settings.GOOGLE_CLIENT_ID = "test-client.apps.googleusercontent.com"
    monkeypatch.setattr("apps.accounts.views.verify_google_id_token", lambda _c: payload)


def test_google_login_creates_user(db, client, settings, monkeypatch):
    _stub_google(
        monkeypatch,
        settings,
        {
            "sub": "gid-new-1",
            "email": "pat.google@example.com",
            "email_verified": True,
            "name": "Pat Google",
        },
    )
    resp = client.post("/api/auth/google", {"credential": "id-token"}, format="json")
    assert resp.status_code == 201, resp.data
    assert resp.data["token"]
    user = User.objects.get(google_sub="gid-new-1")
    assert user.email == "pat.google@example.com"
    assert user.role == Role.USER
    assert not user.has_usable_password()
    assert user.username.startswith("pat.google") or user.username == "pat.google"
    assert resp.data["user"]["has_usable_password"] is False

    again = client.post("/api/auth/google", {"credential": "id-token"}, format="json")
    assert again.status_code == 200
    assert User.objects.filter(google_sub="gid-new-1").count() == 1


def test_google_login_links_existing_email(db, client, settings, monkeypatch):
    existing = User.objects.create_user(
        username="already",
        email="same@example.com",
        password="pw-testing-123",
        role=Role.USER,
    )
    _stub_google(
        monkeypatch,
        settings,
        {
            "sub": "gid-link-1",
            "email": "same@example.com",
            "email_verified": True,
        },
    )
    resp = client.post("/api/auth/google", {"credential": "id-token"}, format="json")
    assert resp.status_code == 200, resp.data
    existing.refresh_from_db()
    assert existing.google_sub == "gid-link-1"
    assert existing.has_usable_password()
    assert resp.data["user"]["id"] == existing.id
    assert resp.data["user"]["has_usable_password"] is True


def test_google_only_user_cannot_change_password(db, client, settings, monkeypatch):
    _stub_google(
        monkeypatch,
        settings,
        {
            "sub": "gid-nopw",
            "email": "nopw@example.com",
            "email_verified": True,
        },
    )
    created = client.post("/api/auth/google", {"credential": "id-token"}, format="json")
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
    assert "Google" in resp.data["detail"]


def test_public_profile_includes_game_stats_not_email(db, client):
    from datetime import timedelta

    from django.utils import timezone

    from apps.tables.models import SeatReservation, SeatStatus, Table, TableStatus
    from apps.venues.models import Venue

    venue = Venue.objects.create(name="Stats Cafe")
    host = mk("host_for_stats")
    guest = mk("guest_for_stats")
    now = timezone.now()

    def add_table(organizer, title, status=TableStatus.CONFIRMED):
        table = Table.objects.create(
            organizer=organizer,
            venue=venue,
            game_title=title,
            starts_at=now + timedelta(days=2),
            ends_at=now + timedelta(days=2, hours=2),
            min_players=2,
            max_players=4,
            status=status,
            seats_taken=1,
        )
        SeatReservation.objects.create(
            table=table, user=organizer, is_organizer=True, status=SeatStatus.RESERVED
        )
        return table

    catan = add_table(host, "Catan")
    SeatReservation.objects.create(table=catan, user=guest, status=SeatStatus.RESERVED)
    add_table(guest, "Carcassonne")
    add_table(guest, "Catan")
    cancelled = add_table(guest, "Secret Hitler", status=TableStatus.CANCELLED)
    waitlisted = add_table(host, "Patchwork")
    SeatReservation.objects.create(
        table=waitlisted, user=guest, status=SeatStatus.WAITLISTED, waitlist_position=1
    )
    dropped = add_table(host, "Onitama")
    SeatReservation.objects.create(table=dropped, user=guest, status=SeatStatus.CANCELLED)

    resp = client.get(f"/api/users/{guest.id}")
    assert resp.status_code == 200
    assert "email" not in resp.data
    assert resp.data["username"] == "guest_for_stats"
    assert resp.data["games_played"] == 3
    assert resp.data["different_games"] == 2
    assert "late_cancel_marks_active" in resp.data
    assert cancelled.status == TableStatus.CANCELLED

    games = client.get(f"/api/users/{guest.id}/games")
    assert games.status_code == 200
    titles = {row["title"] for row in games.data["titles"]}
    assert titles == {"Catan", "Carcassonne"}
    assert games.data["games_played"] == 3
    assert len(games.data["sessions"]) == 3
    assert all(row["game_title"] not in {"Secret Hitler", "Patchwork", "Onitama"} for row in games.data["sessions"])


def test_public_user_games_404(db, client):
    resp = client.get("/api/users/999999/games")
    assert resp.status_code == 404


def test_search_users_by_login_omits_email_and_self(db, client):
    me = mk("finder_login")
    other = mk("alice_findable")
    client.force_authenticate(user=me)
    resp = client.get("/api/users?q=alice_find")
    assert resp.status_code == 200
    names = [row["username"] for row in resp.data]
    assert other.username in names
    assert me.username not in names
    assert all("email" not in row for row in resp.data)


def test_search_users_requires_auth(db, client):
    assert client.get("/api/users?q=alice").status_code in (401, 403)


def test_add_friend_by_login_then_accept(db, client):
    alpha = mk("alpha_friend")
    beta = mk("beta_friend")
    client.force_authenticate(user=alpha)
    sent = client.post("/api/friends/requests", {"username": "beta_friend"}, format="json")
    assert sent.status_code == 201
    assert sent.data["status"] == "pending"
    request_id = sent.data["id"]

    client.force_authenticate(user=beta)
    incoming = client.get("/api/friends/requests")
    assert incoming.status_code == 200
    assert incoming.data["incoming"][0]["user"]["username"] == "alpha_friend"

    accepted = client.post(f"/api/friends/requests/{request_id}/accept")
    assert accepted.status_code == 200
    assert accepted.data["status"] == "accepted"

    friends = client.get("/api/friends")
    assert any(row["username"] == "alpha_friend" for row in friends.data)

    client.force_authenticate(user=alpha)
    mine = client.get("/api/friends")
    assert any(row["username"] == "beta_friend" for row in mine.data)

    profile = client.get(f"/api/users/{beta.id}")
    assert profile.data["friendship"]["status"] == "friends"
    assert "email" not in profile.data


def test_reciprocal_add_accepts_incoming(db, client):
    a = mk("recip_a")
    b = mk("recip_b")
    client.force_authenticate(user=a)
    client.post("/api/friends/requests", {"username": "recip_b"}, format="json")
    client.force_authenticate(user=b)
    resp = client.post("/api/friends/requests", {"username": "recip_a"}, format="json")
    assert resp.data["status"] == "accepted"


def test_private_chat_round_trip(db, client):
    a = mk("chat_a")
    b = mk("chat_b")
    client.force_authenticate(user=a)
    assert client.get("/api/chats").data == []
    sent = client.post(f"/api/chats/{b.id}", {"body": "Hello from A"}, format="json")
    assert sent.status_code == 201
    assert sent.data["body"] == "Hello from A"
    assert sent.data["mine"] is True

    client.force_authenticate(user=b)
    thread = client.get(f"/api/chats/{a.id}")
    assert thread.status_code == 200
    assert thread.data["user"]["username"] == "chat_a"
    assert "email" not in thread.data["user"]
    assert len(thread.data["messages"]) == 1
    client.post(f"/api/chats/{a.id}", {"body": "Hi A"}, format="json")

    inbox = client.get("/api/chats")
    assert inbox.data[0]["user"]["username"] == "chat_a"
    assert inbox.data[0]["last_message"]["body"] == "Hi A"


def test_private_chat_rejects_self_and_empty(db, client):
    me = mk("chat_self")
    client.force_authenticate(user=me)
    assert client.post(f"/api/chats/{me.id}", {"body": "hi"}, format="json").status_code == 400
    other = mk("chat_other")
    assert client.post(f"/api/chats/{other.id}", {"body": "  "}, format="json").status_code == 400
    assert client.get("/api/chats/999999").status_code == 404



