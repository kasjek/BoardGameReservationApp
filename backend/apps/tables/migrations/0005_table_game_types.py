from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tables", "0004_table_status_and_seat_paid"),
    ]

    operations = [
        migrations.AddField(
            model_name="table",
            name="game_types",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
