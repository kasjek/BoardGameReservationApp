from django.db import migrations

# Known BoardGameGeek ids for seeded / common titles.
BGG_IDS_BY_TITLE = {
    "Love Letter": 129622,
    "Fog of Love": 215311,
    "Patchwork": 163412,
    "7 Wonders Duel": 173346,
    "Chronicles of Crime": 239188,
    "Onitama": 158138,
    "Island of Cats": 284210,
    "Nekojima": 359871,
    "Spicy": 350933,
    "Calico": 283929,
}


def backfill(apps, schema_editor):
    VenueGame = apps.get_model("venues", "VenueGame")
    for title, bgg_id in BGG_IDS_BY_TITLE.items():
        VenueGame.objects.filter(title=title, bgg_id__isnull=True).update(bgg_id=bgg_id)


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("venues", "0009_seed_date_house_games"),
    ]

    operations = [
        migrations.RunPython(backfill, noop),
    ]
