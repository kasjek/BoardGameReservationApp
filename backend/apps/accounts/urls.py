from django.urls import path

from .views import LoginView, MeView, PublicUserView, RegisterView

urlpatterns = [
    path("auth/register", RegisterView.as_view(), name="register"),
    path("auth/login", LoginView.as_view(), name="login"),
    path("auth/me", MeView.as_view(), name="me"),
    path("users/<int:pk>", PublicUserView.as_view(), name="public-user"),
]
