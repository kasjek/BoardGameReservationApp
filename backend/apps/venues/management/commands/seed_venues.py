from django.core.management.base import BaseCommand

from apps.venues.seed import DEFAULT_HORIZON_DAYS, ensure_demo_venues


class Command(BaseCommand):
    help = "Seed (or refresh) all demo venues, availability, games, and example tables."

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
        from apps.tables.seed import ensure_demo_tables

        by_venue = ensure_demo_tables()
        for venue_name, tables in by_venue.items():
            self.stdout.write(
                self.style.SUCCESS(
                    f"{venue_name} demo tables: {len(tables)} "
                    f"({', '.join(t.game_title for t in tables)})"
                )
            )
