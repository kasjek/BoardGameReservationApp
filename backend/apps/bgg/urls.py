from django.urls import path

from .views import BggRedirectView

urlpatterns = [
    path("bgg/redirect", BggRedirectView.as_view(), name="bgg-redirect"),
]
