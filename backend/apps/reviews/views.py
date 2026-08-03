from rest_framework import generics, permissions

from .models import Review
from .serializers import ReviewSerializer


class ReviewCreateView(generics.CreateAPIView):
    serializer_class = ReviewSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)


class UserReviewsView(generics.ListAPIView):
    serializer_class = ReviewSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return Review.objects.filter(target_user_id=self.kwargs["user_id"]).order_by("-created_at")


class VenueReviewsView(generics.ListAPIView):
    serializer_class = ReviewSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return Review.objects.filter(target_venue_id=self.kwargs["venue_id"]).order_by("-created_at")
