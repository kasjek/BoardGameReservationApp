from django.conf import settings
from django.db import models
from django.db.models import Avg


class ReviewTarget(models.TextChoices):
    USER = "user", "User"
    VENUE = "venue", "Venue"


class Review(models.Model):
    """A review of a user (player) or a venue (docs/Database.md 'Review')."""

    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="authored_reviews"
    )
    # The event this review is about; reviews are only allowed after it ends and
    # if it was not cancelled.
    table = models.ForeignKey(
        "tables.Table", on_delete=models.CASCADE, null=True, blank=True, related_name="reviews"
    )
    target_type = models.CharField(max_length=8, choices=ReviewTarget.choices)
    target_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="received_reviews",
    )
    target_venue = models.ForeignKey(
        "venues.Venue", on_delete=models.CASCADE, null=True, blank=True, related_name="reviews"
    )
    rating = models.PositiveSmallIntegerField()
    body = models.TextField(blank=True)
    response_body = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["target_user"]),
            models.Index(fields=["target_venue"]),
        ]

    def __str__(self) -> str:
        return f"{self.rating}★ by {self.author_id}"


def average_rating_for_user(user_id: int) -> float | None:
    return Review.objects.filter(target_user_id=user_id).aggregate(a=Avg("rating"))["a"]


def average_rating_for_venue(venue_id: int) -> float | None:
    return Review.objects.filter(target_venue_id=venue_id).aggregate(a=Avg("rating"))["a"]
