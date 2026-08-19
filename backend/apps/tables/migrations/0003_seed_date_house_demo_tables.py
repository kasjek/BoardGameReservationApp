from django.db import migrations


def forwards(apps, schema_editor):
    # Live create_table now writes SeatReservation.paid, which is added in 0004.
    # Demo rows are seeded there so a fresh migrate does not fail on 0003.
    pass


def backwards(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("tables", "0002_seed_katzentempel_demo_tables"),
        ("venues", "0014_merge_0013_leaves"),
        ("accounts", "0002_user_avatar_seed"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
