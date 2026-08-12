from django.db import migrations

# Wrong ids accidentally seeded for Katzentempel → correct BGG thing ids.
FIXES = {
    # old title → (new title, correct bgg_id)
    "Island of Cats": ("The Isle of Cats", 281259),
    "The Isle of Cats": ("The Isle of Cats", 281259),
    "Nekojima": ("Nekojima", 359029),
    "Spicy": ("Spicy", 299169),
    "Calico": ("Calico", 283155),
}

# Also clear bad cover-cache rows so they re-resolve.
CACHE_QUERY_NORMS = {
    "island of cats",
    "the isle of cats",
    "isle of cats",
    "the island of cats",
    "nekojima",
    "nekojima (2023)",
    "nekojima (2024)",
    "spicy",
    "spicy (2020)",
    "calico",
    "calico (2020)",
}


def forwards(apps, schema_editor):
    VenueGame = apps.get_model("venues", "VenueGame")
    BggResolution = apps.get_model("bgg", "BggResolution")

    for old_title, (new_title, bgg_id) in FIXES.items():
        for game in VenueGame.objects.filter(title__iexact=old_title):
            # Avoid unique(venue, title) clashes when renaming Island → The Isle.
            clash = (
                VenueGame.objects.filter(venue_id=game.venue_id, title=new_title)
                .exclude(pk=game.pk)
                .first()
            )
            if clash:
                clash.bgg_id = bgg_id
                clash.thumbnail_url = ""
                clash.save(update_fields=["bgg_id", "thumbnail_url"])
                game.delete()
            else:
                game.title = new_title
                game.bgg_id = bgg_id
                game.thumbnail_url = ""
                game.save(update_fields=["title", "bgg_id", "thumbnail_url"])

    BggResolution.objects.filter(query_norm__in=CACHE_QUERY_NORMS).delete()
    # Also drop any cache row pointing at the previously wrong ids.
    BggResolution.objects.filter(bgg_id__in=[284210, 359871, 350933, 283929]).delete()


def backwards(apps, schema_editor):
    # Non-destructive: leave corrected ids in place.
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("venues", "0011_seed_katzentempel"),
        ("bgg", "0003_alter_bggresolution_bgg_id"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
