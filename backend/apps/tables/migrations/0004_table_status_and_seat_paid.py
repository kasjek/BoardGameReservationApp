from django.db import migrations, models


def remap_statuses_and_paid(apps, schema_editor):
    Table = apps.get_model("tables", "Table")
    SeatReservation = apps.get_model("tables", "SeatReservation")
    mapping = {
        "waiting_for_venue_confirmation": "requested",
        "waiting_for_players": "available",
        "confirmed": "confirmed_unpaid",
    }
    for old, new in mapping.items():
        Table.objects.filter(status=old).update(status=new)

    SeatReservation.objects.filter(status="reserved", table__bring_own_game=True).update(paid=True)

    for table in Table.objects.filter(status="confirmed_unpaid"):
        reserved = table.seats.filter(status="reserved")
        taken = reserved.count()
        if taken < table.min_players:
            table.status = "available"
            table.save(update_fields=["status"])
            continue
        unpaid = (not table.bring_own_game) and reserved.filter(paid=False).exists()
        next_status = "confirmed_unpaid" if unpaid else "confirmed_paid"
        if table.status != next_status:
            table.status = next_status
            table.save(update_fields=["status"])


def reverse_remap(apps, schema_editor):
    Table = apps.get_model("tables", "Table")
    mapping = {
        "requested": "waiting_for_venue_confirmation",
        "available": "waiting_for_players",
        "confirmed_unpaid": "confirmed",
        "confirmed_paid": "confirmed",
    }
    for old, new in mapping.items():
        Table.objects.filter(status=old).update(status=new)


class Migration(migrations.Migration):
    dependencies = [
        ("tables", "0003_seed_date_house_demo_tables"),
    ]

    operations = [
        migrations.AddField(
            model_name="seatreservation",
            name="paid",
            field=models.BooleanField(default=False),
        ),
        migrations.AlterField(
            model_name="table",
            name="status",
            field=models.CharField(
                choices=[
                    ("requested", "Requested"),
                    ("available", "Available"),
                    ("confirmed_unpaid", "Confirmed & unpaid"),
                    ("confirmed_paid", "Confirmed & paid"),
                    ("cancelled", "Cancelled"),
                    ("completed", "Completed"),
                ],
                default="requested",
                max_length=40,
            ),
        ),
        migrations.RunPython(remap_statuses_and_paid, reverse_remap),
    ]
