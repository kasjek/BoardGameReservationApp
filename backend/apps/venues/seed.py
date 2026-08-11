"""Demo venue seed data (Date House Cafe, Katzentempel Nürnberg).

Idempotent helpers used by the management command and data migrations.
"""

from __future__ import annotations

from datetime import date, time, timedelta

from django.db import connection
from django.utils import timezone

from .models import Venue, VenueAvailability, VenueGame

DEFAULT_HORIZON_DAYS = 120
DEFAULT_TABLES_AVAILABLE = 3

# ---------------------------------------------------------------------------
# Date House Cafe
# ---------------------------------------------------------------------------

DATE_HOUSE_NAME = "Date House Cafe"
DATE_HOUSE_ADDRESS = "Breite G. 88, 90402 Nürnberg"
DATE_HOUSE_DESCRIPTION = (
    "Board-game-friendly cafe in Nürnberg's old town.\n\n"
    "Table bookings:\n"
    "• Every day from 10:00\n"
    "• Mon–Thu until 20:30\n"
    "• Fri–Sat until 22:30\n"
    "• Sun until 19:30\n\n"
    "Tables for 2–8 players."
)
DATE_HOUSE_GAMES = (
    "Love Letter",
    "Fog of Love",
    "Patchwork",
    "7 Wonders Duel",
    "Chronicles of Crime",
    "Onitama",
)
# Weekday → open / close (Python: Mon=0 … Sun=6).
DATE_HOUSE_OPEN_BY_WEEKDAY: dict[int, time] = {d: time(10, 0) for d in range(7)}
DATE_HOUSE_END_BY_WEEKDAY: dict[int, time] = {
    0: time(20, 30),
    1: time(20, 30),
    2: time(20, 30),
    3: time(20, 30),
    4: time(22, 30),
    5: time(22, 30),
    6: time(19, 30),
}

# Back-compat aliases used by existing tests / helpers.
END_BY_WEEKDAY = DATE_HOUSE_END_BY_WEEKDAY
OPEN_FROM = time(10, 0)
TABLES_AVAILABLE = DEFAULT_TABLES_AVAILABLE

# ---------------------------------------------------------------------------
# Katzentempel Nürnberg — hours from katzentempel.de / directory listings
# ---------------------------------------------------------------------------

KATZENTEMPEL_NAME = "Katzentempel Nürnberg"
KATZENTEMPEL_ADDRESS = "Peter-Vischer-Straße 21, 90403 Nürnberg"
KATZENTEMPEL_DESCRIPTION = (
    "Vegan cat café restaurant in Nürnberg's old town — cats roam freely "
    "while guests enjoy plant-based food and drinks.\n\n"
    "Opening hours (table bookings):\n"
    "• Mon–Thu 10:00–20:30\n"
    "• Fri–Sat 09:30–20:30\n"
    "• Sun 09:30–19:30\n\n"
    "Tables for 2–8 players."
)
KATZENTEMPEL_GAMES = (
    "Island of Cats",
    "Nekojima",
    "Spicy",
    "Calico",
)
KATZENTEMPEL_OPEN_BY_WEEKDAY: dict[int, time] = {
    0: time(10, 0),
    1: time(10, 0),
    2: time(10, 0),
    3: time(10, 0),
    4: time(9, 30),
    5: time(9, 30),
    6: time(9, 30),
}
KATZENTEMPEL_END_BY_WEEKDAY: dict[int, time] = {
    0: time(20, 30),
    1: time(20, 30),
    2: time(20, 30),
    3: time(20, 30),
    4: time(20, 30),
    5: time(20, 30),
    6: time(19, 30),
}


def end_time_for(day: date) -> time:
    """Date House Cafe close time (kept for existing tests)."""
    return DATE_HOUSE_END_BY_WEEKDAY[day.weekday()]


def _seed_availability(
    venue: Venue,
    *,
    open_by_weekday: dict[int, time],
    end_by_weekday: dict[int, time],
    tables_available: int,
    horizon_days: int,
) -> None:
    today = timezone.localdate()
    for offset in range(horizon_days):
        day = today + timedelta(days=offset)
        weekday = day.weekday()
        VenueAvailability.objects.update_or_create(
            venue=venue,
            date=day,
            defaults={
                "start_time": open_by_weekday[weekday],
                "end_time": end_by_weekday[weekday],
                "tables_available": tables_available,
            },
        )


def _seed_games(venue: Venue, titles: tuple[str, ...]) -> None:
    # Skip when called from older migrations (before venues_venuegame exists).
    if "venues_venuegame" not in connection.introspection.table_names():
        return
    for title in titles:
        VenueGame.objects.update_or_create(
            venue=venue,
            title=title,
            defaults={"is_active": True},
        )


def ensure_venue(
    *,
    name: str,
    location: str,
    description: str,
    open_by_weekday: dict[int, time],
    end_by_weekday: dict[int, time],
    games: tuple[str, ...],
    min_players: int = 2,
    max_players: int = 8,
    tables_available: int = DEFAULT_TABLES_AVAILABLE,
    horizon_days: int = DEFAULT_HORIZON_DAYS,
) -> Venue:
    venue, _ = Venue.objects.update_or_create(
        name=name,
        defaults={
            "location": location,
            "description": description,
            "min_players": min_players,
            "max_players": max_players,
        },
    )
    _seed_availability(
        venue,
        open_by_weekday=open_by_weekday,
        end_by_weekday=end_by_weekday,
        tables_available=tables_available,
        horizon_days=horizon_days,
    )
    _seed_games(venue, games)
    return venue


def ensure_date_house_cafe(*, horizon_days: int = DEFAULT_HORIZON_DAYS) -> Venue:
    """Create/update Date House Cafe and fill availability + games."""
    return ensure_venue(
        name=DATE_HOUSE_NAME,
        location=DATE_HOUSE_ADDRESS,
        description=DATE_HOUSE_DESCRIPTION,
        open_by_weekday=DATE_HOUSE_OPEN_BY_WEEKDAY,
        end_by_weekday=DATE_HOUSE_END_BY_WEEKDAY,
        games=DATE_HOUSE_GAMES,
        horizon_days=horizon_days,
    )


def ensure_katzentempel(*, horizon_days: int = DEFAULT_HORIZON_DAYS) -> Venue:
    """Create/update Katzentempel Nürnberg and fill availability + games."""
    return ensure_venue(
        name=KATZENTEMPEL_NAME,
        location=KATZENTEMPEL_ADDRESS,
        description=KATZENTEMPEL_DESCRIPTION,
        open_by_weekday=KATZENTEMPEL_OPEN_BY_WEEKDAY,
        end_by_weekday=KATZENTEMPEL_END_BY_WEEKDAY,
        games=KATZENTEMPEL_GAMES,
        horizon_days=horizon_days,
    )


def ensure_demo_venues(*, horizon_days: int = DEFAULT_HORIZON_DAYS) -> list[Venue]:
    """Seed all demo venues."""
    return [
        ensure_date_house_cafe(horizon_days=horizon_days),
        ensure_katzentempel(horizon_days=horizon_days),
    ]


def google_maps_url(address: str) -> str:
    from urllib.parse import quote_plus

    return f"https://www.google.com/maps/search/?api=1&query={quote_plus(address)}"
