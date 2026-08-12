from datetime import time, timedelta

from django.db import migrations
from django.utils import timezone

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
    ("Island of Cats", 284210),
    ("Nekojima", 359871),
    ("Spicy", 350933),
    ("Calico", 283929),
)
OPEN_BY_WEEKDAY = {
    0: time(10, 0),
    1: time(10, 0),
    2: time(10, 0),
    3: time(10, 0),
    4: time(9, 30),
    5: time(9, 30),
    6: time(9, 30),
}
END_BY_WEEKDAY = {
    0: time(20, 30),
    1: time(20, 30),
    2: time(20, 30),
    3: time(20, 30),
    4: time(20, 30),
    5: time(20, 30),
    6: time(19, 30),
}


def seed_forward(apps, schema_editor):
    """Seed Katzentempel using historical models only."""
    Venue = apps.get_model("venues", "Venue")
    VenueWeeklyHours = apps.get_model("venues", "VenueWeeklyHours")
    VenueAvailability = apps.get_model("venues", "VenueAvailability")
    VenueGame = apps.get_model("venues", "VenueGame")

    venue, _ = Venue.objects.update_or_create(
        name=KATZENTEMPEL_NAME,
        defaults={
            "location": KATZENTEMPEL_ADDRESS,
            "description": KATZENTEMPEL_DESCRIPTION,
            "min_players": 2,
            "max_players": 8,
            "min_reservation_minutes": 60,
            "max_reservation_minutes": 180,
        },
    )

    for weekday in range(7):
        VenueWeeklyHours.objects.update_or_create(
            venue=venue,
            weekday=weekday,
            defaults={
                "is_closed": False,
                "start_time": OPEN_BY_WEEKDAY[weekday],
                "end_time": END_BY_WEEKDAY[weekday],
            },
        )

    today = timezone.localdate()
    for offset in range(120):
        day = today + timedelta(days=offset)
        weekday = day.weekday()
        VenueAvailability.objects.update_or_create(
            venue=venue,
            date=day,
            defaults={
                "start_time": OPEN_BY_WEEKDAY[weekday],
                "end_time": END_BY_WEEKDAY[weekday],
                "tables_available": 3,
            },
        )

    for title, bgg_id in KATZENTEMPEL_GAMES:
        VenueGame.objects.update_or_create(
            venue=venue,
            title=title,
            defaults={"is_active": True, "bgg_id": bgg_id},
        )


def seed_backward(apps, schema_editor):
    Venue = apps.get_model("venues", "Venue")
    Venue.objects.filter(name=KATZENTEMPEL_NAME).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("venues", "0010_backfill_venue_game_bgg_ids"),
    ]

    operations = [
        migrations.RunPython(seed_forward, seed_backward),
    ]
