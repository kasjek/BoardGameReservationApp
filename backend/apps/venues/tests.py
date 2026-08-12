import pytest
from rest_framework.test import APIClient

from apps.accounts.models import Role, User
from apps.venues.models import Venue, VenueAvailability
from apps.venues.seed import (
    DATE_HOUSE_ADDRESS,
    DATE_HOUSE_NAME,
    end_time_for,
    ensure_date_house_cafe,
    ensure_katzentempel,
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
    assert "google.com/search" in resp.data["maps_url"]
    # Venue name leads the query so Google shows the business, not a bare street.
    assert "Date" in resp.data["maps_url"] or "House" in resp.data["maps_url"]
    assert "Breite" in resp.data["maps_url"]


def test_katzentempel_maps_url_searches_venue_name(db, client):
    venue = ensure_katzentempel(horizon_days=1)
    resp = client.get(f"/api/venues/{venue.id}")
    assert resp.status_code == 200
    url = resp.data["maps_url"]
    assert "google.com/search" in url
    assert "Katzentempel" in url
    assert "Peter-Vischer" in url or "Nürnberg" in url or "Nurnberg" in url


def test_create_table_respects_venue_player_limits(db):
    from datetime import time, timedelta

    from django.utils import timezone
    from rest_framework.exceptions import ValidationError

    from apps.tables import services

    venue = Venue.objects.create(name="Tiny Spot", min_players=2, max_players=4)
    host = mk("hosty")
    starts = timezone.now() + timedelta(days=2)
    starts = starts.replace(hour=18, minute=0, second=0, microsecond=0)
    ends = starts + timedelta(hours=2)
    VenueAvailability.objects.create(
        venue=venue,
        date=starts.date(),
        start_time=time(0, 0),
        end_time=time(23, 59, 59),
        tables_available=2,
    )
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


def test_seed_date_house_hours_match_google(db):
    """Mon–Thu/Sun close 20:00; Fri–Sat close 22:00; always open 10:00."""
    from datetime import time as dt_time

    from apps.venues.seed import OPEN_FROM

    venue = ensure_date_house_cafe(horizon_days=14)
    monday = next(r for r in venue.availability.all() if r.date.weekday() == 0)
    friday = next(r for r in venue.availability.all() if r.date.weekday() == 4)
    sunday = next(r for r in venue.availability.all() if r.date.weekday() == 6)
    assert monday.start_time == OPEN_FROM
    assert monday.end_time == dt_time(20, 0)
    assert friday.end_time == dt_time(22, 0)
    assert sunday.end_time == dt_time(20, 0)


def test_admin_creates_venue_with_weekly_hours_and_closure(db, client):
    from datetime import time as dt_time

    from apps.venues.hours import default_weekly_hours_payload
    from apps.venues.models import VenueClosure, VenueWeeklyHours

    admin = mk("dan", role=Role.ADMIN)
    client.force_authenticate(user=admin)
    hours = default_weekly_hours_payload()
    hours[0]["start_time"] = "11:00:00"
    hours[0]["end_time"] = "18:00:00"
    resp = client.post(
        "/api/venues",
        {
            "name": "Holiday Cafe",
            "location": "Teststrasse 1, Nürnberg",
            "min_reservation_minutes": 60,
            "max_reservation_minutes": 120,
            "weekly_hours": hours,
            "closures": [{"date": "2026-12-25", "comment": "Closed for Christmas"}],
        },
        format="json",
    )
    assert resp.status_code == 201, resp.data
    venue = Venue.objects.get(name="Holiday Cafe")
    assert venue.min_reservation_minutes == 60
    assert venue.max_reservation_minutes == 120
    assert VenueWeeklyHours.objects.filter(venue=venue).count() == 7
    monday = VenueWeeklyHours.objects.get(venue=venue, weekday=0)
    assert monday.start_time == dt_time(11, 0)
    closure = VenueClosure.objects.get(venue=venue, date="2026-12-25")
    assert "Christmas" in closure.comment
    # Closure day has no availability row.
    assert not VenueAvailability.objects.filter(venue=venue, date="2026-12-25").exists()


def test_closure_blocks_table_create(db):
    from datetime import timedelta

    from django.utils import timezone
    from rest_framework.exceptions import ValidationError

    from apps.tables import services
    from apps.venues.hours import set_weekly_hours
    from apps.venues.models import VenueClosure

    venue = Venue.objects.create(name="Closed Spot")
    set_weekly_hours(
        venue,
        [
            {
                "weekday": d,
                "is_closed": False,
                "start_time": "10:00:00",
                "end_time": "22:00:00",
            }
            for d in range(7)
        ],
    )
    day = timezone.localdate() + timedelta(days=5)
    VenueClosure.objects.create(venue=venue, date=day, comment="Staff outing")
    from apps.venues.hours import sync_availability_from_hours

    sync_availability_from_hours(venue)

    host = mk("hosty2")
    starts = timezone.now().replace(
        year=day.year, month=day.month, day=day.day, hour=14, minute=0, second=0, microsecond=0
    )
    ends = starts + timedelta(hours=2)
    with pytest.raises(ValidationError, match="Staff outing"):
        services.create_table(
            organizer=host,
            venue=venue,
            game_title="Catan",
            starts_at=starts,
            ends_at=ends,
            min_players=2,
            max_players=4,
        )


def test_venue_duration_limits_enforced_on_create(db):
    from datetime import timedelta

    from django.utils import timezone
    from rest_framework.exceptions import ValidationError

    from apps.tables import services
    from apps.venues.hours import set_weekly_hours
    from apps.venues.models import VenueAvailability

    venue = Venue.objects.create(
        name="Short Tables",
        min_reservation_minutes=60,
        max_reservation_minutes=120,
    )
    set_weekly_hours(
        venue,
        [
            {
                "weekday": d,
                "is_closed": False,
                "start_time": "10:00:00",
                "end_time": "22:00:00",
            }
            for d in range(7)
        ],
    )
    host = mk("durhost")
    starts = timezone.now() + timedelta(days=3)
    starts = starts.replace(hour=14, minute=0, second=0, microsecond=0)
    VenueAvailability.objects.update_or_create(
        venue=venue,
        date=starts.date(),
        defaults={
            "start_time": "10:00:00",
            "end_time": "22:00:00",
            "tables_available": 2,
        },
    )
    with pytest.raises(ValidationError, match="at least 60"):
        services.create_table(
            organizer=host,
            venue=venue,
            game_title="Catan",
            starts_at=starts,
            ends_at=starts + timedelta(minutes=30),
            min_players=2,
            max_players=4,
        )
    with pytest.raises(ValidationError, match="longer than 120"):
        services.create_table(
            organizer=host,
            venue=venue,
            game_title="Catan",
            starts_at=starts,
            ends_at=starts + timedelta(hours=3),
            min_players=2,
            max_players=4,
        )


def test_hours_and_closures_api_for_manager(db, client):
    from apps.venues.hours import default_weekly_hours_payload, set_weekly_hours

    venue = Venue.objects.create(name="Managed")
    set_weekly_hours(venue, default_weekly_hours_payload())
    staff = mk("carol", role=Role.VENUE_USER, venue=venue)
    client.force_authenticate(user=staff)

    hours = client.get(f"/api/venues/{venue.id}/hours")
    assert hours.status_code == 200
    assert len(hours.data) == 7

    put = client.put(
        f"/api/venues/{venue.id}/hours",
        [
            {
                "weekday": d,
                "is_closed": d == 6,
                "start_time": None if d == 6 else "10:00:00",
                "end_time": None if d == 6 else "20:00:00",
            }
            for d in range(7)
        ],
        format="json",
    )
    assert put.status_code == 200, put.data
    assert put.data[6]["is_closed"] is True

    add = client.post(
        f"/api/venues/{venue.id}/closures",
        {"date": "2026-05-01", "comment": "Labour Day"},
        format="json",
    )
    assert add.status_code == 201, add.data
    listed = client.get(f"/api/venues/{venue.id}/closures")
    assert listed.status_code == 200
    assert listed.data[0]["comment"] == "Labour Day"


def test_admin_adds_venue_game_from_bgg(db, client, monkeypatch):
    from apps.bgg import services as bgg
    from apps.venues.models import VenueGame

    monkeypatch.setattr(
        bgg,
        "fetch_thing",
        lambda bgg_id: {
            "bgg_id": bgg_id,
            "name": "Catan",
            "thumbnail_url": "https://cf.geekdo-images.com/catan.jpg",
        },
    )
    venue = Venue.objects.create(name="Game Shelf")
    admin = mk("dan", role=Role.ADMIN)
    client.force_authenticate(user=admin)
    resp = client.post(
        f"/api/venues/{venue.id}/games",
        {"bgg_id": 13},
        format="json",
    )
    assert resp.status_code == 201, resp.data
    assert resp.data["title"] == "Catan"
    assert resp.data["bgg_id"] == 13
    assert "catan.jpg" in resp.data["cover_url"]
    assert VenueGame.objects.filter(venue=venue, bgg_id=13).count() == 1

    # Public list
    client.logout()
    listed = client.get(f"/api/venues/{venue.id}/games")
    assert listed.status_code == 200
    assert listed.data[0]["title"] == "Catan"

    # Duplicate rejected
    client.force_authenticate(user=admin)
    dup = client.post(f"/api/venues/{venue.id}/games", {"bgg_id": 13}, format="json")
    assert dup.status_code == 400


def test_non_manager_cannot_add_venue_game(db, client):
    venue = Venue.objects.create(name="Game Shelf")
    someone = mk("alice")
    client.force_authenticate(user=someone)
    resp = client.post(
        f"/api/venues/{venue.id}/games",
        {"title": "Catan"},
        format="json",
    )
    assert resp.status_code == 403


def test_manager_can_remove_venue_game(db, client):
    from apps.venues.models import VenueGame

    venue = Venue.objects.create(name="Game Shelf")
    game = VenueGame.objects.create(venue=venue, title="Catan", bgg_id=13)
    staff = mk("carol", role=Role.VENUE_USER, venue=venue)
    client.force_authenticate(user=staff)
    resp = client.delete(f"/api/venues/{venue.id}/games/{game.id}")
    assert resp.status_code == 204
    assert not VenueGame.objects.filter(id=game.id).exists()


def test_venue_game_bgg_url_is_game_page_not_search(db, client):
    from apps.venues.models import VenueGame

    venue = Venue.objects.create(name="Game Shelf")
    VenueGame.objects.create(venue=venue, title="Catan", bgg_id=13)
    resp = client.get(f"/api/venues/{venue.id}/games")
    assert resp.status_code == 200
    assert resp.data[0]["bgg_url"] == "https://boardgamegeek.com/boardgame/13"
    assert "geeksearch" not in (resp.data[0]["bgg_url"] or "")


def test_bgg_redirect_uses_venue_game_bgg_id_when_api_unavailable(db, client, monkeypatch):
    from apps.bgg import services as bgg
    from apps.venues.models import VenueGame

    venue = Venue.objects.create(name="Game Shelf")
    VenueGame.objects.create(venue=venue, title="Catan", bgg_id=13)
    monkeypatch.setattr(bgg, "_bgg_search", lambda name: None)
    resp = client.get("/api/bgg/redirect?q=Catan")
    assert resp.status_code == 302
    assert resp["Location"] == "https://boardgamegeek.com/boardgame/13"


def test_seed_katzentempel(db):
    from datetime import time as dt_time

    from apps.venues.models import Venue, VenueGame, VenueWeeklyHours
    from apps.venues.seed import KATZENTEMPEL_NAME, ensure_katzentempel

    Venue.objects.create(name="Katzentempel Nürnberg", location="Old")
    venue = ensure_katzentempel(horizon_days=7)
    assert venue.name == KATZENTEMPEL_NAME
    assert venue.name == "Katzentempel"
    assert Venue.objects.filter(name__icontains="Katzen").count() == 1
    assert "Peter-Vischer" in venue.location
    hours = list(VenueWeeklyHours.objects.filter(venue=venue).order_by("weekday"))
    assert len(hours) == 7
    assert hours[0].start_time == dt_time(10, 0)
    assert hours[4].start_time == dt_time(9, 30)
    assert hours[6].end_time == dt_time(19, 30)
    titles = set(VenueGame.objects.filter(venue=venue, is_active=True).values_list("title", flat=True))
    assert titles == {"The Isle of Cats", "Nekojima", "Spicy", "Calico"}
    assert VenueGame.objects.filter(venue=venue, title="Calico").first().bgg_id == 283155
    assert VenueGame.objects.filter(venue=venue, title="Spicy").first().bgg_id == 299169
    assert VenueGame.objects.filter(venue=venue, title="Nekojima").first().bgg_id == 359029
    assert VenueGame.objects.filter(venue=venue, title="The Isle of Cats").first().bgg_id == 281259
