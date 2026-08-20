from rest_framework import serializers

from .models import SeatReservation, Table


class TableSerializer(serializers.ModelSerializer):
    venue_name = serializers.CharField(source="venue.name", read_only=True)

    class Meta:
        model = Table
        fields = [
            "id",
            "organizer",
            "venue",
            "venue_name",
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
    username = serializers.CharField(source="user.username", read_only=True)
    avatar_seed = serializers.CharField(source="user.avatar_seed", read_only=True)
    avatar_equipped = serializers.SerializerMethodField()

    class Meta:
        model = SeatReservation
        fields = [
            "id",
            "table",
            "user",
            "username",
            "avatar_seed",
            "avatar_equipped",
            "is_organizer",
            "status",
            "waitlist_position",
            "paid",
            "created_at",
            "cancelled_at",
        ]
        read_only_fields = fields

    def get_avatar_equipped(self, obj):
        from apps.accounts.cosmetics import parse_equipped

        return parse_equipped(getattr(obj.user, "avatar_equipped", None))
