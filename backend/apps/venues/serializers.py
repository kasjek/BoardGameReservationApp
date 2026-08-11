from rest_framework import serializers

from .models import Venue, VenueAvailability, VenueGame


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
        # `venue` is taken from the URL and injected by the view, not the request body.
        read_only_fields = ["id", "venue"]


class VenueGameSerializer(serializers.ModelSerializer):
    class Meta:
        model = VenueGame
        fields = ["id", "venue", "title", "is_active"]
        read_only_fields = ["id", "venue"]
