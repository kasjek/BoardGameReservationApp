from django.core.management.base import BaseCommand

from apps.venues.seed import DEFAULT_HORIZON_DAYS, ensure_demo_venues


class Command(BaseCommand):
    help = "Seed (or refresh) all demo venues, availability, and game catalogs."

    def add_arguments(self, parser):
        parser.add_argument(
            "--days",
            type=int,
            default=DEFAULT_HORIZON_DAYS,
            help=f"How many days of availability to keep filled (default {DEFAULT_HORIZON_DAYS}).",
        )

    def handle(self, *args, **options):
        venues = ensure_demo_venues(horizon_days=options["days"])
        for venue in venues:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Venue '{venue.name}' ready (id={venue.id}) "
                    f"with {options['days']} days of availability."
                )
            )
        from apps.tables.seed import ensure_katzentempel_demo_tables

        tables = ensure_katzentempel_demo_tables()
        self.stdout.write(
            self.style.SUCCESS(
                f"Katzentempel demo tables: {len(tables)} "
                f"({', '.join(t.game_title for t in tables)})"
            )
        )
