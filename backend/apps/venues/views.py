from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import Role

from .hours import set_weekly_hours, sync_availability_from_hours
from .models import Venue, VenueAvailability, VenueClosure, VenueWeeklyHours
from .serializers import (
    VenueAvailabilitySerializer,
    VenueClosureSerializer,
    VenueCreateSerializer,
    VenueSerializer,
    VenueWeeklyHoursSerializer,
)


class IsAdminRole(permissions.BasePermission):
    """Only ADMIN may create/modify venues (docs/Permissions.md)."""

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_authenticated and request.user.role == Role.ADMIN)


def _require_manager(user, venue):
    from rest_framework.exceptions import PermissionDenied

    if not user.manages_venue(venue):
        raise PermissionDenied("Only the venue (or an admin) can manage this venue.")


class VenueListCreateView(generics.ListCreateAPIView):
    queryset = Venue.objects.all().order_by("name")
    permission_classes = [IsAdminRole]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return VenueCreateSerializer
        return VenueSerializer


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
        _require_manager(self.request.user, venue)
        serializer.save(venue=venue)


class VenueHoursView(APIView):
    """GET/PUT recurring bookable hours (Mon–Sun) for a venue."""

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def get(self, request, venue_id):
        venue = generics.get_object_or_404(Venue, pk=venue_id)
        rows = VenueWeeklyHours.objects.filter(venue=venue).order_by("weekday")
        return Response(VenueWeeklyHoursSerializer(rows, many=True).data)

    def put(self, request, venue_id):
        venue = generics.get_object_or_404(Venue, pk=venue_id)
        _require_manager(request.user, venue)
        ser = VenueWeeklyHoursSerializer(data=request.data, many=True)
        ser.is_valid(raise_exception=True)
        try:
            rows = set_weekly_hours(venue, ser.validated_data)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(VenueWeeklyHoursSerializer(rows, many=True).data)


class VenueClosureListCreateView(generics.ListCreateAPIView):
    serializer_class = VenueClosureSerializer

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        return VenueClosure.objects.filter(venue_id=self.kwargs["venue_id"]).order_by("date")

    def perform_create(self, serializer):
        venue = generics.get_object_or_404(Venue, pk=self.kwargs["venue_id"])
        _require_manager(self.request.user, venue)
        serializer.save(venue=venue, created_by=self.request.user)
        sync_availability_from_hours(venue)


class VenueClosureDestroyView(generics.DestroyAPIView):
    serializer_class = VenueClosureSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return VenueClosure.objects.filter(venue_id=self.kwargs["venue_id"])

    def perform_destroy(self, instance):
        venue = instance.venue
        _require_manager(self.request.user, venue)
        super().perform_destroy(instance)
        sync_availability_from_hours(venue)
