from django.urls import path

from .views import (
    VenueAvailabilityListCreateView,
    VenueDetailView,
    VenueListCreateView,
)

urlpatterns = [
    path("venues", VenueListCreateView.as_view(), name="venue-list"),
    path("venues/<int:pk>", VenueDetailView.as_view(), name="venue-detail"),
    path(
        "venues/<int:venue_id>/availability",
        VenueAvailabilityListCreateView.as_view(),
        name="venue-availability",
    ),
]
