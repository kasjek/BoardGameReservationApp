from django.db import models


class Venue(models.Model):
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    location = models.CharField(max_length=255, blank=True)
    # Party-size limits for tables hosted here (hosts still pick min/max per table).
    min_players = models.PositiveIntegerField(default=2)
    max_players = models.PositiveIntegerField(default=8)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return self.name


class VenueAvailability(models.Model):
    """When and how many tables a venue offers (docs/Database.md, story 34)."""

    venue = models.ForeignKey(Venue, on_delete=models.CASCADE, related_name="availability")
    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    tables_available = models.PositiveIntegerField(default=1)

    class Meta:
        indexes = [models.Index(fields=["venue", "date"])]

    def __str__(self) -> str:
        return f"{self.venue} {self.date} ({self.tables_available} tables)"


class VenueGame(models.Model):
    """Games offered at a venue for the create-table picker (stories 29, 38)."""

    venue = models.ForeignKey(Venue, on_delete=models.CASCADE, related_name="games")
    title = models.CharField(max_length=200)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["title"]
        constraints = [
            models.UniqueConstraint(fields=["venue", "title"], name="uniq_venue_game_title"),
        ]

    def __str__(self) -> str:
        return f"{self.title} @ {self.venue}"
