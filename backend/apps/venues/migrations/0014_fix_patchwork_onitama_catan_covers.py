from django.db import migrations

# Wrong BGG thing id previously seeded for Onitama (Chronicles of Magnamund).
ONITAMA_FIX = ("Onitama", 160477)

# Titles that were missing BGG covers (empty cache / wrong id / cover 500).
CACHE_QUERY_NORMS = {
    "patchwork",
    "onitama",
    "catan",
}


def forwards(apps, schema_editor):
    from apps.bgg import services
    from apps.bgg.models import BggResolution

    VenueGame = apps.get_model("venues", "VenueGame")

    title, bgg_id = ONITAMA_FIX
    VenueGame.objects.filter(title=title).update(bgg_id=bgg_id, thumbnail_url="")
    # Drop stale cover cache so the next request re-resolves (Geekdo fallback /
    # Wikipedia) instead of serving empty/wrong art or crashing on synthetic ids.
    BggResolution.objects.filter(query_norm__in=CACHE_QUERY_NORMS).delete()

    for game in VenueGame.objects.filter(title__in=("Patchwork", "Onitama"), bgg_id__isnull=False):
        game.thumbnail_url = ""
        game.save(update_fields=["thumbnail_url"])
        services.refresh_venue_game_cover(game)
def backwards(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("venues", "0013_fix_isle_spicy_covers"),
        ("venues", "0013_refresh_date_house_google_hours"),
        ("venues", "0013_rename_katzentempel"),
        ("bgg", "0003_alter_bggresolution_bgg_id"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
