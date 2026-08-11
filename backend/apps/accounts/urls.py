from django.urls import path

from .views import (
    ChangePasswordView,
    LoginView,
    MeView,
    PublicUserView,
    RegisterView,
    RollAvatarView,
)

urlpatterns = [
    path("auth/register", RegisterView.as_view(), name="register"),
    path("auth/login", LoginView.as_view(), name="login"),
    path("auth/me", MeView.as_view(), name="me"),
    path("me/avatar/roll", RollAvatarView.as_view(), name="roll-avatar"),
    path("me/password", ChangePasswordView.as_view(), name="change-password"),
    path("users/<int:pk>", PublicUserView.as_view(), name="public-user"),
]
