from django.core.management.base import BaseCommand

from apps.venues.seed import DEFAULT_HORIZON_DAYS, ensure_date_house_cafe


class Command(BaseCommand):
    help = "Seed (or refresh) the Date House Cafe demo venue and its availability."

    def add_arguments(self, parser):
        parser.add_argument(
            "--days",
            type=int,
            default=DEFAULT_HORIZON_DAYS,
            help=f"How many days of availability to keep filled (default {DEFAULT_HORIZON_DAYS}).",
        )

    def handle(self, *args, **options):
        venue = ensure_date_house_cafe(horizon_days=options["days"])
        self.stdout.write(
            self.style.SUCCESS(
                f"Venue '{venue.name}' ready (id={venue.id}) with {options['days']} days of availability."
            )
        )
