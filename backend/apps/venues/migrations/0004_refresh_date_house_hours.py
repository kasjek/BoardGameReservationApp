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


def refresh_hours(apps, schema_editor):
    """Re-seed Date House Cafe availability using historical models only."""
    Venue = apps.get_model("venues", "Venue")
    VenueAvailability = apps.get_model("venues", "VenueAvailability")

    venue = Venue.objects.filter(name="Date House Cafe").first()
    if not venue:
        return

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
        ("venues", "0003_seed_date_house_cafe"),
    ]

    operations = [
        migrations.RunPython(refresh_hours, noop),
    ]
