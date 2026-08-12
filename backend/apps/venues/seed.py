"""Demo venue seed data (Date House Cafe, Katzentempel).

Idempotent helpers used by the management command and data migration.

Date House Café hours match publicly listed Google/RestaurantGuru hours
(Bindergasse / Nürnberg old town), updated Jul 2026:
  Mon–Thu 10:00–20:00
  Fri–Sat 10:00–22:00
  Sun     10:00–20:00
"""

from __future__ import annotations

from datetime import date, time, timedelta

from django.db import connection
from django.utils import timezone

from .models import Venue, VenueAvailability, VenueGame

DATE_HOUSE_NAME = "Date House Cafe"
DATE_HOUSE_ADDRESS = "Breite G. 88, 90402 Nürnberg"
DATE_HOUSE_DESCRIPTION = (
    "Board-game-friendly cafe in Nürnberg's old town.\n\n"
    "Opening hours (table bookings):\n"
    "• Every day from 10:00\n"
    "• Mon–Thu until 20:00\n"
    "• Fri–Sat until 22:00\n"
    "• Sun until 20:00\n\n"
    "Tables for 2–8 players. Bookings 1–3 hours."
)
# (title, BoardGameGeek id) — id links straight to the game page, not search.
DATE_HOUSE_GAMES = (
    ("Love Letter", 129622),
    ("Fog of Love", 215311),
    ("Patchwork", 163412),
    ("7 Wonders Duel", 173346),
    ("Chronicles of Crime", 239188),
    ("Onitama", 158138),
)

# Weekday → last moment a reservation may end (Python: Mon=0 … Sun=6).
# Sourced from Google / RestaurantGuru listing for Date House Café.
END_BY_WEEKDAY: dict[int, time] = {
    0: time(20, 0),  # Monday
    1: time(20, 0),  # Tuesday
    2: time(20, 0),  # Wednesday
    3: time(20, 0),  # Thursday
    4: time(22, 0),  # Friday
    5: time(22, 0),  # Saturday
    6: time(20, 0),  # Sunday
}
OPEN_FROM = time(10, 0)
# Concurrent physical tables the venue can confirm in overlapping slots.
TABLES_AVAILABLE = 3
DEFAULT_HORIZON_DAYS = 120

# Katzentempel — hours from katzentempel.de / directory listings.
KATZENTEMPEL_NAME = "Katzentempel"
KATZENTEMPEL_LEGACY_NAMES = ("Katzentempel Nürnberg",)
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
# Correct BGG thing ids (previous seed accidentally used unrelated games).
KATZENTEMPEL_GAMES = (
    ("The Isle of Cats", 281259),
    ("Nekojima", 359029),
    ("Spicy", 299169),
    ("Calico", 283155),
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
    return END_BY_WEEKDAY[day.weekday()]


def _legacy_seed_availability(venue: Venue, *, horizon_days: int) -> None:
    today = timezone.localdate()
    for offset in range(horizon_days):
        day = today + timedelta(days=offset)
        VenueAvailability.objects.update_or_create(
            venue=venue,
            date=day,
            defaults={
                "start_time": OPEN_FROM,
                "end_time": end_time_for(day),
                "tables_available": TABLES_AVAILABLE,
            },
        )


def ensure_date_house_cafe(*, horizon_days: int = DEFAULT_HORIZON_DAYS) -> Venue:
    """Create/update Date House Cafe and fill weekly hours + availability."""
    # Do not set reservation-duration fields here: older RunPython migrations
    # call this before those columns exist (model defaults cover them later).
    venue, _ = Venue.objects.update_or_create(
        name=DATE_HOUSE_NAME,
        defaults={
            "location": DATE_HOUSE_ADDRESS,
            "description": DATE_HOUSE_DESCRIPTION,
            "min_players": 2,
            "max_players": 8,
        },
    )

    tables = connection.introspection.table_names()
    if "venues_venueweeklyhours" in tables:
        from .hours import set_weekly_hours

        payload = [
            {
                "weekday": d,
                "is_closed": False,
                "start_time": OPEN_FROM,
                "end_time": END_BY_WEEKDAY[d],
            }
            for d in range(7)
        ]
        set_weekly_hours(
            venue,
            payload,
            tables_available=TABLES_AVAILABLE,
            horizon_days=horizon_days,
        )
    else:
        # Older migrations call this before VenueWeeklyHours exists.
        _legacy_seed_availability(venue, horizon_days=horizon_days)

    if "venues_venuegame" in tables:
        for title, bgg_id in DATE_HOUSE_GAMES:
            VenueGame.objects.update_or_create(
                venue=venue,
                title=title,
                defaults={"is_active": True, "bgg_id": bgg_id},
            )
    return venue


def ensure_katzentempel(*, horizon_days: int = DEFAULT_HORIZON_DAYS) -> Venue:
    """Create/update Katzentempel with weekly hours, availability, and games."""
    # Fold legacy seeded titles into the canonical name without duplicating the venue.
    Venue.objects.filter(name__in=KATZENTEMPEL_LEGACY_NAMES).update(name=KATZENTEMPEL_NAME)
    duplicates = list(Venue.objects.filter(name=KATZENTEMPEL_NAME).order_by("id"))
    defaults = {
        "location": KATZENTEMPEL_ADDRESS,
        "description": KATZENTEMPEL_DESCRIPTION,
        "min_players": 2,
        "max_players": 8,
    }
    if duplicates:
        venue = duplicates[0]
        for field, value in defaults.items():
            setattr(venue, field, value)
        venue.save(update_fields=[*defaults.keys()])
        for extra in duplicates[1:]:
            extra.delete()
    else:
        venue = Venue.objects.create(name=KATZENTEMPEL_NAME, **defaults)

    tables = connection.introspection.table_names()
    if "venues_venueweeklyhours" in tables:
        from .hours import set_weekly_hours

        payload = [
            {
                "weekday": d,
                "is_closed": False,
                "start_time": KATZENTEMPEL_OPEN_BY_WEEKDAY[d],
                "end_time": KATZENTEMPEL_END_BY_WEEKDAY[d],
            }
            for d in range(7)
        ]
        set_weekly_hours(
            venue,
            payload,
            tables_available=TABLES_AVAILABLE,
            horizon_days=horizon_days,
        )
    else:
        today = timezone.localdate()
        for offset in range(horizon_days):
            day = today + timedelta(days=offset)
            weekday = day.weekday()
            VenueAvailability.objects.update_or_create(
                venue=venue,
                date=day,
                defaults={
                    "start_time": KATZENTEMPEL_OPEN_BY_WEEKDAY[weekday],
                    "end_time": KATZENTEMPEL_END_BY_WEEKDAY[weekday],
                    "tables_available": TABLES_AVAILABLE,
                },
            )

    if "venues_venuegame" in tables:
        wanted_titles = {title for title, _ in KATZENTEMPEL_GAMES}
        # Drop obsolete titles from earlier incorrect seeds (e.g. "Island of Cats").
        VenueGame.objects.filter(venue=venue).exclude(title__in=wanted_titles).delete()
        for title, bgg_id in KATZENTEMPEL_GAMES:
            VenueGame.objects.update_or_create(
                venue=venue,
                title=title,
                defaults={"is_active": True, "bgg_id": bgg_id},
            )
    return venue


def ensure_demo_venues(*, horizon_days: int = DEFAULT_HORIZON_DAYS) -> list[Venue]:
    """Seed all demo venues."""
    return [
        ensure_date_house_cafe(horizon_days=horizon_days),
        ensure_katzentempel(horizon_days=horizon_days),
    ]


def google_maps_url(address: str = "", *, name: str = "") -> str:
    """Google search URL that leads with the venue name so it is clearly visible.

    Bare street addresses alone hide the venue on Google; prefer
    ``Name Address`` (e.g. ``Katzentempel Peter-Vischer-Straße 21…``).
    """
    from urllib.parse import quote_plus

    parts = [p.strip() for p in (name, address) if p and str(p).strip()]
    query = " ".join(parts)
    return f"https://www.google.com/search?q={quote_plus(query)}"
