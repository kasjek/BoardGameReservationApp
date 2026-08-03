from django.urls import path
from rest_framework.authtoken.views import obtain_auth_token

from .views import MeView, RegisterView

urlpatterns = [
    path("auth/register", RegisterView.as_view(), name="register"),
    path("auth/login", obtain_auth_token, name="login"),
    path("auth/me", MeView.as_view(), name="me"),
]
