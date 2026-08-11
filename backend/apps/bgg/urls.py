from django.urls import path

from .views import BggCoverView, BggRedirectView, BggSearchView

urlpatterns = [
    path("bgg/redirect", BggRedirectView.as_view(), name="bgg-redirect"),
    path("bgg/cover", BggCoverView.as_view(), name="bgg-cover"),
    path("bgg/search", BggSearchView.as_view(), name="bgg-search"),
]
