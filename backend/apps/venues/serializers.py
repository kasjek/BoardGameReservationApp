from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .hours import default_weekly_hours_payload, set_weekly_hours, sync_availability_from_hours
from .models import Venue, VenueAvailability, VenueClosure, VenueGame, VenuePhoto, VenueWeeklyHours
from .photos import save_photo_data_url


def _apply_photo(venue, photo):
    if not photo:
        return
    try:
        save_photo_data_url(venue, photo)
    except DjangoValidationError as exc:
        detail = getattr(exc, "message_dict", None) or getattr(exc, "messages", str(exc))
        raise serializers.ValidationError(detail) from exc


class VenueSerializer(serializers.ModelSerializer):
    rating_avg = serializers.SerializerMethodField()
    maps_url = serializers.SerializerMethodField()
    photo_url = serializers.SerializerMethodField()
    photo = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = Venue
        fields = [
            "id",
            "name",
            "description",
            "location",
            "min_players",
            "max_players",
            "min_reservation_minutes",
            "max_reservation_minutes",
            "rating_avg",
            "maps_url",
            "photo_url",
            "photo",
            "created_at",
        ]
        read_only_fields = ["id", "rating_avg", "maps_url", "photo_url", "created_at"]

    def validate(self, attrs):
        min_m = attrs.get(
            "min_reservation_minutes",
            getattr(self.instance, "min_reservation_minutes", 60),
        )
        max_m = attrs.get(
            "max_reservation_minutes",
            getattr(self.instance, "max_reservation_minutes", 180),
        )
        if min_m < 30:
            raise serializers.ValidationError(
                {"min_reservation_minutes": "Minimum reservation time must be at least 30 minutes."}
            )
        if max_m < min_m:
            raise serializers.ValidationError(
                {
                    "max_reservation_minutes": (
                        "Maximum duration must be greater than or equal to the minimum reservation time."
                    )
                }
            )
        return attrs

    def get_rating_avg(self, obj):
        from apps.reviews.models import average_rating_for_venue

        return average_rating_for_venue(obj.id)

    def get_maps_url(self, obj):
        if not obj.location and not obj.name:
            return None
        from .seed import google_maps_url

        return google_maps_url(obj.location or "", name=obj.name or "")

    def get_photo_url(self, obj):
        try:
            photo = obj.profile_photo
        except VenuePhoto.DoesNotExist:
            return None
        if not photo.image:
            return None
        request = self.context.get("request")
        url = photo.image.url
        return request.build_absolute_uri(url) if request else url

    def create(self, validated_data):
        photo = validated_data.pop("photo", None)
        venue = super().create(validated_data)
        _apply_photo(venue, photo)
        return venue

    def update(self, instance, validated_data):
        photo = validated_data.pop("photo", None)
        venue = super().update(instance, validated_data)
        _apply_photo(venue, photo)
        return venue


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


class VenueGameSerializer(serializers.ModelSerializer):
    cover_url = serializers.SerializerMethodField()
    bgg_url = serializers.SerializerMethodField()

    class Meta:
        model = VenueGame
        fields = [
            "id",
            "venue",
            "title",
            "bgg_id",
            "thumbnail_url",
            "cover_url",
            "bgg_url",
            "is_active",
            "min_players",
            "max_players",
        ]
        read_only_fields = fields

    def get_cover_url(self, obj):
        return obj.thumbnail_url or None

    def get_bgg_url(self, obj):
        from apps.bgg.services import game_page_url

        # Only the concrete game page — never a BGG search-results URL.
        if obj.bgg_id:
            return game_page_url(obj.bgg_id)
        return None


class VenueGameWriteSerializer(serializers.Serializer):
    """Add a game from a BGG search hit (preferred) or a bare title."""

    bgg_id = serializers.IntegerField(required=False, min_value=1)
    title = serializers.CharField(required=False, allow_blank=False, max_length=200)
    min_players = serializers.IntegerField(required=False, min_value=1, max_value=99)
    max_players = serializers.IntegerField(required=False, min_value=1, max_value=99)

    def validate(self, attrs):
        if not attrs.get("bgg_id") and not attrs.get("title"):
            raise serializers.ValidationError("Provide bgg_id (preferred) or title.")
        min_p = attrs.get("min_players", 2)
        max_p = attrs.get("max_players", 8)
        if max_p < min_p:
            raise serializers.ValidationError("Require 1 <= min_players <= max_players.")
        attrs["min_players"] = min_p
        attrs["max_players"] = max_p
        return attrs

    def create(self, validated_data):
        from apps.bgg import services as bgg

        venue = self.context["venue"]
        bgg_id = validated_data.get("bgg_id")
        title = (validated_data.get("title") or "").strip()
        thumbnail_url = ""

        if bgg_id:
            thing = bgg.fetch_thing(bgg_id)
            if thing:
                title = thing["name"] or title
                thumbnail_url = thing.get("thumbnail_url") or ""
            if not title:
                raise serializers.ValidationError(
                    {"bgg_id": "Could not load that BoardGameGeek game."}
                )
            if VenueGame.objects.filter(venue=venue, bgg_id=bgg_id).exists():
                raise serializers.ValidationError(
                    {"bgg_id": "That game is already listed for this venue."}
                )
        else:
            # Title-only path: resolve BGG id + cover when possible.
            resolved_id = bgg.resolve_bgg_id(title)
            if resolved_id:
                bgg_id = resolved_id
                thing = bgg.fetch_thing(resolved_id)
                if thing:
                    title = thing["name"] or title
                    thumbnail_url = thing.get("thumbnail_url") or ""
            if not thumbnail_url:
                thumbnail_url = bgg.resolve_cover_url(title) or ""

        if VenueGame.objects.filter(venue=venue, title__iexact=title).exists():
            raise serializers.ValidationError(
                {"title": "That game is already listed for this venue."}
            )

        return VenueGame.objects.create(
            venue=venue,
            title=title,
            bgg_id=bgg_id,
            thumbnail_url=thumbnail_url or "",
            is_active=True,
            min_players=validated_data.get("min_players", 2),
            max_players=validated_data.get("max_players", 8),
        )


class VenueGameSeatSerializer(serializers.ModelSerializer):
    class Meta:
        model = VenueGame
        fields = ["min_players", "max_players"]

    def validate(self, attrs):
        min_p = attrs.get("min_players", self.instance.min_players)
        max_p = attrs.get("max_players", self.instance.max_players)
        if min_p < 1 or max_p < min_p or max_p > 99:
            raise serializers.ValidationError("Require 1 <= min_players <= max_players <= 99.")
        return attrs


class VenueCreateSerializer(VenueSerializer):
    """Admin create: name, address, weekly bookable hours, optional games/photo/closures."""

    weekly_hours = VenueWeeklyHoursSerializer(many=True, required=False)
    closures = VenueClosureWriteSerializer(many=True, required=False)
    games = VenueGameWriteSerializer(many=True, required=False)

    class Meta(VenueSerializer.Meta):
        fields = VenueSerializer.Meta.fields + ["weekly_hours", "closures", "games"]

    def create(self, validated_data):
        hours = validated_data.pop("weekly_hours", None)
        closures = validated_data.pop("closures", [])
        games = validated_data.pop("games", [])
        photo = validated_data.pop("photo", None)
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
        for g in games:
            VenueGameWriteSerializer(context={"venue": venue}).create(g)
        if photo:
            _apply_photo(venue, photo)
        return venue

    def to_representation(self, instance):
        return VenueSerializer(instance, context=self.context).data
