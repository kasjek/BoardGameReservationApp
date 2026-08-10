"""Resolve a board game title to its BoardGameGeek page and cover image.

Links use the BGG XML API2 search endpoint (always the first result). Covers use the
BGG cover when a token is configured, otherwise fall back to a Wikipedia box image
(no token required). Successful resolutions are cached in the DB.
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from urllib.parse import quote, quote_plus

# BGG requires requests to boardgamegeek.com (no www) and, since mid-2025, an
# approved application token via an Authorization: Bearer header. Set BGG_API_TOKEN
# to enable live resolution; without it the API returns 401 and we fall back to
# Wikipedia box-cover images (no token needed). Public-facing UIs must show the
# official "Powered by BGG" logo (see frontend Shell footer).
BGG_SEARCH_API = "https://boardgamegeek.com/xmlapi2/search"
BGG_THING_API = "https://boardgamegeek.com/xmlapi2/thing"
BGG_GAME_URL = "https://boardgamegeek.com/boardgame/{id}"
WIKI_SEARCH_API = "https://en.wikipedia.org/w/api.php"
WIKI_SUMMARY_API = "https://en.wikipedia.org/api/rest_v1/page/summary/"
_UA = {"User-Agent": "BoardGameReservationApp/0.1"}
_TIMEOUT = 6


def _auth_headers() -> dict[str, str]:
    headers = dict(_UA)
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


def _http_get(url: str, headers: dict[str, str] | None = None) -> bytes | None:
    try:
        req = urllib.request.Request(url, headers=headers or _UA)
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
    body = _http_get(query, _auth_headers())
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
    body = _http_get(f"{BGG_THING_API}?id={bgg_id}", _auth_headers())
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


def _wikipedia_cover(name: str) -> str | None:
    """Box-cover image for a game via Wikipedia (no token required).

    Searches for "<name> board game" to land on the right article (handles
    disambiguation), then reads that article's lead image.
    """
    search = (
        f"{WIKI_SEARCH_API}?action=query&list=search&srlimit=1&format=json"
        f"&srsearch={quote_plus(name + ' board game')}"
    )
    body = _http_get(search)
    if body is None:
        return None
    try:
        results = json.loads(body).get("query", {}).get("search", [])
    except (ValueError, AttributeError):
        return None
    if not results:
        return None
    title = results[0].get("title")
    if not title:
        return None

    body = _http_get(f"{WIKI_SUMMARY_API}{quote(title)}")
    if body is None:
        return None
    try:
        data = json.loads(body)
    except ValueError:
        return None
    thumb = (data.get("thumbnail") or {}).get("source")
    return thumb or (data.get("originalimage") or {}).get("source")


def resolve_cover_url(name: str) -> str | None:
    """Resolve (and cache) a game title to a cover thumbnail URL, or None.

    Prefers the BGG cover (needs a token), then falls back to a Wikipedia box image.
    """
    from .models import BggResolution

    norm = normalize(name)
    if not norm:
        return None

    cached = BggResolution.objects.filter(query_norm=norm).first()
    if cached is not None and cached.thumbnail_url:
        return cached.thumbnail_url

    bgg_id = cached.bgg_id if (cached is not None and cached.bgg_id) else resolve_bgg_id(name)
    thumb = _bgg_thumbnail(bgg_id) if bgg_id else None

    # Fall back to a Wikipedia box cover (works without a BGG token).
    if not thumb:
        thumb = _wikipedia_cover(name)

    if thumb:
        defaults = {"thumbnail_url": thumb, "matched_name": name}
        if bgg_id:
            defaults["bgg_id"] = bgg_id
        BggResolution.objects.update_or_create(query_norm=norm, defaults=defaults)
    return thumb
