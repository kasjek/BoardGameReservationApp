from django.db import migrations, models


def set_patchwork_two_seats(apps, schema_editor):
    VenueGame = apps.get_model("venues", "VenueGame")
    VenueGame.objects.filter(title__iexact="Patchwork").update(min_players=2, max_players=2)


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("venues", "0016_hotel_knorz_games_and_tables"),
    ]

    operations = [
        migrations.AddField(
            model_name="venuegame",
            name="min_players",
            field=models.PositiveIntegerField(default=2),
        ),
        migrations.AddField(
            model_name="venuegame",
            name="max_players",
            field=models.PositiveIntegerField(default=8),
        ),
        migrations.RunPython(set_patchwork_two_seats, noop),
    ]
