from django.urls import path

from .views import (
    VenueAvailabilityListCreateView,
    VenueDetailView,
    VenueGameListView,
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
    path(
        "venues/<int:venue_id>/games",
        VenueGameListView.as_view(),
        name="venue-games",
    ),
]
