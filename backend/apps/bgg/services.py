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
    results = parse_search_results(xml_bytes)
    return results[0]["bgg_id"] if results else None


def parse_search_results(xml_bytes: bytes) -> list[dict]:
    """Parse BGG search XML into [{bgg_id, name, year}, ...] (primary names only)."""
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError:
        return []
    out: list[dict] = []
    seen: set[int] = set()
    for item in root.findall("item"):
        raw_id = item.get("id")
        if not raw_id:
            continue
        try:
            bgg_id = int(raw_id)
        except (TypeError, ValueError):
            continue
        if bgg_id in seen:
            continue
        name_el = item.find("name[@type='primary']")
        if name_el is None:
            name_el = item.find("name")
        name = (name_el.get("value") if name_el is not None else None) or ""
        if not name:
            continue
        year_el = item.find("yearpublished")
        year = None
        if year_el is not None and year_el.get("value"):
            try:
                year = int(year_el.get("value"))
            except (TypeError, ValueError):
                year = None
        seen.add(bgg_id)
        out.append({"bgg_id": bgg_id, "name": name, "year": year})
    return out


def search_boardgames(query: str, *, limit: int = 20) -> list[dict]:
    """Return BGG search hits for a typed query (for admin venue-game pickers)."""
    q = query.strip()
    if not q:
        return []
    url = f"{BGG_SEARCH_API}?query={quote_plus(q)}&type=boardgame"
    body = _http_get(url, _auth_headers())
    if body is None:
        return []
    return parse_search_results(body)[: max(1, min(limit, 50))]


def fetch_thing(bgg_id: int) -> dict | None:
    """Load name + thumbnail for a BGG thing id."""
    body = _http_get(f"{BGG_THING_API}?id={bgg_id}", _auth_headers())
    if body is None:
        return None
    try:
        root = ET.fromstring(body)
    except ET.ParseError:
        return None
    item = root.find("item")
    if item is None:
        return None
    name_el = item.find("name[@type='primary']")
    if name_el is None:
        name_el = item.find("name")
    name = (name_el.get("value") if name_el is not None else None) or ""
    if not name:
        return None
    thumb = None
    thumb_el = item.find("thumbnail")
    if thumb_el is not None and thumb_el.text:
        thumb = thumb_el.text.strip()
        if thumb.startswith("//"):
            thumb = "https:" + thumb
    return {"bgg_id": bgg_id, "name": name, "thumbnail_url": thumb or ""}


def _bgg_search(name: str) -> int | None:
    """Always take the first (top-ranked) BGG search result — no exact-match preference,
    no user selection. Returns its id, or None if unreachable / no match."""
    results = search_boardgames(name, limit=1)
    return results[0]["bgg_id"] if results else None


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
    """Exact game page when resolvable, else the BGG search page.

    Also checks venue game inventory for a stored bgg_id so titles from the
    venue shelf still deep-link to the game page when the live BGG API is
    unavailable.
    """
    bgg_id = resolve_bgg_id(name)
    if bgg_id:
        return game_page_url(bgg_id)
    title = name.strip()
    if title:
        try:
            from apps.venues.models import VenueGame

            vg = (
                VenueGame.objects.filter(title__iexact=title, bgg_id__isnull=False)
                .order_by("id")
                .first()
            )
            if vg and vg.bgg_id:
                return game_page_url(vg.bgg_id)
        except Exception:
            # Venues app / table may be unavailable during early migrations.
            pass
    return search_url(name)


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
