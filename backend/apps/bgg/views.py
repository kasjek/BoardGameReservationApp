from django.http import HttpResponse, HttpResponseRedirect
from rest_framework import permissions
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services


class BggRedirectView(APIView):
    """Redirect to the exact BoardGameGeek page for a game title (falls back to search)."""

    permission_classes = [permissions.AllowAny]
    throttle_scope = "bgg"

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
    throttle_scope = "bgg"

    def get(self, request):
        name = request.query_params.get("q", "").strip()
        if not name:
            raise ValidationError("q (game name) is required.")
        url = services.resolve_cover_url(name)
        if not url:
            return HttpResponse(status=404)
        return HttpResponseRedirect(url)


class BggSearchView(APIView):
    """JSON search hits from BoardGameGeek for admin game pickers."""

    permission_classes = [permissions.IsAuthenticated]
    throttle_scope = "bgg"

    def get(self, request):
        q = request.query_params.get("q", "").strip()
        if len(q) < 2:
            raise ValidationError("q must be at least 2 characters.")
        try:
            limit = int(request.query_params.get("limit", "20"))
        except (TypeError, ValueError):
            limit = 20
        results = services.search_boardgames(q, limit=limit)
        return Response({"results": results})


class BggThingView(APIView):
    """JSON details for a BoardGameGeek thing id (includes recommended playtime)."""

    permission_classes = [permissions.IsAuthenticated]
    throttle_scope = "bgg"

    def get(self, request):
        raw = request.query_params.get("id", "").strip()
        try:
            bgg_id = int(raw)
        except (TypeError, ValueError):
            raise ValidationError("id must be a positive BoardGameGeek thing id.")
        if bgg_id < 1:
            raise ValidationError("id must be a positive BoardGameGeek thing id.")
        thing = services.fetch_thing(bgg_id)
        if not thing:
            return Response({"detail": "Game not found on BoardGameGeek."}, status=404)
        return Response(thing)
