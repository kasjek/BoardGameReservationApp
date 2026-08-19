from django.conf import settings
from django.db import models


class Venue(models.Model):
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    location = models.CharField(max_length=255, blank=True)
    # Party-size limits for tables hosted here (hosts still pick min/max per table).
    min_players = models.PositiveIntegerField(default=2)
    max_players = models.PositiveIntegerField(default=8)
    # Allowed table booking length (minutes) for this venue.
    min_reservation_minutes = models.PositiveIntegerField(default=60)
    max_reservation_minutes = models.PositiveIntegerField(default=180)
    # Short public copy shown on the venue page (create form caps at 100 chars).
    min_spend = models.CharField(max_length=80, blank=True, default="")
    booking_horizon_weeks = models.PositiveSmallIntegerField(default=12)
    # File extension including the leading dot, e.g. ".jpg". Empty = no picture.
    picture_ext = models.CharField(max_length=8, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return self.name


class VenueAvailability(models.Model):
    """When and how many tables a venue offers on a calendar date (docs/Database.md)."""

    venue = models.ForeignKey(Venue, on_delete=models.CASCADE, related_name="availability")
    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    tables_available = models.PositiveIntegerField(default=1)

    class Meta:
        indexes = [models.Index(fields=["venue", "date"])]

    def __str__(self) -> str:
        return f"{self.venue} {self.date} ({self.tables_available} tables)"


class VenueWeeklyHours(models.Model):
    """Recurring bookable hours for one weekday (Mon=0 … Sun=6)."""

    venue = models.ForeignKey(Venue, on_delete=models.CASCADE, related_name="weekly_hours")
    weekday = models.PositiveSmallIntegerField()  # Python weekday: Mon=0 … Sun=6
    is_closed = models.BooleanField(default=False)
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)

    class Meta:
        ordering = ["weekday"]
        constraints = [
            models.UniqueConstraint(fields=["venue", "weekday"], name="uniq_venue_weekday_hours"),
            models.CheckConstraint(
                condition=models.Q(weekday__gte=0) & models.Q(weekday__lte=6),
                name="venue_weekday_0_6",
            ),
        ]

    def __str__(self) -> str:
        if self.is_closed:
            return f"{self.venue} weekday={self.weekday} closed"
        return f"{self.venue} weekday={self.weekday} {self.start_time}–{self.end_time}"


class VenueClosure(models.Model):
    """Date-specific closure (e.g. public holiday) that blocks bookings."""

    venue = models.ForeignKey(Venue, on_delete=models.CASCADE, related_name="closures")
    date = models.DateField()
    comment = models.TextField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="venue_closures_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["date"]
        constraints = [
            models.UniqueConstraint(fields=["venue", "date"], name="uniq_venue_closure_date"),
        ]

    def __str__(self) -> str:
        return f"{self.venue} closed {self.date}: {self.comment[:40]}"


class VenueGame(models.Model):
    """Board game available at a venue (picked from BoardGameGeek)."""

    venue = models.ForeignKey(Venue, on_delete=models.CASCADE, related_name="games")
    title = models.CharField(max_length=200)
    bgg_id = models.PositiveIntegerField(null=True, blank=True)
    thumbnail_url = models.URLField(max_length=500, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["title"]
        constraints = [
            models.UniqueConstraint(fields=["venue", "title"], name="uniq_venue_game_title"),
            models.UniqueConstraint(
                fields=["venue", "bgg_id"],
                condition=models.Q(bgg_id__isnull=False),
                name="uniq_venue_game_bgg_id",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.title} @ {self.venue}"
