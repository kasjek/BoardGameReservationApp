"""Resolve a board game title to its BoardGameGeek game page.

Uses the BGG XML API2 search endpoint, preferring an exact-name match. Successful
resolutions are cached in the DB. When BGG is unreachable (e.g. restricted egress),
callers fall back to a BGG search URL so the link still works.
"""

from __future__ import annotations

import os
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from urllib.parse import quote_plus

# BGG requires requests to boardgamegeek.com (no www) and, since mid-2025, an
# approved application token via an Authorization: Bearer header. Set BGG_API_TOKEN
# to enable live resolution; without it the API returns 401 and callers fall back.
BGG_SEARCH_API = "https://boardgamegeek.com/xmlapi2/search"
BGG_THING_API = "https://boardgamegeek.com/xmlapi2/thing"
BGG_GAME_URL = "https://boardgamegeek.com/boardgame/{id}"
_TIMEOUT = 6


def _auth_headers() -> dict[str, str]:
    headers = {"User-Agent": "BoardGameReservationApp/0.1"}
    token = os.environ.get("BGG_API_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def normalize(name: str) -> str:
    return " ".join(name.strip().lower().split())


def game_page_url(bgg_id: int) -> str:
    return BGG_GAME_URL.format(id=bgg_id)


def search_url(name: str) -> str:
    """Fallback: BGG's own search results for the title."""
    return (
        "https://boardgamegeek.com/geeksearch.php?action=search"
        f"&objecttype=boardgame&q={quote_plus(name)}"
    )


def _http_get(url: str) -> bytes | None:
    try:
        req = urllib.request.Request(url, headers=_auth_headers())
        with urllib.request.urlopen(req, timeout=_TIMEOUT) as resp:
            return resp.read()
    except (urllib.error.URLError, OSError, ValueError):
        return None


def _first_id(xml_bytes: bytes) -> int | None:
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError:
        return None
    item = root.find("item")
    if item is not None and item.get("id"):
        try:
            return int(item.get("id"))
        except (TypeError, ValueError):
            return None
    return None


def _bgg_search(name: str) -> int | None:
    """Always take the first (top-ranked) BGG search result — no exact-match preference,
    no user selection. Returns its id, or None if unreachable / no match."""
    query = f"{BGG_SEARCH_API}?query={quote_plus(name)}&type=boardgame"
    body = _http_get(query)
    if body is None:
        return None  # network/egress failure -> let caller fall back
    return _first_id(body)


def resolve_bgg_id(name: str) -> int | None:
    """Resolve (and cache) a game title to a BGG id, or None."""
    from .models import BggResolution

    norm = normalize(name)
    if not norm:
        return None
    cached = BggResolution.objects.filter(query_norm=norm).first()
    if cached is not None:
        return cached.bgg_id

    bgg_id = _bgg_search(name)
    if bgg_id is not None:
        BggResolution.objects.get_or_create(
            query_norm=norm, defaults={"bgg_id": bgg_id, "matched_name": name}
        )
    return bgg_id


def resolve_url(name: str) -> str:
    """Exact game page when resolvable, else the BGG search page."""
    bgg_id = resolve_bgg_id(name)
    return game_page_url(bgg_id) if bgg_id else search_url(name)


def _bgg_thumbnail(bgg_id: int) -> str | None:
    body = _http_get(f"{BGG_THING_API}?id={bgg_id}")
    if body is None:
        return None
    try:
        root = ET.fromstring(body)
    except ET.ParseError:
        return None
    thumb = root.find(".//thumbnail")
    if thumb is not None and thumb.text:
        url = thumb.text.strip()
        if url.startswith("//"):  # BGG returns protocol-relative URLs
            url = "https:" + url
        return url
    return None


def resolve_cover_url(name: str) -> str | None:
    """Resolve (and cache) a game title to its BGG cover thumbnail URL, or None."""
    from .models import BggResolution

    norm = normalize(name)
    if not norm:
        return None

    cached = BggResolution.objects.filter(query_norm=norm).first()
    if cached is not None and cached.thumbnail_url:
        return cached.thumbnail_url

    bgg_id = cached.bgg_id if cached is not None else resolve_bgg_id(name)
    if bgg_id is None:
        return None

    thumb = _bgg_thumbnail(bgg_id)
    if thumb:
        BggResolution.objects.update_or_create(
            query_norm=norm,
            defaults={"bgg_id": bgg_id, "thumbnail_url": thumb, "matched_name": name},
        )
    return thumb
