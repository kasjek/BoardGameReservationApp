from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tables", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="table",
            name="game_types",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
