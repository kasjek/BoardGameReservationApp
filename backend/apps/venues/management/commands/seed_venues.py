from django.core.management.base import BaseCommand

from apps.venues.demo_users import ensure_venue_managers
from apps.venues.seed import DEFAULT_HORIZON_DAYS, ensure_demo_venues


class Command(BaseCommand):
    help = (
        "Seed (or refresh) all demo venues, availability, game catalogs, "
        "and VENUE_USER managers. Does not change existing passwords."
    )

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
        managers = ensure_venue_managers()
        for user in managers:
            venue_name = user.venue.name if user.venue_id else "?"
            self.stdout.write(
                self.style.SUCCESS(
                    f"VENUE_USER '{user.username}' → {venue_name} (id={user.venue_id})"
                )
            )
        try:
            from apps.tables.seed import ensure_katzentempel_demo_tables
        except ImportError:
            return
        tables = ensure_katzentempel_demo_tables()
        self.stdout.write(
            self.style.SUCCESS(
                f"Katzentempel demo tables: {len(tables)} "
                f"({', '.join(t.game_title for t in tables)})"
            )
        )