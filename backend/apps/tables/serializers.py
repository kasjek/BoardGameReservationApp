from rest_framework import serializers

from .models import SeatReservation, Table


class TableSerializer(serializers.ModelSerializer):
    class Meta:
        model = Table
        fields = [
            "id",
            "organizer",
            "venue",
            "game_title",
            "bring_own_game",
            "game_language",
            "game_language_other",
            "venue_game_confirmed",
            "starts_at",
            "ends_at",
            "min_players",
            "max_players",
            "status",
            "seats_taken",
            "created_at",
        ]
        read_only_fields = fields


class TableCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Table
        fields = [
            "venue",
            "game_title",
            "bring_own_game",
            "game_language",
            "game_language_other",
            "starts_at",
            "ends_at",
            "min_players",
            "max_players",
        ]


class SeatReservationSerializer(serializers.ModelSerializer):
    class Meta:
        model = SeatReservation
        fields = [
            "id",
            "table",
            "user",
            "is_organizer",
            "status",
            "waitlist_position",
            "created_at",
            "cancelled_at",
        ]
        read_only_fields = fields
