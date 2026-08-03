from rest_framework import serializers

from .models import Review, ReviewTarget


class ReviewSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source="author.username", read_only=True)

    class Meta:
        model = Review
        fields = [
            "id",
            "author",
            "author_name",
            "target_type",
            "target_user",
            "target_venue",
            "rating",
            "body",
            "response_body",
            "created_at",
        ]
        read_only_fields = ["id", "author", "author_name", "response_body", "created_at"]

    def validate(self, data):
        if not (1 <= data["rating"] <= 5):
            raise serializers.ValidationError("rating must be between 1 and 5.")
        if data["target_type"] == ReviewTarget.USER:
            if not data.get("target_user"):
                raise serializers.ValidationError("target_user is required for a user review.")
            data["target_venue"] = None
        else:
            if not data.get("target_venue"):
                raise serializers.ValidationError("target_venue is required for a venue review.")
            data["target_user"] = None
        return data
