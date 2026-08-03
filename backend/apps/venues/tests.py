import pytest
from rest_framework.test import APIClient

from apps.accounts.models import Role, User
from apps.venues.models import Venue, VenueAvailability


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
