from django.http import HttpResponse, HttpResponseRedirect
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


class BggCoverView(APIView):
    """Redirect to a game's BoardGameGeek cover thumbnail, or 404 if unresolved.

    A 404 lets the frontend <img> fall back to a placeholder.
    """

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        name = request.query_params.get("q", "").strip()
        if not name:
            raise ValidationError("q (game name) is required.")
        url = services.resolve_cover_url(name)
        if not url:
            return HttpResponse(status=404)
        return HttpResponseRedirect(url)
