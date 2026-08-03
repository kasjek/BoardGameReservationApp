from django.http import HttpResponseRedirect
from rest_framework import permissions
from rest_framework.exceptions import ValidationError
from rest_framework.views import APIView

from . import services


class BggRedirectView(APIView):
    """Redirect to the exact BoardGameGeek page for a game title (falls back to search)."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        name = request.query_params.get("q", "").strip()
        if not name:
            raise ValidationError("q (game name) is required.")
        return HttpResponseRedirect(services.resolve_url(name))
