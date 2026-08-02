from django.conf import settings
from django.db import models
from django.db.models import Q


class TableStatus(models.TextChoices):
    WAITING_FOR_VENUE_CONFIRMATION = "waiting_for_venue_confirmation", "Waiting for venue confirmation"
    WAITING_FOR_PLAYERS = "waiting_for_players", "Waiting for players"
    CONFIRMED = "confirmed", "Confirmed"
    CANCELLED = "cancelled", "Cancelled"
    COMPLETED = "completed", "Completed"


class GameLanguage(models.TextChoices):
    EN = "en", "English"
    DE = "de", "German"
    OTHER = "other", "Other"


class SeatStatus(models.TextChoices):
    RESERVED = "reserved", "Reserved"
    WAITLISTED = "waitlisted", "Waitlisted"
    CANCELLED = "cancelled", "Cancelled"


class Table(models.Model):
    """A hosted board game event at a venue (docs/Database.md 'Table (Event)')."""

    organizer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="organized_tables"
    )
    venue = models.ForeignKey("venues.Venue", on_delete=models.CASCADE, related_name="tables")

    game_title = models.CharField(max_length=200)
    bring_own_game = models.BooleanField(default=True)
    game_language = models.CharField(max_length=8, choices=GameLanguage.choices, default=GameLanguage.EN)
    game_language_other = models.CharField(max_length=100, blank=True)
    venue_game_confirmed = models.BooleanField(default=False)

    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    min_players = models.PositiveIntegerField(default=2)
    max_players = models.PositiveIntegerField(default=4)

    status = models.CharField(
        max_length=40,
        choices=TableStatus.choices,
        default=TableStatus.WAITING_FOR_VENUE_CONFIRMATION,
    )
    seats_taken = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["venue", "starts_at"]),
            models.Index(fields=["status", "starts_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.game_title} @ {self.venue} ({self.status})"


class SeatReservation(models.Model):
    table = models.ForeignKey(Table, on_delete=models.CASCADE, related_name="seats")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="seat_reservations"
    )
    is_organizer = models.BooleanField(default=False)
    status = models.CharField(max_length=16, choices=SeatStatus.choices, default=SeatStatus.RESERVED)
    waitlist_position = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            # A user cannot hold two active (reserved) seats at the same table.
            models.UniqueConstraint(
                fields=["table", "user"],
                condition=Q(status="reserved"),
                name="uniq_active_seat_per_user_per_table",
            ),
        ]
        indexes = [
            models.Index(fields=["table", "status"]),
            models.Index(fields=["user", "status"]),
        ]

    def __str__(self) -> str:
        return f"{self.user} @ {self.table_id} ({self.status})"


class LateCancellationMark(models.Model):
    """Placed when a user cancels within 24h; visible for 30 days (ADR-013)."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="late_cancellation_marks"
    )
    table = models.ForeignKey(Table, on_delete=models.CASCADE, related_name="late_cancellation_marks")
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    def __str__(self) -> str:
        return f"late-cancel {self.user} ({self.table_id})"
