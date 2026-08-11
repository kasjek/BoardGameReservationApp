from django.db import migrations


def seed_games(apps, schema_editor):
    from apps.venues.seed import ensure_date_house_cafe

    # Refresh venue + availability + game catalog for Date House Cafe.
    ensure_date_house_cafe(horizon_days=1)


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("venues", "0004_venue_games"),
    ]

    operations = [
        migrations.RunPython(seed_games, noop),
    ]
