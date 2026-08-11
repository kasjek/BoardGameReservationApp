"""Demo venue seed data (Date House Cafe).

Idempotent helpers used by the management command and data migration.
"""

from __future__ import annotations

from datetime import date, time, timedelta

from django.utils import timezone

from .models import Venue, VenueAvailability

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

# Weekday → last moment a reservation may end (Python: Mon=0 … Sun=6).
END_BY_WEEKDAY: dict[int, time] = {
    0: time(20, 30),  # Monday
    1: time(20, 30),  # Tuesday
    2: time(20, 30),  # Wednesday
    3: time(20, 30),  # Thursday
    4: time(22, 30),  # Friday
    5: time(22, 30),  # Saturday
    6: time(19, 30),  # Sunday
}
OPEN_FROM = time(10, 0)
# Concurrent physical tables the venue can confirm in overlapping slots.
TABLES_AVAILABLE = 3
DEFAULT_HORIZON_DAYS = 120


def end_time_for(day: date) -> time:
    return END_BY_WEEKDAY[day.weekday()]


def ensure_date_house_cafe(*, horizon_days: int = DEFAULT_HORIZON_DAYS) -> Venue:
    """Create/update Date House Cafe and fill availability for the next N days."""
    venue, _ = Venue.objects.update_or_create(
        name=DATE_HOUSE_NAME,
        defaults={
            "location": DATE_HOUSE_ADDRESS,
            "description": DATE_HOUSE_DESCRIPTION,
            "min_players": 2,
            "max_players": 8,
        },
    )

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
    return venue


def google_maps_url(address: str) -> str:
    from urllib.parse import quote_plus

    return f"https://www.google.com/maps/search/?api=1&query={quote_plus(address)}"
