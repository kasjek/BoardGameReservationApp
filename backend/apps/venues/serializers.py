from rest_framework import serializers

from .models import Venue, VenueAvailability


class VenueSerializer(serializers.ModelSerializer):
    rating_avg = serializers.SerializerMethodField()

    class Meta:
        model = Venue
        fields = ["id", "name", "description", "location", "rating_avg", "created_at"]
        read_only_fields = ["id", "rating_avg", "created_at"]

    def get_rating_avg(self, obj):
        from apps.reviews.models import average_rating_for_venue

        return average_rating_for_venue(obj.id)


class VenueAvailabilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = VenueAvailability
        fields = ["id", "venue", "date", "start_time", "end_time", "tables_available"]
        # `venue` is taken from the URL and injected by the view, not the request body.
        read_only_fields = ["id", "venue"]
