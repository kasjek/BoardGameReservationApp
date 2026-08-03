from rest_framework import serializers

from .models import Venue, VenueAvailability


class VenueSerializer(serializers.ModelSerializer):
    class Meta:
        model = Venue
        fields = ["id", "name", "description", "location", "created_at"]
        read_only_fields = ["id", "created_at"]


class VenueAvailabilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = VenueAvailability
        fields = ["id", "venue", "date", "start_time", "end_time", "tables_available"]
        read_only_fields = ["id"]
