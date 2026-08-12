from django.core.management.base import BaseCommand

from apps.tables.seed import ensure_katzentempel_demo_tables


class Command(BaseCommand):
    help = "Seed (or refresh) at least five demo tables at Katzentempel Nürnberg."

    def handle(self, *args, **options):
        tables = ensure_katzentempel_demo_tables()
        self.stdout.write(
            self.style.SUCCESS(
                f"Katzentempel demo tables ready: {len(tables)} "
                f"({', '.join(t.game_title for t in tables)})"
            )
        )
