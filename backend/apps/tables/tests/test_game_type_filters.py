from datetime import time, timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import Role
from apps.tables import services
from apps.tables.models import TableStatus
from apps.venues.models import Venue, VenueAvailability, VenueGame

User = get_user_model()


def make_user(username, role=Role.USER, venue=None):
    return User.objects.create_user(
        username=username, password="pw-testing-123", role=role, venue=venue
    )


def future_dt(days=10, hour=18, minute=0):
    base = timezone.now() + timedelta(days=days)
    return base.replace(hour=hour, minute=minute, second=0, microsecond=0)


def make_table(organizer, venue, **kwargs):
    kwargs.pop("bring_own_game", None)
    params = {
        "organizer": organizer,
        "venue": venue,
        "game_title": "Catan",
        "starts_at": future_dt(hour=18),
        "ends_at": future_dt(hour=20),
        "min_players": 2,
        "max_players": 3,
    }
    params.update(kwargs)
    VenueAvailability.objects.get_or_create(
        venue=venue,
        date=params["starts_at"].date(),
        defaults={
            "start_time": time(0, 0),
            "end_time": time(23, 59, 59),
            "tables_available": 5,
        },
    )
    title = params["game_title"]
    VenueGame.objects.get_or_create(venue=venue, title=title, defaults={"is_active": True})
    return services.create_table(**params)


@pytest.fixture
def client():
    return APIClient()


def test_list_filters_by_venue_and_bgg_type(db, client):
    v1 = Venue.objects.create(name="Board & Brew")
    v2 = Venue.objects.create(name="Meeple Corner")
    host = make_user("type-filter-host")

    catan = make_table(host, v1, game_title="Catan")
    catan.game_types = ["strategy", "family"]
    catan.status = TableStatus.WAITING_FOR_PLAYERS
    catan.save()

    codenames = make_table(host, v2, game_title="Codenames")
    codenames.game_types = ["party"]
    codenames.status = TableStatus.WAITING_FOR_PLAYERS
    codenames.save()

    azul = make_table(host, v1, game_title="Azul")
    azul.game_types = ["abstract", "family"]
    azul.status = TableStatus.WAITING_FOR_PLAYERS
    azul.save()

    by_venue = client.get(f"/api/tables?venueId={v1.id}")
    assert by_venue.status_code == 200
    assert {t["id"] for t in by_venue.data} == {catan.id, azul.id}

    by_type = client.get("/api/tables?type=party")
    assert by_type.status_code == 200
    assert {t["id"] for t in by_type.data} == {codenames.id}

    both = client.get(f"/api/tables?venueId={v1.id}&type=family")
    assert both.status_code == 200
    assert {t["id"] for t in both.data} == {catan.id, azul.id}


def test_table_detail_includes_game_types(db, client):
    venue = Venue.objects.create(name="Board & Brew")
    table = make_table(make_user("type-detail-host"), venue, game_title="Catan")
    table.game_types = ["strategy", "family"]
    table.save()
    resp = client.get(f"/api/tables/{table.id}")
    assert resp.status_code == 200
    assert resp.data["game_types"] == ["strategy", "family"]
