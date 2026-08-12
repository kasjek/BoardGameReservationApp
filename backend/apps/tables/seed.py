"""Demo tables at Katzentempel Nürnberg for manual / QA testing."""

from __future__ import annotations

from datetime import datetime, time, timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.accounts.models import Role
from apps.tables import services
from apps.tables.models import Table, TableStatus
from apps.venues.seed import ensure_katzentempel

User = get_user_model()

# Hosts used for demo tables (created if missing; passwords match AGENTS.md demos).
DEMO_HOSTS = (
    ("alice", "playpass1"),
    ("bob", "playpass1"),
    ("charlie", "playpass1"),
    ("chester", "playpass1"),
    ("demo", "demopass"),
)

# day_offset from today, start, end, game, bring_own, confirm, host index
KATZENTEMPEL_DEMO_TABLES = (
    (1, time(11, 0), time(13, 0), "The Isle of Cats", False, True, 0),
    (1, time(14, 0), time(16, 0), "Calico", False, True, 1),
    (2, time(10, 0), time(12, 0), "Spicy", False, True, 2),
    (2, time(15, 0), time(17, 0), "Nekojima", False, False, 3),  # leave pending for venue QA
    (3, time(12, 0), time(14, 0), "Wingspan", True, True, 4),
    (4, time(16, 0), time(18, 0), "Azul", True, True, 0),
)


def _ensure_demo_hosts() -> list:
    hosts = []
    for username, password in DEMO_HOSTS:
        user, created = User.objects.get_or_create(
            username=username,
            defaults={"role": Role.USER},
        )
        if created:
            user.set_password(password)
            user.save(update_fields=["password"])
        elif user.role != Role.USER and not user.is_admin_role:
            # Keep existing role; skip as host if they cannot host.
            pass
        hosts.append(user)
    return hosts


def _slot(day_offset: int, clock: time):
    day = timezone.localdate() + timedelta(days=day_offset)
    return timezone.make_aware(datetime.combine(day, clock))


def ensure_katzentempel_demo_tables() -> list[Table]:
    """Create (or reuse) at least five future tables at Katzentempel for testing."""
    venue = ensure_katzentempel()
    hosts = _ensure_demo_hosts()
    admin, _ = User.objects.get_or_create(
        username="admin",
        defaults={"role": Role.ADMIN, "is_staff": True, "is_superuser": True},
    )
    if not admin.is_admin_role:
        admin.role = Role.ADMIN
        admin.is_staff = True
        admin.is_superuser = True
        admin.save(update_fields=["role", "is_staff", "is_superuser"])

    created: list[Table] = []
    for day_offset, start_t, end_t, game, bring_own, confirm, host_idx in KATZENTEMPEL_DEMO_TABLES:
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
            created.append(existing)
            continue

        table = services.create_table(
            organizer=host,
            venue=venue,
            game_title=game,
            starts_at=starts_at,
            ends_at=ends_at,
            min_players=2,
            max_players=4,
            bring_own_game=bring_own,
            game_language="en" if bring_own else "de",
        )
        if confirm:
            services.confirm_table(table=table, by_user=admin)
        created.append(table)

    return created
