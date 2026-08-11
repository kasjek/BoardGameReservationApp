import pytest
from rest_framework.test import APIClient

from apps.accounts.models import Role, User
from apps.venues.models import Venue, VenueAvailability
from apps.venues.seed import (
    DATE_HOUSE_ADDRESS,
    DATE_HOUSE_NAME,
    end_time_for,
    ensure_date_house_cafe,
)


def mk(username, role=Role.USER, venue=None):
    return User.objects.create_user(username=username, password="pw-testing-123", role=role, venue=venue)


@pytest.fixture
def client():
    return APIClient()


def test_venue_user_can_add_availability(db, client):
    venue = Venue.objects.create(name="Board & Brew")
    staff = mk("carol", role=Role.VENUE_USER, venue=venue)
    client.force_authenticate(user=staff)
    resp = client.post(
        f"/api/venues/{venue.id}/availability",
        {"date": "2026-09-01", "start_time": "17:00", "end_time": "23:00", "tables_available": 4},
        format="json",
    )
    assert resp.status_code == 201, resp.data
    assert VenueAvailability.objects.filter(venue=venue, date="2026-09-01").count() == 1


def test_non_manager_cannot_add_availability(db, client):
    venue = Venue.objects.create(name="Board & Brew")
    someone = mk("alice")
    client.force_authenticate(user=someone)
    resp = client.post(
        f"/api/venues/{venue.id}/availability",
        {"date": "2026-09-01", "start_time": "17:00", "end_time": "23:00", "tables_available": 4},
        format="json",
    )
    assert resp.status_code == 403


def test_admin_can_create_venue(db, client):
    admin = mk("dan", role=Role.ADMIN)
    client.force_authenticate(user=admin)
    resp = client.post("/api/venues", {"name": "New Place", "location": "Berlin"}, format="json")
    assert resp.status_code == 201
    assert Venue.objects.filter(name="New Place").exists()


def test_regular_user_cannot_create_venue(db, client):
    user = mk("alice")
    client.force_authenticate(user=user)
    resp = client.post("/api/venues", {"name": "Nope"}, format="json")
    assert resp.status_code == 403


def test_seed_date_house_cafe(db):
    from datetime import timedelta

    from django.utils import timezone

    venue = ensure_date_house_cafe(horizon_days=14)
    assert venue.name == DATE_HOUSE_NAME
    assert venue.location == DATE_HOUSE_ADDRESS
    assert venue.min_players == 2
    assert venue.max_players == 8
    today = timezone.localdate()
    rows = list(
        VenueAvailability.objects.filter(
            venue=venue, date__gte=today, date__lt=today + timedelta(days=14)
        ).order_by("date")
    )
    assert len(rows) == 14
    assert all(r.start_time.hour == 10 and r.start_time.minute == 0 for r in rows)
    for r in rows:
        assert r.end_time == end_time_for(r.date)


def test_venue_detail_includes_maps_url_and_capacity(db, client):
    venue = ensure_date_house_cafe(horizon_days=1)
    resp = client.get(f"/api/venues/{venue.id}")
    assert resp.status_code == 200
    assert resp.data["min_players"] == 2
    assert resp.data["max_players"] == 8
    assert "google.com/maps" in resp.data["maps_url"]
    assert "Breite" in resp.data["maps_url"]


def test_create_table_respects_venue_player_limits(db):
    from datetime import timedelta

    from django.utils import timezone
    from rest_framework.exceptions import ValidationError

    from apps.tables import services

    venue = Venue.objects.create(name="Tiny Spot", min_players=2, max_players=4)
    host = mk("hosty")
    starts = timezone.now() + timedelta(days=2)
    ends = starts + timedelta(hours=2)
    with pytest.raises(ValidationError):
        services.create_table(
            organizer=host,
            venue=venue,
            game_title="Catan",
            starts_at=starts,
            ends_at=ends,
            min_players=2,
            max_players=8,
        )
