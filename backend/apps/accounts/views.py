import secrets

from django.contrib.auth import get_user_model
from rest_framework import generics, permissions
from rest_framework.authtoken.models import Token
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import PublicUserSerializer, RegisterSerializer, UserSerializer

User = get_user_model()


class LoginView(ObtainAuthToken):
    throttle_scope = "login"


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


class RollAvatarView(APIView):
    """Re-roll the user's DiceBear avatar seed ("roll the dice")."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        user.avatar_seed = secrets.token_hex(6)
        user.save(update_fields=["avatar_seed"])
        return Response(UserSerializer(user).data)
