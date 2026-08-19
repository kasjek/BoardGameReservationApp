import secrets

from django.contrib.auth import get_user_model
from rest_framework import generics, permissions
from rest_framework.authtoken.models import Token
from rest_framework.response import Response
from rest_framework.views import APIView

from .activation import (
    ACTIVATED_DETAIL,
    ACTIVATION_DETAIL,
    REGISTERED_DETAIL,
    RESEND_DETAIL,
    activate_with_key,
    issue_and_send_activation,
    require_email_delivery,
)
from .captcha import captcha_public_config
from .facebook import (
    FacebookAuthError,
    facebook_app_id,
    facebook_configured,
    raise_facebook_as_api,
    user_from_facebook,
    verify_facebook_access_token,
)
from .google import (
    GoogleAuthError,
    google_client_id,
    raise_as_api,
    user_from_google,
    verify_google_id_token,
)
from .serializers import (
    ChangePasswordSerializer,
    PublicUserSerializer,
    RegisterSerializer,
    UserSerializer,
)

User = get_user_model()


class LoginView(APIView):
    """Username/password login. Inactive (not yet email-activated) accounts are rejected."""

    permission_classes = [permissions.AllowAny]
    throttle_scope = "login"

    def post(self, request):
        username = request.data.get("username") or ""
        password = request.data.get("password") or ""
        user = User.objects.filter(username=username).first()
        if not user or not user.check_password(password):
            return Response(
                {"non_field_errors": ["Unable to log in with provided credentials."]},
                status=400,
            )
        if not user.is_active:
            return Response({"detail": ACTIVATION_DETAIL}, status=403)
        token, _ = Token.objects.get_or_create(user=user)
        return Response({"token": token.key})


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


class FacebookConfigView(APIView):
    """Public: whether Facebook Login is enabled and which app id the SDK should use."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        enabled = facebook_configured()
        return Response(
            {
                "facebook_enabled": enabled,
                "facebook_app_id": facebook_app_id() if enabled else None,
            }
        )


class FacebookLoginView(APIView):
    """Exchange a Facebook user access token for an app auth token.

    Creates a USER or logs into the existing account with the same verified email.
    """

    permission_classes = [permissions.AllowAny]
    throttle_scope = "login"

    def post(self, request):
        access_token = request.data.get("access_token") or request.data.get("token") or ""
        try:
            info = verify_facebook_access_token(str(access_token))
            user, created = user_from_facebook(info)
        except FacebookAuthError as exc:
            raise_facebook_as_api(exc)
            raise
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
        require_email_delivery()
        user = serializer.save()
        issue_and_send_activation(user)
        return Response(
            {"detail": REGISTERED_DETAIL, "email": user.email},
            status=201,
        )


class ActivateView(APIView):
    """Public: click the emailed link to activate a password account."""

    permission_classes = [permissions.AllowAny]
    throttle_scope = "register"

    def get(self, request):
        return self._activate(request.query_params.get("token") or "")

    def post(self, request):
        return self._activate(request.data.get("token") or request.query_params.get("token") or "")

    def _activate(self, key: str):
        activate_with_key(str(key))
        return Response({"detail": ACTIVATED_DETAIL})


class ResendActivationView(APIView):
    """Public: send a new activation link when the account is still inactive."""

    permission_classes = [permissions.AllowAny]
    throttle_scope = "register"

    def post(self, request):
        require_email_delivery()
        email = str(request.data.get("email") or "").strip().lower()
        user = User.objects.filter(email__iexact=email, is_active=False).first()
        if user and user.email:
            issue_and_send_activation(user)
        return Response({"detail": RESEND_DETAIL})


class MeView(generics.RetrieveAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class PublicUserView(generics.RetrieveAPIView):
    queryset = User.objects.all()
    serializer_class = PublicUserSerializer
    permission_classes = [permissions.AllowAny]


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
                {"detail": "This account uses social sign-in and has no password yet."},
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
