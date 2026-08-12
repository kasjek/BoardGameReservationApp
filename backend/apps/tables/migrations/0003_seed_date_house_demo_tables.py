from django.db import migrations


def forwards(apps, schema_editor):
    from apps.tables.seed import ensure_date_house_demo_tables

    ensure_date_house_demo_tables()


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
