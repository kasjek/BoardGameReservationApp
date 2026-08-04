from django.db import models


class BggResolution(models.Model):
    """Cache of resolved BoardGameGeek ids for game-title queries.

    Only successful resolutions are stored, so unreachable/no-match lookups are
    retried later rather than caching a bad result.
    """

    query_norm = models.CharField(max_length=255, unique=True)
    bgg_id = models.PositiveIntegerField()
    matched_name = models.CharField(max_length=255, blank=True)
    thumbnail_url = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"{self.query_norm} -> {self.bgg_id}"
