"""Resolve a board game title to its BoardGameGeek page and cover image.

Links/covers use the BGG XML API2 search endpoint, preferring an exact title match
(ignoring a publishing year in brackets, e.g. "Calico (2020)"). Covers use the BGG
thumbnail when a token is configured (or a known venue-inventory bgg_id), otherwise
fall back to a Wikipedia box image. Successful resolutions are cached in the DB.
"""

from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from urllib.parse import quote, quote_plus

# Trailing / embedded publishing years BGG shows next to titles, e.g. "Calico (2020)".
_YEAR_IN_BRACKETS = re.compile(r"\s*\(\d{4}\)")
_LEADING_THE = re.compile(r"^the\s+", re.IGNORECASE)

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


def strip_year_brackets(name: str) -> str:
    """Remove publishing years in brackets so 'Calico (2020)' → 'Calico'."""
    return " ".join(_YEAR_IN_BRACKETS.sub("", name.strip()).split())


# Common title variants → canonical form used for matching.
_TITLE_ALIASES = {
    "island of cats": "isle of cats",
}


def normalize_for_match(name: str) -> str:
    """Normalize for fuzzy title equality: lowercase, no years, no leading 'the'."""
    cleaned = strip_year_brackets(name).lower()
    cleaned = _LEADING_THE.sub("", cleaned)
    cleaned = " ".join(cleaned.split())
    return _TITLE_ALIASES.get(cleaned, cleaned)


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


def _local_search_boardgames(query: str, *, limit: int = 20) -> list[dict]:
    """Fallback suggestions from venue inventory + resolution cache when live BGG is down.

    Used when ``BGG_API_TOKEN`` is missing or the XML API is unreachable so hosts can
    still get typeahead hits from games already known to the app.
    """
    q = normalize(strip_year_brackets(query))
    if not q:
        return []
    out: list[dict] = []
    seen: set[str] = set()

    def add(name: str, bgg_id: int | None) -> None:
        key = normalize(name)
        if not key or key in seen:
            return
        if q not in key:
            return
        seen.add(key)
        # Synthetic negative ids keep the API shape when we only know a title.
        out.append(
            {
                "bgg_id": bgg_id if bgg_id else -(abs(hash(key)) % (10**9) + 1),
                "name": name,
                "year": None,
            }
        )

    try:
        from apps.venues.models import VenueGame
    except ImportError:
        VenueGame = None  # type: ignore[misc, assignment]

    if VenueGame is not None:
        for title, bgg_id in (
            VenueGame.objects.filter(is_active=True)
            .order_by("title")
            .values_list("title", "bgg_id")
            .iterator()
        ):
            add(title, bgg_id)
            if len(out) >= limit:
                return out

    try:
        from .models import BggResolution
    except ImportError:
        BggResolution = None  # type: ignore[misc, assignment]

    if BggResolution is not None:
        for matched_name, bgg_id in (
            BggResolution.objects.exclude(matched_name="")
            .order_by("matched_name")
            .values_list("matched_name", "bgg_id")
            .iterator()
        ):
            add(matched_name, bgg_id)
            if len(out) >= limit:
                return out

    return out


def search_boardgames(query: str, *, limit: int = 20) -> list[dict]:
    """Return BGG search hits for a typed query (venue pickers + New Table typeahead)."""
    q = strip_year_brackets(query)
    if not q:
        return []
    cap = max(1, min(limit, 50))
    url = f"{BGG_SEARCH_API}?query={quote_plus(q)}&type=boardgame"
    body = _http_get(url, _auth_headers())
    if body is not None:
        hits = parse_search_results(body)[:cap]
        if hits:
            return hits
    return _local_search_boardgames(q, limit=cap)[:cap]


def pick_best_search_result(query: str, results: list[dict]) -> int | None:
    """Prefer an exact (year-ignoring) title match over BGG's raw first hit."""
    if not results:
        return None
    target = normalize_for_match(query)
    if not target:
        return results[0]["bgg_id"]

    for hit in results:
        if normalize_for_match(hit.get("name", "")) == target:
            return hit["bgg_id"]

    # Near-match: one title is a prefix of the other (handles "Isle of Cats"
    # vs "The Isle of Cats" after leading-the stripping already failed somehow).
    for hit in results:
        candidate = normalize_for_match(hit.get("name", ""))
        if candidate.startswith(target) or target.startswith(candidate):
            return hit["bgg_id"]

    return results[0]["bgg_id"]


def _venue_game_match(name: str):
    """Return a matching VenueGame (by exact/year-stripped/normalized title), or None."""
    title = name.strip()
    if not title:
        return None
    try:
        from apps.venues.models import VenueGame
    except ImportError:
        return None

    candidates = [title]
    cleaned = strip_year_brackets(title)
    if cleaned and cleaned.lower() != title.lower():
        candidates.append(cleaned)
    # Also try with/without a leading "The ".
    for base in list(candidates):
        no_the = _LEADING_THE.sub("", base).strip()
        if no_the and no_the.lower() not in {c.lower() for c in candidates}:
            candidates.append(no_the)
        with_the = f"The {no_the}" if no_the and not _LEADING_THE.match(base) else ""
        if with_the and with_the.lower() not in {c.lower() for c in candidates}:
            candidates.append(with_the)

    matches: list = []
    for candidate in candidates:
        matches.extend(list(VenueGame.objects.filter(title__iexact=candidate)))

    if not matches:
        target = normalize_for_match(title)
        if target:
            for vg in VenueGame.objects.only("id", "title", "bgg_id", "thumbnail_url").iterator():
                if normalize_for_match(vg.title) == target:
                    matches.append(vg)

    if not matches:
        return None

    # Prefer a row that already has cover art, then one with a bgg_id.
    matches.sort(key=lambda g: (not bool(g.thumbnail_url), g.bgg_id is None, g.id))
    return matches[0]


def _venue_game_bgg_id(name: str) -> int | None:
    """Look up a stored VenueGame.bgg_id for this title (exact, then year-stripped)."""
    vg = _venue_game_match(name)
    return vg.bgg_id if vg and vg.bgg_id else None


def fetch_thing(bgg_id: int) -> dict | None:
    """Load name, thumbnail, and playtime for a BGG thing id."""
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

    def _int_attr(tag: str) -> int | None:
        el = item.find(tag)
        if el is None or not el.get("value"):
            return None
        try:
            return int(el.get("value"))
        except (TypeError, ValueError):
            return None

    playing_time = _int_attr("playingtime")
    min_play_time = _int_attr("minplaytime")
    max_play_time = _int_attr("maxplaytime")
    return {
        "bgg_id": bgg_id,
        "name": name,
        "thumbnail_url": thumb or "",
        "playing_time": playing_time,
        "min_play_time": min_play_time,
        "max_play_time": max_play_time,
    }


def _bgg_search(name: str) -> int | None:
    """Search BGG and pick the best title match (exact preferred over first hit)."""
    # Fetch a handful so we can prefer an exact name match over a wrong top hit
    # (e.g. "Spicy" must not resolve to an unrelated first result).
    results = search_boardgames(name, limit=10)
    return pick_best_search_result(name, results)


def resolve_bgg_id(name: str) -> int | None:
    """Resolve (and cache) a game title to a BGG id, or None."""
    from .models import BggResolution

    norm = normalize(name)
    if not norm:
        return None
    cached = BggResolution.objects.filter(query_norm=norm).first()
    if cached is not None and cached.bgg_id:
        return cached.bgg_id

    # Prefer a curated venue-inventory id (works even without a BGG API token).
    bgg_id = _venue_game_bgg_id(name)
    if bgg_id is None:
        bgg_id = _bgg_search(name)
    if bgg_id is not None:
        BggResolution.objects.update_or_create(
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
    return search_url(strip_year_brackets(name) or name)


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
    Years in brackets are ignored when matching ("Calico (2020)" → Calico).
    """
    from .models import BggResolution

    norm = normalize(name)
    if not norm:
        return None

    cached = BggResolution.objects.filter(query_norm=norm).first()
    if cached is not None and cached.thumbnail_url and cached.bgg_id:
        return cached.thumbnail_url

    # Curated venue inventory often already has the right cover (and bgg_id).
    venue_game = _venue_game_match(name)
    if venue_game and venue_game.thumbnail_url:
        defaults = {
            "thumbnail_url": venue_game.thumbnail_url,
            "matched_name": name,
        }
        if venue_game.bgg_id:
            defaults["bgg_id"] = venue_game.bgg_id
        BggResolution.objects.update_or_create(query_norm=norm, defaults=defaults)
        return venue_game.thumbnail_url

    bgg_id = (
        (venue_game.bgg_id if venue_game and venue_game.bgg_id else None)
        or (cached.bgg_id if (cached is not None and cached.bgg_id) else None)
        or resolve_bgg_id(name)
    )
    thumb = _bgg_thumbnail(bgg_id) if bgg_id else None

    # Fall back to a Wikipedia box cover (works without a BGG token).
    # Search without the year suffix so Wikipedia lands on the game article.
    if not thumb:
        thumb = _wikipedia_cover(strip_year_brackets(name) or name)

    if thumb:
        defaults = {"thumbnail_url": thumb, "matched_name": name}
        if bgg_id:
            defaults["bgg_id"] = bgg_id
        BggResolution.objects.update_or_create(query_norm=norm, defaults=defaults)
    return thumb
