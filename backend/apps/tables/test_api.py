from datetime import time, timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import Role
from apps.venues.models import Venue, VenueAvailability

from . import services
from .models import TableStatus
from .tests import future_dt, make_table, make_user


@pytest.fixture
def client():
    return APIClient()


def test_register_returns_token_and_me(db, client):
    resp = client.post(
        "/api/auth/register",
        {"username": "newuser", "email": "n@example.com", "password": "Supersecret1!"},
        format="json",
    )
    assert resp.status_code == 201
    token = resp.data["token"]
    assert resp.data["user"]["role"] == Role.USER

    client.credentials(HTTP_AUTHORIZATION=f"Token {token}")
    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.data["username"] == "newuser"


def test_reserve_before_confirmation_returns_409(db, client):
    venue = Venue.objects.create(name="Board & Brew")
    host = make_user("alice")
    bob = make_user("bob")
    table = make_table(host, venue)  # waiting_for_venue_confirmation
    client.force_authenticate(user=bob)
    resp = client.post(f"/api/tables/{table.id}/seats")
    assert resp.status_code == 409


def test_venue_user_cannot_reserve_via_api_403(db, client):
    venue = Venue.objects.create(name="Board & Brew")
    host = make_user("alice")
    staff = make_user("carol", role=Role.VENUE_USER, venue=venue)
    table = make_table(host, venue)
    table.status = TableStatus.WAITING_FOR_PLAYERS
    table.save()
    client.force_authenticate(user=staff)
    resp = client.post(f"/api/tables/{table.id}/seats")
    assert resp.status_code == 403


def test_happy_path_reserve_via_api(db, client):
    venue = Venue.objects.create(name="Board & Brew")
    VenueAvailability.objects.create(
        venue=venue, date=future_dt().date(),
        start_time=time(0, 0), end_time=time(23, 59, 59), tables_available=5,
    )
    host = make_user("alice")
    staff = make_user("carol", role=Role.VENUE_USER, venue=venue)
    table = make_table(host, venue)
    services.confirm_table(table=table, by_user=staff)

    client.force_authenticate(user=make_user("bob"))
    resp = client.post(f"/api/tables/{table.id}/seats")
    assert resp.status_code == 201
    assert resp.data["status"] == "reserved"


def test_available_filter_shows_only_bookable(db, client):
    venue = Venue.objects.create(name="Board & Brew")
    host = make_user("alice")

    def tbl(status):
        t = make_table(host, venue)
        t.status = status
        t.save()
        return t

    tbl(TableStatus.WAITING_FOR_VENUE_CONFIRMATION)
    wp = tbl(TableStatus.WAITING_FOR_PLAYERS)
    cf = tbl(TableStatus.CONFIRMED)
    tbl(TableStatus.CANCELLED)
    tbl(TableStatus.COMPLETED)

    resp = client.get("/api/tables?status=available")
    assert resp.status_code == 200
    ids = {t["id"] for t in resp.data}
    assert ids == {wp.id, cf.id}


def test_venue_user_list_scoped_to_own_venue(db, client):
    v1 = Venue.objects.create(name="Board & Brew")
    v2 = Venue.objects.create(name="Meeple Corner")
    make_table(make_user("alice"), v1)
    make_table(make_user("bob"), v2)
    staff = make_user("carol", role=Role.VENUE_USER, venue=v1)
    client.force_authenticate(user=staff)
    resp = client.get("/api/tables")
    assert resp.status_code == 200
    assert {t["venue"] for t in resp.data} == {v1.id}


def test_cross_user_personal_filter_forbidden(db, client):
    venue = Venue.objects.create(name="Board & Brew")
    a = make_user("alice")
    b = make_user("bob")
    make_table(b, venue)
    client.force_authenticate(user=a)
    assert client.get(f"/api/tables?organizerId={b.id}").status_code == 403
    assert client.get(f"/api/tables?attendeeId={b.id}").status_code == 403
    # own id is allowed
    assert client.get(f"/api/tables?organizerId={a.id}").status_code == 200


def test_anonymous_personal_filter_forbidden(db, client):
    venue = Venue.objects.create(name="Board & Brew")
    a = make_user("alice")
    make_table(a, venue)
    assert client.get(f"/api/tables?organizerId={a.id}").status_code == 403


def test_list_table_seats_shows_usernames(db, client):
    venue = Venue.objects.create(name="Board & Brew")
    VenueAvailability.objects.create(
        venue=venue, date=future_dt().date(),
        start_time=time(0, 0), end_time=time(23, 59, 59), tables_available=5,
    )
    host = make_user("alice")
    staff = make_user("carol", role=Role.VENUE_USER, venue=venue)
    table = make_table(host, venue)
    services.confirm_table(table=table, by_user=staff)
    bob = make_user("bob")
    services.reserve_seat(table=table, user=bob)

    # Anonymous cannot see attendee usernames; authenticated users can.
    assert client.get(f"/api/tables/{table.id}/seats").status_code in (401, 403)
    client.force_authenticate(user=bob)
    resp = client.get(f"/api/tables/{table.id}/seats")
    assert resp.status_code == 200
    by_name = {s["username"]: s for s in resp.data}
    assert set(by_name) == {"alice", "bob"}
    assert by_name["alice"]["is_organizer"] is True
    assert by_name["bob"]["is_organizer"] is False
    # organizer sorted first
    assert resp.data[0]["username"] == "alice"


def test_venue_user_cannot_host_via_api_403(db, client):
    venue = Venue.objects.create(name="Board & Brew")
    staff = make_user("carol", role=Role.VENUE_USER, venue=venue)
    client.force_authenticate(user=staff)
    resp = client.post(
        "/api/tables",
        {
            "venue": venue.id,
            "game_title": "Catan",
            "starts_at": (timezone.now() + timedelta(days=5)).isoformat(),
            "ends_at": (timezone.now() + timedelta(days=5, hours=2)).isoformat(),
            "min_players": 2,
            "max_players": 4,
        },
        format="json",
    )
    assert resp.status_code == 403
