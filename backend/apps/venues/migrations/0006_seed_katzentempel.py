from django.db import migrations


def seed_forward(apps, schema_editor):
    from apps.venues.seed import ensure_katzentempel

    ensure_katzentempel()


def seed_backward(apps, schema_editor):
    Venue = apps.get_model("venues", "Venue")
    Venue.objects.filter(name="Katzentempel Nürnberg").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("venues", "0005_seed_date_house_games"),
    ]

    operations = [
        migrations.RunPython(seed_forward, seed_backward),
    ]
