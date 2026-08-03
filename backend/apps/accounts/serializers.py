from django.contrib.auth import get_user_model
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
            "rating_avg",
            "cancellations_count",
            "late_cancel_marks_active",
        ]
        read_only_fields = ["id", "role", "venue"]

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
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ["id", "username", "email", "password"]

    def create(self, validated_data):
        # Self-registration always creates a standard USER (docs/Permissions.md).
        return User.objects.create_user(role=Role.USER, **validated_data)
