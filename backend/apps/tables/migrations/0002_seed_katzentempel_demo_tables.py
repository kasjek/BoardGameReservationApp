from django.db import migrations


def forwards(apps, schema_editor):
    from apps.tables.seed import ensure_katzentempel_demo_tables

    ensure_katzentempel_demo_tables()


def backwards(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("tables", "0001_initial"),
        ("venues", "0012_fix_katzentempel_bgg_ids"),
        ("accounts", "0002_user_avatar_seed"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
