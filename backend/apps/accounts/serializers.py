from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from rest_framework import serializers

from .models import Role

User = get_user_model()


def _derived(user):
    from apps.reviews.models import average_rating_for_user
    from apps.tables.models import LateCancellationMark, SeatReservation, SeatStatus

    return {
        "rating_avg": average_rating_for_user(user.id),
        "cancellations_count": SeatReservation.objects.filter(
            user=user, status=SeatStatus.CANCELLED
        ).count(),
        "late_cancel_marks_active": LateCancellationMark.objects.filter(
            user=user, expires_at__gt=timezone.now()
        ).count(),
    }


class UserSerializer(serializers.ModelSerializer):
    rating_avg = serializers.SerializerMethodField()
    cancellations_count = serializers.SerializerMethodField()
    late_cancel_marks_active = serializers.SerializerMethodField()

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
        ]
        read_only_fields = ["id", "role", "venue", "avatar_seed"]

    def get_rating_avg(self, obj):
        return _derived(obj)["rating_avg"]

    def get_cancellations_count(self, obj):
        return _derived(obj)["cancellations_count"]

    def get_late_cancel_marks_active(self, obj):
        return _derived(obj)["late_cancel_marks_active"]


class PublicUserSerializer(serializers.ModelSerializer):
    """Privacy-limited public profile (NFR-1): only display name, rating, and marks."""

    rating_avg = serializers.SerializerMethodField()
    cancellations_count = serializers.SerializerMethodField()
    late_cancel_marks_active = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "avatar_seed",
            "rating_avg",
            "cancellations_count",
            "late_cancel_marks_active",
        ]

    def get_rating_avg(self, obj):
        return _derived(obj)["rating_avg"]

    def get_cancellations_count(self, obj):
        return _derived(obj)["cancellations_count"]

    def get_late_cancel_marks_active(self, obj):
        return _derived(obj)["late_cancel_marks_active"]


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
