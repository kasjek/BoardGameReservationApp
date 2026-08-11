"""Weekly hours ↔ per-date availability sync, and closure helpers."""

from __future__ import annotations

from datetime import date, time, timedelta

from django.utils import timezone

from .models import Venue, VenueAvailability, VenueClosure, VenueWeeklyHours

DEFAULT_HORIZON_DAYS = 120
DEFAULT_TABLES_AVAILABLE = 3
DEFAULT_OPEN = time(10, 0)
DEFAULT_CLOSE = time(20, 0)

WEEKDAY_NAMES = (
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
)


def default_weekly_hours_payload() -> list[dict]:
    return [
        {
            "weekday": d,
            "is_closed": False,
            "start_time": DEFAULT_OPEN.strftime("%H:%M:%S"),
            "end_time": DEFAULT_CLOSE.strftime("%H:%M:%S"),
        }
        for d in range(7)
    ]


def set_weekly_hours(
    venue: Venue,
    hours: list[dict],
    *,
    tables_available: int = DEFAULT_TABLES_AVAILABLE,
    horizon_days: int = DEFAULT_HORIZON_DAYS,
) -> list[VenueWeeklyHours]:
    """Replace a venue's weekly hours and rematerialize date availability."""
    if len(hours) != 7:
        raise ValueError("Exactly 7 weekday hour rows are required (Monday–Sunday).")
    by_day = {int(h["weekday"]): h for h in hours}
    if set(by_day) != set(range(7)):
        raise ValueError("Weekday values must be 0–6 covering every day of the week.")

    rows: list[VenueWeeklyHours] = []
    for weekday in range(7):
        h = by_day[weekday]
        is_closed = bool(h.get("is_closed"))
        start = None if is_closed else h.get("start_time")
        end = None if is_closed else h.get("end_time")
        if not is_closed:
            if not start or not end:
                raise ValueError(f"{WEEKDAY_NAMES[weekday]} needs start_time and end_time.")
            if isinstance(start, str):
                start = time.fromisoformat(start)
            if isinstance(end, str):
                end = time.fromisoformat(end)
            if end <= start:
                raise ValueError(f"{WEEKDAY_NAMES[weekday]} end_time must be after start_time.")
        row, _ = VenueWeeklyHours.objects.update_or_create(
            venue=venue,
            weekday=weekday,
            defaults={
                "is_closed": is_closed,
                "start_time": start,
                "end_time": end,
            },
        )
        rows.append(row)

    sync_availability_from_hours(
        venue, tables_available=tables_available, horizon_days=horizon_days
    )
    return rows


def ensure_default_weekly_hours(venue: Venue) -> list[VenueWeeklyHours]:
    if venue.weekly_hours.count() == 7:
        return list(venue.weekly_hours.order_by("weekday"))
    return set_weekly_hours(venue, default_weekly_hours_payload())


def sync_availability_from_hours(
    venue: Venue,
    *,
    tables_available: int = DEFAULT_TABLES_AVAILABLE,
    horizon_days: int = DEFAULT_HORIZON_DAYS,
) -> int:
    """Rebuild VenueAvailability for the next N days from weekly hours + closures."""
    hours = {h.weekday: h for h in venue.weekly_hours.all()}
    if len(hours) != 7:
        return 0

    closed_dates = set(venue.closures.values_list("date", flat=True))
    today = timezone.localdate()
    kept = 0
    for offset in range(horizon_days):
        day = today + timedelta(days=offset)
        # Always clear regenerated rows for this day, then recreate if open.
        VenueAvailability.objects.filter(venue=venue, date=day).delete()
        if day in closed_dates:
            continue
        wh = hours[day.weekday()]
        if wh.is_closed or not wh.start_time or not wh.end_time:
            continue
        VenueAvailability.objects.create(
            venue=venue,
            date=day,
            start_time=wh.start_time,
            end_time=wh.end_time,
            tables_available=tables_available,
        )
        kept += 1
    return kept


def closure_for(venue: Venue, day: date) -> VenueClosure | None:
    return venue.closures.filter(date=day).first()


def assert_slot_bookable(venue: Venue, starts_at, ends_at) -> None:
    """Raise ValidationError if the slot is closed or outside published hours."""
    from rest_framework.exceptions import ValidationError

    if starts_at.date() != ends_at.date():
        raise ValidationError("Bookings must start and end on the same calendar day.")

    day = starts_at.date()
    closure = closure_for(venue, day)
    if closure is not None:
        raise ValidationError(
            f"This venue is not bookable on {day.isoformat()}: {closure.comment}"
        )

    start_t = starts_at.timetz().replace(tzinfo=None)
    end_t = ends_at.timetz().replace(tzinfo=None)
    covering = [
        a
        for a in venue.availability.filter(date=day)
        if a.start_time <= start_t and a.end_time >= end_t
    ]
    if not covering:
        raise ValidationError(
            "This venue is not open for the requested time. "
            "Choose a slot within the venue's bookable hours."
        )
