from django.db import migrations


def forwards(apps, schema_editor):
    from apps.venues.demo_users import ensure_venue_managers
    from apps.venues.seed import ensure_hotel_knorz

    ensure_hotel_knorz()
    ensure_venue_managers()


def backwards(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    """Seed Hotel Knorz and link Katzentempel + Knorz VENUE_USER managers.

    Also merges the three parallel venues.0013_* leaf migrations.
    """

    dependencies = [
        ("venues", "0013_fix_isle_spicy_covers"),
        ("venues", "0013_refresh_date_house_google_hours"),
        ("venues", "0013_rename_katzentempel"),
        ("accounts", "0002_user_avatar_seed"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
