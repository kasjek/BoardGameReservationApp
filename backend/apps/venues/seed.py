"""Demo venue seed data (Date House Cafe, Katzentempel, Hotel Knorz).

Idempotent helpers used by the management command and data migration.

Date House Café (Breite Gasse 88) hours match Google / Apple Maps listings:
  Mon–Thu 10:00–20:00
  Fri     10:00–22:00
  Sat     09:00–22:00
  Sun     09:00–20:00
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
    "Opening hours:\n"
    "• Mon–Thu 10:00–20:00\n"
    "• Fri 10:00–22:00\n"
    "• Sat 09:00–22:00\n"
    "• Sun 09:00–20:00\n\n"
    "Tables for 2–8 players. Bookings 1–3 hours."
)
# (title, BoardGameGeek id) — id links straight to the game page, not search.
DATE_HOUSE_GAMES = (
    ("Love Letter", 129622),
    ("Fog of Love", 215311),
    ("Patchwork", 163412),
    ("7 Wonders Duel", 173346),
    ("Chronicles of Crime", 239188),
    ("Onitama", 160477),
)

# Weekday → open / close (Python: Mon=0 … Sun=6). Sourced from Google / Apple Maps.
DATE_HOUSE_OPEN_BY_WEEKDAY: dict[int, time] = {
    0: time(10, 0),  # Monday
    1: time(10, 0),  # Tuesday
    2: time(10, 0),  # Wednesday
    3: time(10, 0),  # Thursday
    4: time(10, 0),  # Friday
    5: time(9, 0),  # Saturday
    6: time(9, 0),  # Sunday
}
END_BY_WEEKDAY: dict[int, time] = {
    0: time(20, 0),  # Monday
    1: time(20, 0),  # Tuesday
    2: time(20, 0),  # Wednesday
    3: time(20, 0),  # Thursday
    4: time(22, 0),  # Friday
    5: time(22, 0),  # Saturday
    6: time(20, 0),  # Sunday
}
# Backward-compatible alias (weekday open time for Mon–Fri).
OPEN_FROM = DATE_HOUSE_OPEN_BY_WEEKDAY[0]
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

# Hotel Knorz — family hotel near Playmobil FunPark (Zirndorf).
# Bookable hours match Google/HRS reception hours for this property (daily 08:00–20:00).
# Booking rules match Date House Cafe (2–8 players, 1–3 hour tables, 3 concurrent).
HOTEL_KNORZ_NAME = "Hotel Knorz"
HOTEL_KNORZ_ADDRESS = "Volkhardtstraße 18, 90513 Zirndorf"
HOTEL_KNORZ_DESCRIPTION = (
    "Family boutique hotel in Zirndorf near the Playmobil FunPark — board games "
    "to borrow at reception, garden, and rooms for overnight guests.\n\n"
    "Opening hours (reception / table bookings, Google/HRS):\n"
    "• Mon–Sun 08:00–20:00\n\n"
    "Tables for 2–8 players. Bookings 1–3 hours."
)
HOTEL_KNORZ_GAMES = (
    ("Secret Hitler", 188834),
    ("Codenames Pictures", 198773),
    ("Let's Summon Demons", 325829),  # user request: "Let's summon deamons"
    ("Cascadia", 295947),
    ("Verdant", 334065),
    ("The Fake Artist in New York", 135779),  # BGG: A Fake Artist Goes to New York
)
HOTEL_KNORZ_OPEN_BY_WEEKDAY: dict[int, time] = {d: time(8, 0) for d in range(7)}
HOTEL_KNORZ_END_BY_WEEKDAY: dict[int, time] = {d: time(20, 0) for d in range(7)}


def _venue_db_columns() -> set[str]:
    with connection.cursor() as cursor:
        desc = connection.introspection.get_table_description(cursor, Venue._meta.db_table)
    return {col.name for col in desc}


def _unmigrated_venue_fields() -> list[str]:
    existing = _venue_db_columns()
    missing: list[str] = []
    for field in Venue._meta.local_concrete_fields:
        if field.primary_key or not field.column:
            continue
        if field.column not in existing:
            missing.append(field.name)
    return missing


def _venues():
    missing = _unmigrated_venue_fields()
    qs = Venue.objects.all()
    return qs.defer(*missing) if missing else qs


def _upsert_venue(*, name: str, defaults: dict) -> Venue:
    """Create/update a venue without SELECTing columns that older migrations have not added yet."""
    existing_cols = _venue_db_columns()
    filtered = {}
    for key, value in defaults.items():
        column = Venue._meta.get_field(key).column
        if column in existing_cols:
            filtered[key] = value
    try:
        venue = _venues().get(name=name)
        if filtered:
            for key, value in filtered.items():
                setattr(venue, key, value)
            venue.save(update_fields=list(filtered.keys()))
        return venue
    except Venue.DoesNotExist:
        payload = {"name": name, **filtered}
        missing = _unmigrated_venue_fields()
        if not missing:
            return Venue.objects.create(**payload)
        now = timezone.now()
        for fname in ("created_at", "updated_at"):
            field = Venue._meta.get_field(fname)
            if field.column in existing_cols and fname not in payload:
                payload[fname] = now
        table = Venue._meta.db_table
        columns = [Venue._meta.get_field(key).column for key in payload]
        placeholders = ", ".join(["%s"] * len(columns))
        col_sql = ", ".join(columns)
        with connection.cursor() as cursor:
            cursor.execute(
                f"INSERT INTO {table} ({col_sql}) VALUES ({placeholders})",
                list(payload.values()),
            )
        return _venues().get(name=name)


def end_time_for(day: date) -> time:
    return END_BY_WEEKDAY[day.weekday()]


def open_time_for(day: date) -> time:
    return DATE_HOUSE_OPEN_BY_WEEKDAY[day.weekday()]


def _legacy_seed_availability(venue: Venue, *, horizon_days: int) -> None:
    today = timezone.localdate()
    for offset in range(horizon_days):
        day = today + timedelta(days=offset)
        VenueAvailability.objects.update_or_create(
            venue=venue,
            date=day,
            defaults={
                "start_time": open_time_for(day),
                "end_time": end_time_for(day),
                "tables_available": TABLES_AVAILABLE,
            },
        )


def ensure_date_house_cafe(*, horizon_days: int = DEFAULT_HORIZON_DAYS) -> Venue:
    """Create/update Date House Cafe and fill weekly hours + availability."""
    # Do not set newer columns here: older RunPython migrations call this before
    # those columns exist (model defaults cover them later).
    venue = _upsert_venue(
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
                "start_time": DATE_HOUSE_OPEN_BY_WEEKDAY[d],
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
        from apps.bgg import services as bgg_services

        for title, bgg_id in DATE_HOUSE_GAMES:
            game, _ = VenueGame.objects.update_or_create(
                venue=venue,
                title=title,
                defaults={"is_active": True, "bgg_id": bgg_id},
            )
            if not bgg_services._is_bgg_cover_url(game.thumbnail_url):
                bgg_services.refresh_venue_game_cover(game)
    return venue


def ensure_katzentempel(*, horizon_days: int = DEFAULT_HORIZON_DAYS) -> Venue:
    """Create/update Katzentempel with weekly hours, availability, and games."""
    # Fold legacy seeded titles into the canonical name without duplicating the venue.
    _venues().filter(name__in=KATZENTEMPEL_LEGACY_NAMES).update(name=KATZENTEMPEL_NAME)
    duplicates = list(_venues().filter(name=KATZENTEMPEL_NAME).order_by("id"))
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
        venue = _upsert_venue(name=KATZENTEMPEL_NAME, defaults=defaults)

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
        from apps.bgg import services as bgg_services

        for title, bgg_id in KATZENTEMPEL_GAMES:
            game, _ = VenueGame.objects.update_or_create(
                venue=venue,
                title=title,
                defaults={"is_active": True, "bgg_id": bgg_id},
            )
            if not bgg_services._is_bgg_cover_url(game.thumbnail_url):
                bgg_services.refresh_venue_game_cover(game)
    return venue


def ensure_hotel_knorz(*, horizon_days: int = DEFAULT_HORIZON_DAYS) -> Venue:
    """Create/update Hotel Knorz with Google/HRS hours and Date House booking rules."""
    defaults = {
        "location": HOTEL_KNORZ_ADDRESS,
        "description": HOTEL_KNORZ_DESCRIPTION,
        "min_players": 2,
        "max_players": 8,
        "min_reservation_minutes": 60,
        "max_reservation_minutes": 180,
    }
    venue = _upsert_venue(name=HOTEL_KNORZ_NAME, defaults=defaults)

    tables = connection.introspection.table_names()
    if "venues_venueweeklyhours" in tables:
        from .hours import set_weekly_hours

        payload = [
            {
                "weekday": d,
                "is_closed": False,
                "start_time": HOTEL_KNORZ_OPEN_BY_WEEKDAY[d],
                "end_time": HOTEL_KNORZ_END_BY_WEEKDAY[d],
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
                    "start_time": HOTEL_KNORZ_OPEN_BY_WEEKDAY[weekday],
                    "end_time": HOTEL_KNORZ_END_BY_WEEKDAY[weekday],
                    "tables_available": TABLES_AVAILABLE,
                },
            )

    if "venues_venuegame" in tables:
        from apps.bgg import services as bgg_services

        wanted_titles = {title for title, _ in HOTEL_KNORZ_GAMES}
        VenueGame.objects.filter(venue=venue).exclude(title__in=wanted_titles).delete()
        for title, bgg_id in HOTEL_KNORZ_GAMES:
            game, _ = VenueGame.objects.update_or_create(
                venue=venue,
                title=title,
                defaults={"is_active": True, "bgg_id": bgg_id},
            )
            if not bgg_services._is_bgg_cover_url(game.thumbnail_url):
                bgg_services.refresh_venue_game_cover(game)
    return venue


def ensure_demo_venues(*, horizon_days: int = DEFAULT_HORIZON_DAYS) -> list[Venue]:
    """Seed all demo venues."""
    return [
        ensure_date_house_cafe(horizon_days=horizon_days),
        ensure_katzentempel(horizon_days=horizon_days),
        ensure_hotel_knorz(horizon_days=horizon_days),
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
