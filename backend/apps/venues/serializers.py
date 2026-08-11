from rest_framework import serializers

from .hours import default_weekly_hours_payload, set_weekly_hours, sync_availability_from_hours
from .models import Venue, VenueAvailability, VenueClosure, VenueWeeklyHours


class VenueSerializer(serializers.ModelSerializer):
    rating_avg = serializers.SerializerMethodField()
    maps_url = serializers.SerializerMethodField()

    class Meta:
        model = Venue
        fields = [
            "id",
            "name",
            "description",
            "location",
            "min_players",
            "max_players",
            "rating_avg",
            "maps_url",
            "created_at",
        ]
        read_only_fields = ["id", "rating_avg", "maps_url", "created_at"]

    def get_rating_avg(self, obj):
        from apps.reviews.models import average_rating_for_venue

        return average_rating_for_venue(obj.id)

    def get_maps_url(self, obj):
        if not obj.location:
            return None
        from .seed import google_maps_url

        return google_maps_url(obj.location)


class VenueAvailabilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = VenueAvailability
        fields = ["id", "venue", "date", "start_time", "end_time", "tables_available"]
        read_only_fields = ["id", "venue"]


class VenueWeeklyHoursSerializer(serializers.ModelSerializer):
    class Meta:
        model = VenueWeeklyHours
        fields = ["weekday", "is_closed", "start_time", "end_time"]


class VenueClosureSerializer(serializers.ModelSerializer):
    class Meta:
        model = VenueClosure
        fields = ["id", "venue", "date", "comment", "created_at"]
        read_only_fields = ["id", "venue", "created_at"]


class VenueClosureWriteSerializer(serializers.Serializer):
    date = serializers.DateField()
    comment = serializers.CharField(max_length=2000)


class VenueCreateSerializer(VenueSerializer):
    """Admin create: name, address, weekly bookable hours, optional closure alerts."""

    weekly_hours = VenueWeeklyHoursSerializer(many=True, required=False)
    closures = VenueClosureWriteSerializer(many=True, required=False)

    class Meta(VenueSerializer.Meta):
        fields = VenueSerializer.Meta.fields + ["weekly_hours", "closures"]

    def create(self, validated_data):
        hours = validated_data.pop("weekly_hours", None)
        closures = validated_data.pop("closures", [])
        venue = Venue.objects.create(**validated_data)

        if hours is None:
            payload = default_weekly_hours_payload()
        else:
            payload = []
            for h in hours:
                payload.append(
                    {
                        "weekday": h["weekday"],
                        "is_closed": h.get("is_closed", False),
                        "start_time": h.get("start_time"),
                        "end_time": h.get("end_time"),
                    }
                )
        try:
            set_weekly_hours(venue, payload)
        except ValueError as exc:
            venue.delete()
            raise serializers.ValidationError({"weekly_hours": str(exc)}) from exc

        request = self.context.get("request")
        user = getattr(request, "user", None) if request else None
        for c in closures:
            VenueClosure.objects.update_or_create(
                venue=venue,
                date=c["date"],
                defaults={
                    "comment": c["comment"],
                    "created_by": user if user and user.is_authenticated else None,
                },
            )
        if closures:
            sync_availability_from_hours(venue)
        return venue

    def to_representation(self, instance):
        return VenueSerializer(instance, context=self.context).data
