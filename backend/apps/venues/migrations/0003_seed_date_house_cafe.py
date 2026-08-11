from django.db import migrations


def seed_forward(apps, schema_editor):
    # Import after apps are loaded so we use the real models + helpers.
    from apps.venues.seed import ensure_date_house_cafe

    ensure_date_house_cafe()


def seed_backward(apps, schema_editor):
    Venue = apps.get_model("venues", "Venue")
    Venue.objects.filter(name="Date House Cafe").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("venues", "0002_venue_player_capacity"),
    ]

    operations = [
        migrations.RunPython(seed_forward, seed_backward),
    ]
