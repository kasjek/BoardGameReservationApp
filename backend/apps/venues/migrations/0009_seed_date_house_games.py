from django.db import migrations

DATE_HOUSE_GAMES = (
    "Love Letter",
    "Fog of Love",
    "Patchwork",
    "7 Wonders Duel",
    "Chronicles of Crime",
    "Onitama",
)


def seed_games(apps, schema_editor):
    Venue = apps.get_model("venues", "Venue")
    VenueGame = apps.get_model("venues", "VenueGame")
    venue = Venue.objects.filter(name="Date House Cafe").first()
    if not venue:
        return
    for title in DATE_HOUSE_GAMES:
        VenueGame.objects.update_or_create(
            venue=venue,
            title=title,
            defaults={"is_active": True},
        )


def unseed_games(apps, schema_editor):
    Venue = apps.get_model("venues", "Venue")
    VenueGame = apps.get_model("venues", "VenueGame")
    venue = Venue.objects.filter(name="Date House Cafe").first()
    if not venue:
        return
    VenueGame.objects.filter(venue=venue, title__in=DATE_HOUSE_GAMES).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("venues", "0008_venue_games"),
    ]

    operations = [
        migrations.RunPython(seed_games, unseed_games),
    ]
