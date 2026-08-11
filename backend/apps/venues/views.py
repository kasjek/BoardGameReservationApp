from rest_framework import generics, permissions

from apps.accounts.models import Role

from .models import Venue, VenueAvailability, VenueGame
from .serializers import VenueAvailabilitySerializer, VenueGameSerializer, VenueSerializer


class IsAdminRole(permissions.BasePermission):
    """Only ADMIN may create/modify venues (docs/Permissions.md)."""

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_authenticated and request.user.role == Role.ADMIN)


class VenueListCreateView(generics.ListCreateAPIView):
    queryset = Venue.objects.all().order_by("name")
    serializer_class = VenueSerializer
    permission_classes = [IsAdminRole]


class VenueDetailView(generics.RetrieveAPIView):
    queryset = Venue.objects.all()
    serializer_class = VenueSerializer
    permission_classes = [permissions.AllowAny]


class VenueAvailabilityListCreateView(generics.ListCreateAPIView):
    serializer_class = VenueAvailabilitySerializer

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        return VenueAvailability.objects.filter(venue_id=self.kwargs["venue_id"]).order_by("date")

    def perform_create(self, serializer):
        venue = generics.get_object_or_404(Venue, pk=self.kwargs["venue_id"])
        user = self.request.user
        if not user.manages_venue(venue):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Only the venue (or an admin) can set availability.")
        serializer.save(venue=venue)


class VenueGameListView(generics.ListAPIView):
    """Active games offered at a venue — used by the New Table dropdown."""

    serializer_class = VenueGameSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return VenueGame.objects.filter(
            venue_id=self.kwargs["venue_id"], is_active=True
        ).order_by("title")
