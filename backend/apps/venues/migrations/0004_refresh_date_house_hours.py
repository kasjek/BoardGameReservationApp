from django.db import migrations


def refresh_hours(apps, schema_editor):
    """Re-seed Date House Cafe availability to match published Google hours."""
    from apps.venues.seed import ensure_date_house_cafe

    ensure_date_house_cafe()


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("venues", "0003_seed_date_house_cafe"),
    ]

    operations = [
        migrations.RunPython(refresh_hours, noop),
    ]
