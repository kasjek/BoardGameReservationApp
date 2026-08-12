from django.db import migrations


def forwards(apps, schema_editor):
    from apps.venues.demo_users import ensure_venue_managers
    from apps.venues.seed import ensure_hotel_knorz

    ensure_hotel_knorz()
    ensure_venue_managers()


def backwards(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    """Seed Hotel Knorz and link Katzentempel + Knorz VENUE_USER managers."""

    dependencies = [
        ("venues", "0014_merge_0013_leaves"),
        ("venues", "0014_fix_patchwork_onitama_catan_covers"),
        ("accounts", "0002_user_avatar_seed"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
