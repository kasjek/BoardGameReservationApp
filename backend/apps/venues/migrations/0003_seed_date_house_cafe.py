from datetime import time, timedelta

from django.db import migrations
from django.utils import timezone

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
END_BY_WEEKDAY = {
    0: time(20, 30),
    1: time(20, 30),
    2: time(20, 30),
    3: time(20, 30),
    4: time(22, 30),
    5: time(22, 30),
    6: time(19, 30),
}
OPEN_FROM = time(10, 0)


def seed_forward(apps, schema_editor):
    """Seed Date House using historical models only (safe if Venue gains columns later)."""
    Venue = apps.get_model("venues", "Venue")
    VenueAvailability = apps.get_model("venues", "VenueAvailability")

    defaults = {
        "location": DATE_HOUSE_ADDRESS,
        "description": DATE_HOUSE_DESCRIPTION,
        "min_players": 2,
        "max_players": 8,
    }
    venue, _ = Venue.objects.update_or_create(name=DATE_HOUSE_NAME, defaults=defaults)

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


def seed_backward(apps, schema_editor):
    Venue = apps.get_model("venues", "Venue")
    Venue.objects.filter(name=DATE_HOUSE_NAME).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("venues", "0002_venue_player_capacity"),
    ]

    operations = [
        migrations.RunPython(seed_forward, seed_backward),
    ]
