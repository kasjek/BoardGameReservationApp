from django.utils import timezone
from rest_framework import serializers

from .models import Review, ReviewTarget


class ReviewSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source="author.username", read_only=True)

    class Meta:
        model = Review
        fields = [
            "id",
            "author",
            "author_name",
            "table",
            "target_type",
            "target_user",
            "target_venue",
            "rating",
            "body",
            "response_body",
            "created_at",
        ]
        read_only_fields = ["id", "author", "author_name", "response_body", "created_at"]

    def validate(self, data):
        if not (1 <= data["rating"] <= 5):
            raise serializers.ValidationError("rating must be between 1 and 5.")

        # A review is always about a specific event (table). It can only be posted
        # once that event's time has passed, and only if it was not cancelled.
        table = data.get("table")
        if table is None:
            raise serializers.ValidationError("table is required for a review.")
        if table.status == "cancelled":
            raise serializers.ValidationError("You cannot review a cancelled event.")
        if table.ends_at > timezone.now():
            raise serializers.ValidationError(
                "You can only post a review after the event has ended."
            )

        if data["target_type"] == ReviewTarget.USER:
            if not data.get("target_user"):
                raise serializers.ValidationError("target_user is required for a user review.")
            data["target_venue"] = None
        else:
            # Venue reviews are about the event's own venue.
            data["target_venue"] = table.venue
            data["target_user"] = None
        return data
