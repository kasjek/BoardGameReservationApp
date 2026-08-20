"""Demo tables at Date House Cafe, Katzentempel, and Hotel Knorz for QA testing.

Existing user passwords and usernames are never changed — only brand-new
host accounts get an initial password when first created.
"""

from __future__ import annotations

from datetime import datetime, time, timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.accounts.models import Role
from apps.tables import services
from apps.tables.models import Table, TableStatus
from apps.venues.seed import ensure_date_house_cafe, ensure_hotel_knorz, ensure_katzentempel

User = get_user_model()

# Hosts used for demo tables. Password is applied ONLY when the user is created.
# Never overwrite passwords or usernames for accounts that already exist.
DEMO_HOSTS = (
    ("alice", "playpass1"),
    ("bob", "playpass1"),
    ("charlie", "playpass1"),
    ("chester", "playpass1"),
    ("demo", "demopass"),
)

# day_offset from today, start, end, game, bring_own, confirm, host index
DATE_HOUSE_DEMO_TABLES = (
    (1, time(11, 0), time(13, 0), "Love Letter", False, True, 0),
    (1, time(14, 0), time(16, 0), "Patchwork", False, True, 1),
    (2, time(12, 0), time(14, 0), "7 Wonders Duel", False, True, 2),
    (2, time(16, 0), time(18, 0), "Fog of Love", False, False, 3),  # leave pending for venue QA
    (3, time(11, 0), time(13, 0), "Onitama", False, True, 4),
    (4, time(15, 0), time(17, 0), "Chronicles of Crime", True, True, 0),
)

KATZENTEMPEL_DEMO_TABLES = (
    (1, time(11, 0), time(13, 0), "The Isle of Cats", False, True, 0),
    (1, time(14, 0), time(16, 0), "Calico", False, True, 1),
    (2, time(10, 0), time(12, 0), "Spicy", False, True, 2),
    (2, time(15, 0), time(17, 0), "Nekojima", False, False, 3),  # leave pending for venue QA
    (3, time(12, 0), time(14, 0), "Wingspan", True, True, 4),
    (4, time(16, 0), time(18, 0), "Azul", True, True, 0),
)

HOTEL_KNORZ_DEMO_TABLES = (
    (1, time(10, 0), time(12, 0), "Secret Hitler", False, True, 0),
    (1, time(14, 0), time(16, 0), "Codenames Pictures", False, True, 1),
    (2, time(11, 0), time(13, 0), "Cascadia", False, True, 2),
    (2, time(15, 0), time(17, 0), "Verdant", False, False, 3),  # leave pending for venue QA
    (3, time(12, 0), time(14, 0), "Let's Summon Demons", False, True, 4),
)


def _ensure_demo_hosts() -> list:
    hosts = []
    for username, password in DEMO_HOSTS:
        user, created = User.objects.get_or_create(
            username=username,
            defaults={"role": Role.USER, "email": f"{username}@example.com"},
        )
        if created:
            # Initial password for brand-new demo hosts only — never reset existing users.
            user.set_password(password)
            user.save(update_fields=["password"])
        hosts.append(user)
    return hosts


def _confirming_admin():
    """Prefer an existing ADMIN (e.g. dan). Never change their password or username."""
    admin = User.objects.filter(role=Role.ADMIN).order_by("id").first()
    if admin:
        return admin
    admin, created = User.objects.get_or_create(
        username="admin",
        defaults={
            "role": Role.ADMIN,
            "is_staff": True,
            "is_superuser": True,
            "email": "admin@example.com",
        },
    )
    if created:
        # Unusable until someone sets it — do not invent/overwrite credentials.
        admin.set_unusable_password()
        admin.save(update_fields=["password"])
    elif not admin.is_admin_role:
        # Only promote the dedicated seed username if it somehow isn't admin yet.
        admin.role = Role.ADMIN
        admin.is_staff = True
        admin.is_superuser = True
        admin.save(update_fields=["role", "is_staff", "is_superuser"])
    return admin


def _slot(day_offset: int, clock: time):
    day = timezone.localdate() + timedelta(days=day_offset)
    return timezone.make_aware(datetime.combine(day, clock))


def _seed_demo_tables(venue, specs) -> list[Table]:
    hosts = _ensure_demo_hosts()
    admin = _confirming_admin()
    created: list[Table] = []
    for day_offset, start_t, end_t, game, bring_own, confirm, host_idx in specs:
        starts_at = _slot(day_offset, start_t)
        ends_at = _slot(day_offset, end_t)
        host = hosts[host_idx]
        if not host.can_host_or_reserve:
            continue

        existing = (
            Table.objects.filter(
                venue=venue,
                game_title=game,
                starts_at=starts_at,
                organizer=host,
            )
            .exclude(status=TableStatus.CANCELLED)
            .first()
        )
        if existing:
            if game.strip().lower() == "patchwork" and existing.max_players != 2:
                existing.min_players = 2
                existing.max_players = max(2, existing.seats_taken)
                existing.save(update_fields=["min_players", "max_players"])
            created.append(existing)
            continue

        table = services.create_table(
            organizer=host,
            venue=venue,
            game_title=game,
            starts_at=starts_at,
            ends_at=ends_at,
            min_players=2,
            max_players=2 if game.strip().lower() == "patchwork" else 4,
            bring_own_game=bring_own,
            game_language="en" if bring_own else "de",
        )
        if confirm:
            services.confirm_table(table=table, by_user=admin)
        created.append(table)
    return created


def ensure_date_house_demo_tables() -> list[Table]:
    """Create (or reuse) future demo tables at Date House Cafe."""
    venue = ensure_date_house_cafe()
    return _seed_demo_tables(venue, DATE_HOUSE_DEMO_TABLES)


def ensure_katzentempel_demo_tables() -> list[Table]:
    """Create (or reuse) future demo tables at Katzentempel."""
    venue = ensure_katzentempel()
    return _seed_demo_tables(venue, KATZENTEMPEL_DEMO_TABLES)


def ensure_hotel_knorz_demo_tables() -> list[Table]:
    """Create (or reuse) future demo tables at Hotel Knorz."""
    venue = ensure_hotel_knorz()
    return _seed_demo_tables(venue, HOTEL_KNORZ_DEMO_TABLES)


def ensure_demo_tables() -> dict[str, list[Table]]:
    """Seed demo tables for all demo venues."""
    return {
        "Date House Cafe": ensure_date_house_demo_tables(),
        "Katzentempel": ensure_katzentempel_demo_tables(),
        "Hotel Knorz": ensure_hotel_knorz_demo_tables(),
    }
