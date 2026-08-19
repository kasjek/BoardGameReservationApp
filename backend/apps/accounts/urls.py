from django.urls import path

from .views import (
    CaptchaConfigView,
    ChangePasswordView,
    FacebookConfigView,
    FacebookLoginView,
    GoogleConfigView,
    GoogleLoginView,
    LoginView,
    MeView,
    PublicUserView,
    RegisterView,
    RollAvatarView,
)

urlpatterns = [
    path("auth/register", RegisterView.as_view(), name="register"),
    path("auth/login", LoginView.as_view(), name="login"),
    path("auth/captcha/config", CaptchaConfigView.as_view(), name="captcha-config"),
    path("auth/google", GoogleLoginView.as_view(), name="google-login"),
    path("auth/google/config", GoogleConfigView.as_view(), name="google-config"),
    path("auth/facebook", FacebookLoginView.as_view(), name="facebook-login"),
    path("auth/facebook/config", FacebookConfigView.as_view(), name="facebook-config"),
    path("auth/me", MeView.as_view(), name="me"),
    path("me/avatar/roll", RollAvatarView.as_view(), name="roll-avatar"),
    path("me/password", ChangePasswordView.as_view(), name="change-password"),
    path("users/<int:pk>", PublicUserView.as_view(), name="public-user"),
]
