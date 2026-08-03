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
        {"username": "newuser", "email": "n@example.com", "password": "supersecret1"},
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
