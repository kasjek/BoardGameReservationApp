from django.db import migrations


def forwards(apps, schema_editor):
    Venue = apps.get_model("venues", "Venue")
    Venue.objects.filter(name="Katzentempel Nürnberg").update(name="Katzentempel")


def backwards(apps, schema_editor):
    Venue = apps.get_model("venues", "Venue")
    Venue.objects.filter(name="Katzentempel").update(name="Katzentempel Nürnberg")


class Migration(migrations.Migration):
    dependencies = [
        ("venues", "0012_fix_katzentempel_bgg_ids"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
