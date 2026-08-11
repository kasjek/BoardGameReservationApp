from django.db import migrations


def seed_hours(apps, schema_editor):
    from apps.venues.seed import ensure_date_house_cafe

    ensure_date_house_cafe()


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("venues", "0005_weekly_hours_and_closures"),
    ]

    operations = [
        migrations.RunPython(seed_hours, noop),
    ]
