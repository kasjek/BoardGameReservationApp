from django.urls import path

from .views import (
    VenueAvailabilityListCreateView,
    VenueClosureDestroyView,
    VenueClosureListCreateView,
    VenueDetailView,
    VenueGameDestroyView,
    VenueGameListCreateView,
    VenueHoursView,
    VenueListCreateView,
    VenuePictureView,
)

urlpatterns = [
    path("venues", VenueListCreateView.as_view(), name="venue-list"),
    path("venues/<int:pk>", VenueDetailView.as_view(), name="venue-detail"),
    path("venues/<int:pk>/picture", VenuePictureView.as_view(), name="venue-picture"),
    path(
        "venues/<int:venue_id>/availability",
        VenueAvailabilityListCreateView.as_view(),
        name="venue-availability",
    ),
    path(
        "venues/<int:venue_id>/hours",
        VenueHoursView.as_view(),
        name="venue-hours",
    ),
    path(
        "venues/<int:venue_id>/closures",
        VenueClosureListCreateView.as_view(),
        name="venue-closures",
    ),
    path(
        "venues/<int:venue_id>/closures/<int:pk>",
        VenueClosureDestroyView.as_view(),
        name="venue-closure-detail",
    ),
    path(
        "venues/<int:venue_id>/games",
        VenueGameListCreateView.as_view(),
        name="venue-games",
    ),
    path(
        "venues/<int:venue_id>/games/<int:pk>",
        VenueGameDestroyView.as_view(),
        name="venue-game-detail",
    ),
]
