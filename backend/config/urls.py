from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("apps.accounts.urls")),
    path("api/", include("apps.venues.urls")),
    path("api/", include("apps.tables.urls")),
    path("api/", include("apps.reviews.urls")),
    path("api/", include("apps.bgg.urls")),
]
