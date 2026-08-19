from datetime import time, timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.accounts.models import Role
from apps.tables import services
from apps.venues.models import Venue, VenueAvailability, VenueGame

User = get_user_model()


def make_user(username, role=Role.USER, venue=None):
    return User.objects.create_user(
        username=username, password="pw-testing-123", role=role, venue=venue
    )


def future_dt(days=10, hour=18, minute=0):
    base = timezone.now() + timedelta(days=days)
    return base.replace(hour=hour, minute=minute, second=0, microsecond=0)


def ensure_hours(venue, day):
    VenueAvailability.objects.get_or_create(
        venue=venue,
        date=day,
        defaults={
            "start_time": time(0, 0),
            "end_time": time(23, 59, 59),
            "tables_available": 5,
        },
    )


@pytest.mark.django_db
def test_host_must_pick_a_venue_library_game():
    venue = Venue.objects.create(name="Board & Brew")
    host = make_user("library-host")
    ensure_hours(venue, future_dt().date())
    with pytest.raises(ValidationError, match="venue's library"):
        services.create_table(
            organizer=host,
            venue=venue,
            game_title="Not In Stock",
            starts_at=future_dt(hour=18),
            ends_at=future_dt(hour=20),
            min_players=2,
            max_players=3,
        )


@pytest.mark.django_db
def test_host_table_is_always_a_venue_game():
    venue = Venue.objects.create(name="Board & Brew")
    host = make_user("library-host-2")
    ensure_hours(venue, future_dt().date())
    VenueGame.objects.create(venue=venue, title="Catan", is_active=True)
    table = services.create_table(
        organizer=host,
        venue=venue,
        game_title="Catan",
        starts_at=future_dt(hour=18),
        ends_at=future_dt(hour=20),
        min_players=2,
        max_players=3,
        bring_own_game=True,
    )
    assert table.bring_own_game is False
