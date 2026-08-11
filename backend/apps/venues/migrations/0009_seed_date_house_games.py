from django.db import migrations

DATE_HOUSE_GAMES = (
    ("Love Letter", 129622),
    ("Fog of Love", 215311),
    ("Patchwork", 163412),
    ("7 Wonders Duel", 173346),
    ("Chronicles of Crime", 239188),
    ("Onitama", 158138),
)


def seed_games(apps, schema_editor):
    Venue = apps.get_model("venues", "Venue")
    VenueGame = apps.get_model("venues", "VenueGame")
    venue = Venue.objects.filter(name="Date House Cafe").first()
    if not venue:
        return
    for title, bgg_id in DATE_HOUSE_GAMES:
        VenueGame.objects.update_or_create(
            venue=venue,
            title=title,
            defaults={"is_active": True, "bgg_id": bgg_id},
        )


def unseed_games(apps, schema_editor):
    Venue = apps.get_model("venues", "Venue")
    VenueGame = apps.get_model("venues", "VenueGame")
    venue = Venue.objects.filter(name="Date House Cafe").first()
    if not venue:
        return
    titles = [t for t, _ in DATE_HOUSE_GAMES]
    VenueGame.objects.filter(venue=venue, title__in=titles).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("venues", "0008_venue_games"),
    ]

    operations = [
        migrations.RunPython(seed_games, unseed_games),
    ]
