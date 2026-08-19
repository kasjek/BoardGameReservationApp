from django.db import migrations


def forwards(apps, schema_editor):
    Venue = apps.get_model("venues", "Venue")
    Venue.objects.filter(name="Hotel Knorz").update(
        location="Volkhardtstraße 18, 90513 Zirndorf"
    )


def backwards(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    """Set Hotel Knorz to its street address in Zirndorf."""

    dependencies = [
        ("venues", "0016_hotel_knorz_games_and_tables"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
