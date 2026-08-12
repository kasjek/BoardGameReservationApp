from django.db import migrations


def forwards(apps, schema_editor):
    """Refresh Date House Cafe description + weekly hours to match Google/Apple Maps."""
    from apps.venues.seed import ensure_date_house_cafe

    ensure_date_house_cafe()


def backwards(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("venues", "0012_fix_katzentempel_bgg_ids"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
