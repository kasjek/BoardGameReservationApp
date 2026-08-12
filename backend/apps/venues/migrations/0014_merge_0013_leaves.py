from django.db import migrations


class Migration(migrations.Migration):
    """Merge the three parallel venues.0013_* leaf migrations."""

    dependencies = [
        ("venues", "0013_fix_isle_spicy_covers"),
        ("venues", "0013_refresh_date_house_google_hours"),
        ("venues", "0013_rename_katzentempel"),
    ]

    operations = []
