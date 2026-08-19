from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from rest_framework import serializers

from .models import Role

User = get_user_model()


def _derived(user):
    cached = getattr(user, "_derived_cache", None)
    if cached is not None:
        return cached
    from apps.reviews.models import average_rating_for_user
    from apps.tables.models import LateCancellationMark, SeatReservation, SeatStatus

    from .profile_stats import game_stats

    stats = game_stats(user)
    cached = {
        "rating_avg": average_rating_for_user(user.id),
        "cancellations_count": SeatReservation.objects.filter(
            user=user, status=SeatStatus.CANCELLED
        ).count(),
        "late_cancel_marks_active": LateCancellationMark.objects.filter(
            user=user, expires_at__gt=timezone.now()
        ).count(),
        "games_played": stats["games_played"],
        "different_games": stats["different_games"],
    }
    user._derived_cache = cached
    return cached


class UserSerializer(serializers.ModelSerializer):
    rating_avg = serializers.SerializerMethodField()
    cancellations_count = serializers.SerializerMethodField()
    late_cancel_marks_active = serializers.SerializerMethodField()
    games_played = serializers.SerializerMethodField()
    different_games = serializers.SerializerMethodField()
    has_usable_password = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "role",
            "venue",
            "allow_invites",
            "avatar_seed",
            "rating_avg",
            "cancellations_count",
            "late_cancel_marks_active",
            "games_played",
            "different_games",
            "has_usable_password",
        ]
        read_only_fields = ["id", "role", "venue", "avatar_seed", "has_usable_password"]

    def get_has_usable_password(self, obj):
        return obj.has_usable_password()

    def get_rating_avg(self, obj):
        return _derived(obj)["rating_avg"]

    def get_cancellations_count(self, obj):
        return _derived(obj)["cancellations_count"]

    def get_late_cancel_marks_active(self, obj):
        return _derived(obj)["late_cancel_marks_active"]

    def get_games_played(self, obj):
        return _derived(obj)["games_played"]

    def get_different_games(self, obj):
        return _derived(obj)["different_games"]


class PublicUserSerializer(serializers.ModelSerializer):
    """Public profile: username, avatar, rating, late cancels, games joined — no email."""

    rating_avg = serializers.SerializerMethodField()
    cancellations_count = serializers.SerializerMethodField()
    late_cancel_marks_active = serializers.SerializerMethodField()
    games_played = serializers.SerializerMethodField()
    different_games = serializers.SerializerMethodField()

    friendship = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "avatar_seed",
            "rating_avg",
            "cancellations_count",
            "late_cancel_marks_active",
            "games_played",
            "different_games",
            "friendship",
        ]

    def get_friendship(self, obj):
        from .friends import friendship_payload

        request = self.context.get("request")
        viewer = getattr(request, "user", None) if request else None
        return friendship_payload(viewer, obj)

    def get_rating_avg(self, obj):
        return _derived(obj)["rating_avg"]

    def get_cancellations_count(self, obj):
        return _derived(obj)["cancellations_count"]

    def get_late_cancel_marks_active(self, obj):
        return _derived(obj)["late_cancel_marks_active"]

    def get_games_played(self, obj):
        return _derived(obj)["games_played"]

    def get_different_games(self, obj):
        return _derived(obj)["different_games"]


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ["id", "username", "email", "password"]

    def validate_password(self, value: str) -> str:
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages)) from exc
        return value

    def create(self, validated_data):
        # Self-registration always creates a standard USER (docs/Permissions.md).
        return User.objects.create_user(role=Role.USER, **validated_data)


class ChangePasswordSerializer(serializers.Serializer):
    """Authenticated user changes their own password (profile settings)."""

    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        user = self.context["request"].user
        if not user.check_password(attrs["current_password"]):
            raise serializers.ValidationError(
                {"current_password": "Current password is incorrect."}
            )
        if attrs["new_password"] != attrs["confirm_password"]:
            raise serializers.ValidationError(
                {"confirm_password": "New passwords do not match."}
            )
        if attrs["new_password"] == attrs["current_password"]:
            raise serializers.ValidationError(
                {"new_password": "New password must be different from the current password."}
            )
        try:
            validate_password(attrs["new_password"], user=user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(
                {"new_password": list(exc.messages)}
            ) from exc
        return attrs


class FriendUserSerializer(serializers.ModelSerializer):
    """Login + avatar for search results and the friends list. No email."""

    rating_avg = serializers.SerializerMethodField()
    friendship = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "avatar_seed", "rating_avg", "friendship"]

    def get_rating_avg(self, obj):
        return _derived(obj)["rating_avg"]

    def get_friendship(self, obj):
        from .friends import friendship_payload

        request = self.context.get("request")
        viewer = getattr(request, "user", None) if request else None
        return friendship_payload(viewer, obj)

