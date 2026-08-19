from django.db import migrations, models


def forwards(apps, schema_editor):
    Table = apps.get_model("tables", "Table")
    Table.objects.filter(bring_own_game=True).update(bring_own_game=False)


def backwards(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("tables", "0003_seed_date_house_demo_tables"),
    ]

    operations = [
        migrations.AlterField(
            model_name="table",
            name="bring_own_game",
            field=models.BooleanField(default=False),
        ),
        migrations.RunPython(forwards, backwards),
    ]
