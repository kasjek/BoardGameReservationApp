"""Backend-owned booking rules (ADR-002, ADR-007, ADR-011, ADR-013).

All table-state transitions and seat-capacity decisions live here so every client
shares the same constraints. Seat reservation uses a row lock on the Table
(SELECT ... FOR UPDATE on PostgreSQL) plus a partial unique index to prevent
over-booking and duplicate seats.
"""

from __future__ import annotations

from datetime import time as dtime
from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import APIException, PermissionDenied, ValidationError

from .models import LateCancellationMark, SeatReservation, SeatStatus, Table, TableStatus

TURNOVER = timedelta(minutes=15)
LATE_CANCEL_WINDOW = timedelta(hours=24)
MARK_VALIDITY = timedelta(days=30)

# Booking window rules for the venue (local time): tables run 3 PM–7 PM and last
# between 1 and 3 hours. A user may only book one table per day at a given venue.
BOOKING_OPEN = dtime(15, 0)
BOOKING_CLOSE = dtime(19, 0)
MIN_BOOKING = timedelta(hours=1)
MAX_BOOKING = timedelta(hours=3)

ACTIVE_TABLE_STATUSES = (
    TableStatus.WAITING_FOR_VENUE_CONFIRMATION,
    TableStatus.WAITING_FOR_PLAYERS,
    TableStatus.CONFIRMED,
)
BOOKABLE_STATUSES = (TableStatus.WAITING_FOR_PLAYERS, TableStatus.CONFIRMED)


class Conflict(APIException):
    status_code = 409
    default_detail = "Conflict."
    default_code = "conflict"


class BookingError(APIException):
    status_code = 400
    default_detail = "Invalid booking."
    default_code = "booking_error"


def _local(dt):
    return timezone.localtime(dt) if timezone.is_aware(dt) else dt


def check_booking_window(*, organizer, venue, starts_at, ends_at) -> None:
    """Venue booking policy: 3 PM–7 PM, 1–3 hours, one table per user/day/venue."""
    start_local = _local(starts_at)
    end_local = _local(ends_at)

    if start_local.date() != end_local.date():
        raise BookingError("A table must start and end on the same day.")
    if start_local.time() < BOOKING_OPEN or end_local.time() > BOOKING_CLOSE:
        raise BookingError("Tables can only be booked between 3 PM and 7 PM.")

    duration = ends_at - starts_at
    if duration < MIN_BOOKING:
        raise BookingError("The minimum booking length is 1 hour.")
    if duration > MAX_BOOKING:
        raise BookingError("The maximum booking length is 3 hours.")

    same_day = any(
        _local(t.starts_at).date() == start_local.date()
        for t in Table.objects.filter(
            organizer=organizer, venue=venue, status__in=ACTIVE_TABLE_STATUSES
        )
    )
    if same_day:
        raise Conflict("You already have a table booked at this venue on that day.")


def _windows_conflict(s1, e1, s2, e2, buffer=TURNOVER) -> bool:
    """True if [s1,e1] and [s2,e2] overlap once a turnover buffer is added."""
    return s1 < e2 + buffer and s2 < e1 + buffer


def create_table(
    *,
    organizer,
    venue,
    game_title,
    starts_at,
    ends_at,
    min_players,
    max_players,
    bring_own_game=True,
    game_language="en",
    game_language_other="",
    enforce_booking_window=False,
):
    if not organizer.can_host_or_reserve:
        raise PermissionDenied("Only a USER may host a table.")
    if ends_at <= starts_at:
        raise ValidationError("ends_at must be after starts_at.")
    if min_players < 1 or max_players < min_players:
        raise ValidationError("Require 1 <= min_players <= max_players.")
    if enforce_booking_window:
        check_booking_window(
            organizer=organizer, venue=venue, starts_at=starts_at, ends_at=ends_at
        )

    table = Table.objects.create(
        organizer=organizer,
        venue=venue,
        game_title=game_title,
        bring_own_game=bring_own_game,
        game_language=game_language,
        game_language_other=game_language_other,
        starts_at=starts_at,
        ends_at=ends_at,
        min_players=min_players,
        max_players=max_players,
        status=TableStatus.WAITING_FOR_VENUE_CONFIRMATION,
        seats_taken=1,
    )
    SeatReservation.objects.create(
        table=table, user=organizer, is_organizer=True, status=SeatStatus.RESERVED
    )
    return table


def _check_venue_capacity(table: Table) -> None:
    """Enforce venue capacity with the 15-minute turnover buffer (ADR-011)."""
    covering = [
        a
        for a in table.venue.availability.filter(date=table.starts_at.date())
        if a.start_time <= table.starts_at.timetz().replace(tzinfo=None)
        and a.end_time >= table.ends_at.timetz().replace(tzinfo=None)
    ]
    if not covering:
        raise Conflict("Venue is not available for the requested slot.")
    tables_available = max(a.tables_available for a in covering)

    concurrent = 0
    others = (
        Table.objects.filter(venue=table.venue, status__in=ACTIVE_TABLE_STATUSES)
        .exclude(pk=table.pk)
    )
    for other in others:
        if _windows_conflict(table.starts_at, table.ends_at, other.starts_at, other.ends_at):
            concurrent += 1
    if concurrent >= tables_available:
        raise Conflict("Venue is at capacity for this time slot (15-minute turnover).")


def confirm_table(*, table: Table, by_user) -> Table:
    if not by_user.manages_venue(table.venue):
        raise PermissionDenied("Only the venue (or an admin) can confirm this table.")
    if table.status != TableStatus.WAITING_FOR_VENUE_CONFIRMATION:
        raise Conflict("Table is not awaiting venue confirmation.")

    _check_venue_capacity(table)

    if not table.bring_own_game:
        # Venue confirms the requested venue game is available (decision 4).
        table.venue_game_confirmed = True
    table.status = TableStatus.WAITING_FOR_PLAYERS
    table.save(update_fields=["status", "venue_game_confirmed", "updated_at"])
    return table


def reject_table(*, table: Table, by_user) -> Table:
    if not by_user.manages_venue(table.venue):
        raise PermissionDenied("Only the venue (or an admin) can reject this table.")
    if table.status not in (
        TableStatus.WAITING_FOR_VENUE_CONFIRMATION,
        TableStatus.WAITING_FOR_PLAYERS,
        TableStatus.CONFIRMED,
    ):
        raise Conflict("Table cannot be rejected in its current state.")
    table.status = TableStatus.CANCELLED
    table.save(update_fields=["status", "updated_at"])
    return table


def cancel_table(*, table: Table, by_user) -> Table:
    """Organizer (or admin) cancels their own table (FR-B7)."""
    is_organizer = table.organizer_id == by_user.id
    if not (is_organizer or by_user.is_admin_role):
        raise PermissionDenied("Only the organizer (or an admin) can cancel this table.")
    if table.status in (TableStatus.CANCELLED, TableStatus.COMPLETED):
        raise Conflict("Table is already cancelled or completed.")
    table.status = TableStatus.CANCELLED
    table.save(update_fields=["status", "updated_at"])
    return table


@transaction.atomic
def reserve_seat(*, table: Table, user) -> SeatReservation:
    if not user.can_host_or_reserve:
        raise PermissionDenied("Only a USER may reserve a seat.")

    table = Table.objects.select_for_update().get(pk=table.pk)

    if table.status not in BOOKABLE_STATUSES:
        raise Conflict("The venue has not confirmed this table yet.")

    existing = table.seats.filter(
        user=user, status__in=(SeatStatus.RESERVED, SeatStatus.WAITLISTED)
    ).first()
    if existing is not None:
        raise Conflict("You already hold a seat or waitlist spot at this table.")

    # A user cannot hold a seat at two events whose times overlap.
    overlapping = (
        SeatReservation.objects.filter(user=user, status=SeatStatus.RESERVED)
        .exclude(table=table)
        .exclude(table__status=TableStatus.CANCELLED)
        .filter(table__starts_at__lt=table.ends_at, table__ends_at__gt=table.starts_at)
        .exists()
    )
    if overlapping:
        raise Conflict(
            "You already have a seat at another event during this time. "
            "You can't be at two overlapping tables."
        )

    if table.seats_taken < table.max_players:
        seat = SeatReservation.objects.create(
            table=table, user=user, status=SeatStatus.RESERVED
        )
        table.seats_taken += 1
        if (
            table.seats_taken >= table.min_players
            and table.status == TableStatus.WAITING_FOR_PLAYERS
        ):
            table.status = TableStatus.CONFIRMED
        table.save(update_fields=["seats_taken", "status", "updated_at"])
        return seat

    # Table is full -> waitlist.
    next_position = (
        table.seats.filter(status=SeatStatus.WAITLISTED).count() + 1
    )
    return SeatReservation.objects.create(
        table=table, user=user, status=SeatStatus.WAITLISTED, waitlist_position=next_position
    )


@transaction.atomic
def cancel_seat(*, table: Table, user, now=None) -> SeatReservation:
    now = now or timezone.now()
    table = Table.objects.select_for_update().get(pk=table.pk)

    seat = table.seats.filter(
        user=user, status__in=(SeatStatus.RESERVED, SeatStatus.WAITLISTED)
    ).first()
    if seat is None:
        raise Conflict("No active seat to cancel.")

    was_reserved = seat.status == SeatStatus.RESERVED
    seat.status = SeatStatus.CANCELLED
    seat.cancelled_at = now
    seat.waitlist_position = None
    seat.save(update_fields=["status", "cancelled_at", "waitlist_position"])

    if was_reserved:
        table.seats_taken -= 1
        _promote_from_waitlist(table)
        if (
            table.status == TableStatus.CONFIRMED
            and table.seats_taken < table.min_players
        ):
            table.status = TableStatus.WAITING_FOR_PLAYERS
        table.save(update_fields=["seats_taken", "status", "updated_at"])

        # Late cancellation (within 24h of start) -> 30-day profile mark.
        if now < table.starts_at and (table.starts_at - now) < LATE_CANCEL_WINDOW:
            LateCancellationMark.objects.create(
                user=user, table=table, expires_at=now + MARK_VALIDITY
            )

    return seat


def _promote_from_waitlist(table: Table) -> None:
    if table.seats_taken >= table.max_players:
        return
    nxt = (
        table.seats.filter(status=SeatStatus.WAITLISTED)
        .order_by("waitlist_position", "created_at")
        .first()
    )
    if nxt is None:
        return
    nxt.status = SeatStatus.RESERVED
    nxt.waitlist_position = None
    nxt.save(update_fields=["status", "waitlist_position"])
    table.seats_taken += 1
