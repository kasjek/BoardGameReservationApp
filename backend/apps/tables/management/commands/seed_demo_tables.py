from django.core.management.base import BaseCommand

from apps.tables.seed import ensure_demo_tables


class Command(BaseCommand):
    help = (
        "Seed (or refresh) demo tables at Date House Cafe and Katzentempel. "
        "Does not change existing usernames or passwords."
    )

    def handle(self, *args, **options):
        by_venue = ensure_demo_tables()
        if not any(by_venue.values()):
            self.stdout.write(self.style.WARNING("No demo tables seeded (venues missing?)."))
            return
        for venue_name, tables in by_venue.items():
            self.stdout.write(
                self.style.SUCCESS(
                    f"{venue_name}: {len(tables)} tables "
                    f"({', '.join(t.game_title for t in tables)})"
                )
            )
