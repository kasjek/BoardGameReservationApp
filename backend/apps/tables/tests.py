from datetime import time, timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied

from apps.accounts.models import Role
from apps.venues.models import Venue, VenueAvailability

from . import services
from .models import LateCancellationMark, SeatStatus, TableStatus

User = get_user_model()


def make_user(username, role=Role.USER, venue=None):
    return User.objects.create_user(
        username=username, password="pw-testing-123", role=role, venue=venue
    )


def future_dt(days=10, hour=18, minute=0):
    base = timezone.now() + timedelta(days=days)
    return base.replace(hour=hour, minute=minute, second=0, microsecond=0)


@pytest.fixture
def venue(db):
    return Venue.objects.create(name="Board & Brew", location="Berlin")


@pytest.fixture
def wide_availability(venue):
    """Availability covering the default future_dt() window with capacity 5."""
    return VenueAvailability.objects.create(
        venue=venue,
        date=future_dt().date(),
        start_time=time(0, 0),
        end_time=time(23, 59, 59),
        tables_available=5,
    )


def ensure_wide_availability(venue, day, tables_available=5):
    """Guarantee a covering availability row so create_table can succeed in tests."""
    VenueAvailability.objects.get_or_create(
        venue=venue,
        date=day,
        defaults={
            "start_time": time(0, 0),
            "end_time": time(23, 59, 59),
            "tables_available": tables_available,
        },
    )


def make_table(organizer, venue, bring_own_game=True, ensure_availability=True, **kwargs):
    params = {
        "organizer": organizer,
        "venue": venue,
        "game_title": "Catan",
        "starts_at": future_dt(hour=18),
        "ends_at": future_dt(hour=20),
        "min_players": 2,
        "max_players": 3,
        "bring_own_game": bring_own_game,
    }
    params.update(kwargs)
    if ensure_availability:
        ensure_wide_availability(venue, params["starts_at"].date())
    return services.create_table(**params)


# --- Hosting & role rules ---------------------------------------------------

def test_host_creates_pending_table_and_is_seated(db, venue):
    host = make_user("alice")
    table = make_table(host, venue)
    assert table.status == TableStatus.WAITING_FOR_VENUE_CONFIRMATION
    assert table.seats_taken == 1
    seat = table.seats.get(user=host)
    assert seat.is_organizer and seat.status == SeatStatus.RESERVED


def test_venue_user_cannot_host(db, venue):
    staff = make_user("carol", role=Role.VENUE_USER, venue=venue)
    with pytest.raises(PermissionDenied):
        make_table(staff, venue)


def test_venue_user_cannot_reserve(db, venue):
    host = make_user("alice")
    staff = make_user("carol", role=Role.VENUE_USER, venue=venue)
    table = make_table(host, venue)
    table.status = TableStatus.WAITING_FOR_PLAYERS
    table.save()
    with pytest.raises(PermissionDenied):
        services.reserve_seat(table=table, user=staff)


# --- Venue-first confirmation (decision 2) ----------------------------------

def test_reserve_blocked_before_venue_confirmation(db, venue):
    host = make_user("alice")
    bob = make_user("bob")
    table = make_table(host, venue)  # still waiting_for_venue_confirmation
    with pytest.raises(services.Conflict):
        services.reserve_seat(table=table, user=bob)


def test_confirm_requires_venue_or_admin(db, venue, wide_availability):
    host = make_user("alice")
    other = make_user("bob")
    table = make_table(host, venue)
    with pytest.raises(PermissionDenied):
        services.confirm_table(table=table, by_user=other)


def test_confirm_sets_waiting_for_players_and_confirms_venue_game(db, venue, wide_availability):
    host = make_user("alice")
    staff = make_user("carol", role=Role.VENUE_USER, venue=venue)
    table = make_table(host, venue, bring_own_game=False, game_title="Carcassonne")
    services.confirm_table(table=table, by_user=staff)
    table.refresh_from_db()
    assert table.status == TableStatus.WAITING_FOR_PLAYERS
    assert table.venue_game_confirmed is True


# --- Capacity, confirmation transition & waitlist (ADR-011/013) -------------

def test_reserve_confirms_when_min_reached(db, venue, wide_availability):
    host = make_user("alice")
    staff = make_user("carol", role=Role.VENUE_USER, venue=venue)
    table = make_table(host, venue)  # min 2, max 3; organizer seated (1)
    services.confirm_table(table=table, by_user=staff)
    services.reserve_seat(table=table, user=make_user("bob"))  # seats_taken -> 2 == min
    table.refresh_from_db()
    assert table.seats_taken == 2
    assert table.status == TableStatus.CONFIRMED


def test_reserve_beyond_max_waitlists(db, venue, wide_availability):
    host = make_user("alice")
    staff = make_user("carol", role=Role.VENUE_USER, venue=venue)
    table = make_table(host, venue)  # max 3, organizer seated (1)
    services.confirm_table(table=table, by_user=staff)
    services.reserve_seat(table=table, user=make_user("bob"))  # 2
    services.reserve_seat(table=table, user=make_user("dora"))  # 3 (full)
    waitlisted = services.reserve_seat(table=table, user=make_user("erin"))
    table.refresh_from_db()
    assert table.seats_taken == 3
    assert waitlisted.status == SeatStatus.WAITLISTED
    assert waitlisted.waitlist_position == 1


def test_duplicate_reserve_conflicts(db, venue, wide_availability):
    host = make_user("alice")
    staff = make_user("carol", role=Role.VENUE_USER, venue=venue)
    table = make_table(host, venue)
    services.confirm_table(table=table, by_user=staff)
    bob = make_user("bob")
    services.reserve_seat(table=table, user=bob)
    with pytest.raises(services.Conflict):
        services.reserve_seat(table=table, user=bob)


def test_overlapping_reservation_rejected(db, venue):
    player = make_user("player")
    a = make_table(make_user("hostA"), venue, starts_at=future_dt(hour=18), ends_at=future_dt(hour=20))
    b = make_table(make_user("hostB"), venue, starts_at=future_dt(hour=19), ends_at=future_dt(hour=21))
    for t in (a, b):
        t.status = TableStatus.WAITING_FOR_PLAYERS
        t.save()
    services.reserve_seat(table=a, user=player)
    with pytest.raises(services.Conflict):
        services.reserve_seat(table=b, user=player)  # overlaps a


def test_non_overlapping_reservation_ok(db, venue):
    player = make_user("player")
    a = make_table(make_user("hostA"), venue, starts_at=future_dt(hour=18), ends_at=future_dt(hour=20))
    c = make_table(make_user("hostC"), venue, starts_at=future_dt(hour=21), ends_at=future_dt(hour=23))
    for t in (a, c):
        t.status = TableStatus.WAITING_FOR_PLAYERS
        t.save()
    services.reserve_seat(table=a, user=player)
    seat = services.reserve_seat(table=c, user=player)  # no overlap
    assert seat.status == SeatStatus.RESERVED


def test_cancel_promotes_earliest_waitlisted(db, venue, wide_availability):
    host = make_user("alice")
    staff = make_user("carol", role=Role.VENUE_USER, venue=venue)
    table = make_table(host, venue)  # max 3
    services.confirm_table(table=table, by_user=staff)
    bob = make_user("bob")
    services.reserve_seat(table=table, user=bob)  # 2
    services.reserve_seat(table=table, user=make_user("dora"))  # 3 full
    erin = make_user("erin")
    services.reserve_seat(table=table, user=erin)  # waitlisted #1

    services.cancel_seat(table=table, user=bob)  # frees a reserved seat

    table.refresh_from_db()
    erin_seat = table.seats.get(user=erin)
    assert erin_seat.status == SeatStatus.RESERVED
    assert table.seats_taken == 3


# --- Late cancellation marks (decision 7) -----------------------------------

def test_late_cancellation_creates_mark(db, venue):
    host = make_user("alice")
    bob = make_user("bob")
    table = make_table(
        host, venue, starts_at=timezone.now() + timedelta(hours=2),
        ends_at=timezone.now() + timedelta(hours=4),
    )
    table.status = TableStatus.WAITING_FOR_PLAYERS
    table.save()
    services.reserve_seat(table=table, user=bob)
    services.cancel_seat(table=table, user=bob)
    assert LateCancellationMark.objects.filter(user=bob, table=table).count() == 1


def test_early_cancellation_creates_no_mark(db, venue):
    host = make_user("alice")
    bob = make_user("bob")
    table = make_table(host, venue)  # starts in 10 days
    table.status = TableStatus.WAITING_FOR_PLAYERS
    table.save()
    services.reserve_seat(table=table, user=bob)
    services.cancel_seat(table=table, user=bob)
    assert LateCancellationMark.objects.filter(user=bob).count() == 0


# --- Organizer cancels table (FR-B7) ----------------------------------------

def test_organizer_can_cancel_table(db, venue):
    host = make_user("alice")
    table = make_table(host, venue)
    services.cancel_table(table=table, by_user=host)
    table.refresh_from_db()
    assert table.status == TableStatus.CANCELLED


def test_non_organizer_cannot_cancel_table(db, venue):
    host = make_user("alice")
    bob = make_user("bob")
    table = make_table(host, venue)
    with pytest.raises(PermissionDenied):
        services.cancel_table(table=table, by_user=bob)


# --- Venue capacity + 15-minute turnover (decision 3) -----------------------

def test_venue_capacity_turnover_blocks_too_close_table(db, venue):
    host = make_user("alice")
    staff = make_user("carol", role=Role.VENUE_USER, venue=venue)
    VenueAvailability.objects.create(
        venue=venue, date=future_dt().date(),
        start_time=time(0, 0), end_time=time(23, 59, 59), tables_available=1,
    )
    a = make_table(host, venue, starts_at=future_dt(hour=18), ends_at=future_dt(hour=20))
    services.confirm_table(table=a, by_user=staff)

    # Table B starts only 10 minutes after A ends -> within the 15-min buffer.
    b = make_table(
        make_user("bob"), venue,
        starts_at=future_dt(hour=20, minute=10), ends_at=future_dt(hour=22),
    )
    with pytest.raises(services.Conflict):
        services.confirm_table(table=b, by_user=staff)


def test_venue_capacity_allows_when_capacity_available(db, venue):
    host = make_user("alice")
    staff = make_user("carol", role=Role.VENUE_USER, venue=venue)
    VenueAvailability.objects.create(
        venue=venue, date=future_dt().date(),
        start_time=time(0, 0), end_time=time(23, 59, 59), tables_available=2,
    )
    a = make_table(host, venue, starts_at=future_dt(hour=18), ends_at=future_dt(hour=20))
    services.confirm_table(table=a, by_user=staff)
    b = make_table(
        make_user("bob"), venue,
        starts_at=future_dt(hour=20, minute=10), ends_at=future_dt(hour=22),
    )
    services.confirm_table(table=b, by_user=staff)  # capacity 2 -> allowed
    b.refresh_from_db()
    assert b.status == TableStatus.WAITING_FOR_PLAYERS


# --- Duration + opening hours on create -------------------------------------

def test_create_rejects_shorter_than_one_hour(db, venue):
    from rest_framework.exceptions import ValidationError

    host = make_user("alice")
    with pytest.raises(ValidationError, match="at least 60 minutes"):
        make_table(
            host,
            venue,
            starts_at=future_dt(hour=18),
            ends_at=future_dt(hour=18, minute=30),
        )


def test_create_rejects_longer_than_three_hours(db, venue):
    from rest_framework.exceptions import ValidationError

    host = make_user("alice")
    with pytest.raises(ValidationError, match="longer than 180 minutes"):
        make_table(
            host,
            venue,
            starts_at=future_dt(hour=14),
            ends_at=future_dt(hour=18),
        )


def test_create_rejects_outside_opening_hours(db, venue):
    from rest_framework.exceptions import ValidationError

    host = make_user("alice")
    # Cafe opens at 10:00 — a 09:00–11:00 booking must be rejected.
    VenueAvailability.objects.create(
        venue=venue,
        date=future_dt().date(),
        start_time=time(10, 0),
        end_time=time(20, 0),
        tables_available=3,
    )
    with pytest.raises(ValidationError, match="not open"):
        make_table(
            host,
            venue,
            ensure_availability=False,
            starts_at=future_dt(hour=9),
            ends_at=future_dt(hour=11),
        )


def test_create_allows_slot_inside_opening_hours(db, venue):
    host = make_user("alice")
    VenueAvailability.objects.create(
        venue=venue,
        date=future_dt().date(),
        start_time=time(10, 0),
        end_time=time(20, 0),
        tables_available=3,
    )
    table = make_table(
        host,
        venue,
        ensure_availability=False,
        starts_at=future_dt(hour=10),
        ends_at=future_dt(hour=12),
    )
    assert table.status == TableStatus.WAITING_FOR_VENUE_CONFIRMATION
