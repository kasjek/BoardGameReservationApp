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
        from apps.tables.models import SeatReservation, SeatStatus

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

        request = self.context.get("request")
        author = getattr(request, "user", None)

        def participated(user_id: int) -> bool:
            return table.organizer_id == user_id or SeatReservation.objects.filter(
                table=table, user_id=user_id, status=SeatStatus.RESERVED
            ).exists()

        # You can only review an event you actually took part in.
        if author is None or not participated(author.id):
            raise serializers.ValidationError("You can only review events you took part in.")

        if data["target_type"] == ReviewTarget.USER:
            target_user = data.get("target_user")
            if not target_user:
                raise serializers.ValidationError("target_user is required for a user review.")
            if target_user.id == author.id:
                raise serializers.ValidationError("You cannot review yourself.")
            if not participated(target_user.id):
                raise serializers.ValidationError(
                    "You can only review players who were at that table."
                )
            data["target_venue"] = None
        else:
            # Venue reviews are about the event's own venue.
            data["target_venue"] = table.venue
            data["target_user"] = None

        # One review per author per event per target (no rating spam).
        dup = Review.objects.filter(
            author=author, table=table, target_type=data["target_type"]
        )
        dup = (
            dup.filter(target_user=data.get("target_user"))
            if data["target_type"] == ReviewTarget.USER
            else dup.filter(target_venue=data.get("target_venue"))
        )
        if dup.exists():
            raise serializers.ValidationError("You have already reviewed this.")
        return data
