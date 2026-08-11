"""Demo venue seed data (Date House Cafe).

Idempotent helpers used by the management command and data migration.

Opening hours match publicly listed Google/RestaurantGuru hours for
Date House Café (Bindergasse / Nürnberg old town), updated Jul 2026:
  Mon–Thu 10:00–20:00
  Fri–Sat 10:00–22:00
  Sun     10:00–20:00
"""

from __future__ import annotations

from datetime import date, time, timedelta

from django.db import connection
from django.utils import timezone

from .models import Venue, VenueAvailability

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
    return venue


def google_maps_url(address: str) -> str:
    from urllib.parse import quote_plus

    return f"https://www.google.com/maps/search/?api=1&query={quote_plus(address)}"
