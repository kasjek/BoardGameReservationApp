from django.urls import path

from .views import ReviewCreateView, UserReviewsView, VenueReviewsView

urlpatterns = [
    path("reviews", ReviewCreateView.as_view(), name="review-create"),
    path("users/<int:user_id>/reviews", UserReviewsView.as_view(), name="user-reviews"),
    path("venues/<int:venue_id>/reviews", VenueReviewsView.as_view(), name="venue-reviews"),
]
