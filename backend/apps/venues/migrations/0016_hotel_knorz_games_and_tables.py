from django.db import migrations


def forwards(apps, schema_editor):
    from apps.tables.seed import ensure_hotel_knorz_demo_tables
    from apps.venues.seed import ensure_hotel_knorz

    ensure_hotel_knorz()
    ensure_hotel_knorz_demo_tables()


def backwards(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    """Replace Hotel Knorz shelf games and seed five example tables."""

    dependencies = [
        ("venues", "0015_seed_hotel_knorz"),
        ("tables", "0003_seed_date_house_demo_tables"),
        ("accounts", "0002_user_avatar_seed"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
