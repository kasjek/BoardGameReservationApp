from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0003_user_google_sub"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="facebook_id",
            field=models.CharField(blank=True, max_length=64, null=True, unique=True),
        ),
    ]
