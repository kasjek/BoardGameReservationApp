from django.db import migrations

# Titles that previously cached wrong Wikipedia images (Isle of Man flag / Sean Evans).
TITLES = (
    "The Isle of Cats",
    "Isle of Cats",
    "Island of Cats",
    "Spicy",
)
CACHE_QUERY_NORMS = {
    "the isle of cats",
    "isle of cats",
    "island of cats",
    "the island of cats",
    "spicy",
    "spicy (2020)",
}


def forwards(apps, schema_editor):
    from apps.bgg import services
    from apps.bgg.models import BggResolution
    from apps.venues.models import VenueGame

    BggResolution.objects.filter(query_norm__in=CACHE_QUERY_NORMS).delete()
    # Drop any non-BGG CDN thumbnails that were stored with a known bgg_id.
    for row in BggResolution.objects.exclude(thumbnail_url="").filter(bgg_id__isnull=False):
        if not services._is_bgg_cover_url(row.thumbnail_url):
            row.thumbnail_url = ""
            row.save(update_fields=["thumbnail_url"])

    for game in VenueGame.objects.filter(title__in=TITLES, bgg_id__isnull=False):
        game.thumbnail_url = ""
        game.save(update_fields=["thumbnail_url"])
        services.refresh_venue_game_cover(game)


def backwards(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("venues", "0012_fix_katzentempel_bgg_ids"),
        ("bgg", "0003_alter_bggresolution_bgg_id"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
