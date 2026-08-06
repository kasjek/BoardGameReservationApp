from django.urls import path

from .views import BggCoverView, BggGamesView, BggRedirectView

urlpatterns = [
    path("bgg/redirect", BggRedirectView.as_view(), name="bgg-redirect"),
    path("bgg/cover", BggCoverView.as_view(), name="bgg-cover"),
    path("bgg/games", BggGamesView.as_view(), name="bgg-games"),
]
