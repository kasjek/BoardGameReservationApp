from datetime import time, timedelta

from django.db import migrations
from django.utils import timezone

END_BY_WEEKDAY = {
    0: time(20, 0),
    1: time(20, 0),
    2: time(20, 0),
    3: time(20, 0),
    4: time(22, 0),
    5: time(22, 0),
    6: time(20, 0),
}
OPEN_FROM = time(10, 0)


def seed_hours(apps, schema_editor):
    """Backfill Date House weekly hours using historical models only.

    Must not import the live Venue model — later migrations may add columns.
    """
    Venue = apps.get_model("venues", "Venue")
    VenueWeeklyHours = apps.get_model("venues", "VenueWeeklyHours")
    VenueAvailability = apps.get_model("venues", "VenueAvailability")

    venue, _ = Venue.objects.update_or_create(
        name="Date House Cafe",
        defaults={
            "location": "Breite G. 88, 90402 Nürnberg",
            "description": (
                "Board-game-friendly cafe in Nürnberg's old town.\n\n"
                "Table bookings:\n"
                "• Every day from 10:00\n"
                "• Mon–Thu until 20:00\n"
                "• Fri–Sat until 22:00\n"
                "• Sun until 20:00\n\n"
                "Tables for 2–8 players."
            ),
            "min_players": 2,
            "max_players": 8,
        },
    )

    for weekday in range(7):
        VenueWeeklyHours.objects.update_or_create(
            venue=venue,
            weekday=weekday,
            defaults={
                "is_closed": False,
                "start_time": OPEN_FROM,
                "end_time": END_BY_WEEKDAY[weekday],
            },
        )

    today = timezone.localdate()
    for offset in range(120):
        day = today + timedelta(days=offset)
        VenueAvailability.objects.update_or_create(
            venue=venue,
            date=day,
            defaults={
                "start_time": OPEN_FROM,
                "end_time": END_BY_WEEKDAY[day.weekday()],
                "tables_available": 3,
            },
        )


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("venues", "0005_weekly_hours_and_closures"),
    ]

    operations = [
        migrations.RunPython(seed_hours, noop),
    ]
