from django.urls import path

from .views import (
    BggCategoriesView,
    BggCoverView,
    BggDirectoryView,
    BggRedirectView,
    BggSearchView,
    BggThingView,
)

urlpatterns = [
    path("bgg/redirect", BggRedirectView.as_view(), name="bgg-redirect"),
    path("bgg/cover", BggCoverView.as_view(), name="bgg-cover"),
    path("bgg/search", BggSearchView.as_view(), name="bgg-search"),
    path("bgg/directory", BggDirectoryView.as_view(), name="bgg-directory"),
    path("bgg/thing", BggThingView.as_view(), name="bgg-thing"),
    path("bgg/categories", BggCategoriesView.as_view(), name="bgg-categories"),
]
