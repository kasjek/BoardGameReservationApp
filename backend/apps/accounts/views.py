import secrets

from django.contrib.auth import get_user_model
from rest_framework import generics, permissions
from rest_framework.authtoken.models import Token
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.response import Response
from rest_framework.views import APIView

from .captcha import captcha_public_config
from .google import (
    GoogleAuthError,
    google_client_id,
    raise_as_api,
    user_from_google,
    verify_google_id_token,
)
from .profile_stats import game_stats
from .serializers import (
    ChangePasswordSerializer,
    PublicUserSerializer,
    RegisterSerializer,
    UserSerializer,
)

User = get_user_model()


class LoginView(ObtainAuthToken):
    throttle_scope = "login"


class GoogleConfigView(APIView):
    """Public: whether GIS is enabled and which client ID the browser should use."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        cid = google_client_id()
        return Response({"google_client_id": cid or None, "google_enabled": bool(cid)})


class GoogleLoginView(APIView):
    """Exchange a Google Identity Services ID token for an app auth token.

    Self-serve Google sign-in creates a USER (docs/Permissions.md), or logs into
    an existing account that already has the same verified email.
    """

    permission_classes = [permissions.AllowAny]
    throttle_scope = "login"

    def post(self, request):
        credential = request.data.get("credential") or request.data.get("id_token") or ""
        try:
            info = verify_google_id_token(str(credential))
            user, created = user_from_google(info)
        except GoogleAuthError as exc:
            raise_as_api(exc)
            raise  # raise_as_api always raises; keeps type-checkers happy
        token, _ = Token.objects.get_or_create(user=user)
        return Response(
            {"token": token.key, "user": UserSerializer(user).data},
            status=201 if created else 200,
        )


class CaptchaConfigView(APIView):
    """Public: whether reCAPTCHA is enabled and which site key the widget should use."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response(captcha_public_config())


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]
    throttle_scope = "register"

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        token, _ = Token.objects.get_or_create(user=user)
        return Response(
            {"token": token.key, "user": UserSerializer(user).data}, status=201
        )


class MeView(generics.RetrieveAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class PublicUserView(generics.RetrieveAPIView):
    queryset = User.objects.all()
    serializer_class = PublicUserSerializer
    permission_classes = [permissions.AllowAny]


class PublicUserGamesView(APIView):
    """Games a user reserved a seat at (sessions + unique titles). Public, no email."""

    permission_classes = [permissions.AllowAny]

    def get(self, request, pk):
        user = generics.get_object_or_404(User, pk=pk)
        return Response(game_stats(user))


class RollAvatarView(APIView):
    """Re-roll the user's DiceBear avatar seed ("roll the dice")."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        user.avatar_seed = secrets.token_hex(6)
        user.save(update_fields=["avatar_seed"])
        return Response(UserSerializer(user).data)


class ChangePasswordView(APIView):
    """Let the signed-in user change their password from the profile page."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not request.user.has_usable_password():
            return Response(
                {"detail": "This account uses Google sign-in and has no password yet."},
                status=400,
            )
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = request.user
        user.set_password(serializer.validated_data["new_password"])
        user.save(update_fields=["password"])
        # Rotate the auth token so old sessions cannot keep using the prior password's token.
        Token.objects.filter(user=user).delete()
        token = Token.objects.create(user=user)
        return Response({"detail": "Password updated.", "token": token.key})
