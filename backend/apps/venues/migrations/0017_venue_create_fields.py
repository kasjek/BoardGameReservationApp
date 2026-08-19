from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("venues", "0016_hotel_knorz_games_and_tables"),
    ]

    operations = [
        migrations.AddField(
            model_name="venue",
            name="booking_horizon_weeks",
            field=models.PositiveSmallIntegerField(default=12),
        ),
        migrations.AddField(
            model_name="venue",
            name="min_spend",
            field=models.CharField(blank=True, default="", max_length=80),
        ),
        migrations.AddField(
            model_name="venue",
            name="picture_ext",
            field=models.CharField(blank=True, default="", max_length=8),
        ),
    ]
