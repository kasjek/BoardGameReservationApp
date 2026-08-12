import pytest
from rest_framework.test import APIClient

from apps.bgg import services
from apps.bgg.models import BggResolution


@pytest.fixture
def client():
    return APIClient()


def test_redirect_to_exact_game_page(db, client, monkeypatch):
    monkeypatch.setattr(services, "_bgg_search", lambda name: 13)
    resp = client.get("/api/bgg/redirect?q=Catan")
    assert resp.status_code == 302
    assert resp["Location"] == "https://boardgamegeek.com/boardgame/13"


def test_redirect_falls_back_to_search_when_unresolved(db, client, monkeypatch):
    monkeypatch.setattr(services, "_bgg_search", lambda name: None)
    resp = client.get("/api/bgg/redirect?q=Some Obscure Game")
    assert resp.status_code == 302
    assert "geeksearch.php" in resp["Location"]
    assert "Some+Obscure+Game" in resp["Location"]


def test_missing_query_is_400(db, client):
    assert client.get("/api/bgg/redirect").status_code == 400


def test_resolution_is_cached(db, monkeypatch):
    calls = {"n": 0}

    def fake(name):
        calls["n"] += 1
        return 174430  # Gloomhaven

    monkeypatch.setattr(services, "_bgg_search", fake)
    assert services.resolve_bgg_id("Gloomhaven") == 174430
    assert services.resolve_bgg_id("gloomhaven") == 174430  # normalized cache hit
    assert calls["n"] == 1
    assert BggResolution.objects.filter(bgg_id=174430).count() == 1


def test_first_id_parses_bgg_xml():
    xml = b'<items total="1"><item type="boardgame" id="13"><name type="primary" value="Catan"/></item></items>'
    assert services._first_id(xml) == 13


def test_first_id_handles_non_xml():
    assert services._first_id(b"Unauthorized. See ...") is None


def test_bgg_search_takes_first_result_single_query(monkeypatch):
    calls = []

    def fake(url, headers=None):
        calls.append(url)
        return _SEARCH_XML

    monkeypatch.setattr(services, "_http_get", fake)
    assert services._bgg_search("Catan") == 13  # first / exact result
    assert len(calls) == 1  # single search, no exact-match pre-check
    assert "exact=1" not in calls[0]


def test_strip_year_brackets():
    assert services.strip_year_brackets("Calico (2020)") == "Calico"
    assert services.strip_year_brackets("Nekojima (2024)") == "Nekojima"
    assert services.strip_year_brackets("Spicy") == "Spicy"


def test_normalize_for_match_ignores_year_and_leading_the():
    assert services.normalize_for_match("Calico (2020)") == "calico"
    assert services.normalize_for_match("The Isle of Cats") == "isle of cats"
    assert services.normalize_for_match("Isle of Cats") == "isle of cats"


def test_pick_best_search_result_prefers_exact_title():
    results = [
        {"bgg_id": 1, "name": "Spicy Memories", "year": 2010},
        {"bgg_id": 299169, "name": "Spicy", "year": 2020},
        {"bgg_id": 2, "name": "Spicy Tacos", "year": 2021},
    ]
    assert services.pick_best_search_result("Spicy", results) == 299169
    assert services.pick_best_search_result("Calico (2020)", [
        {"bgg_id": 99, "name": "Calico Cats", "year": 1999},
        {"bgg_id": 283155, "name": "Calico", "year": 2020},
    ]) == 283155
    assert services.pick_best_search_result("The Isle of Cats", [
        {"bgg_id": 281259, "name": "The Isle of Cats", "year": 2019},
    ]) == 281259


def test_bgg_search_strips_year_from_query(monkeypatch):
    calls = []

    def fake(url, headers=None):
        calls.append(url)
        return (
            b'<items total="1">'
            b'<item type="boardgame" id="283155">'
            b'<name type="primary" value="Calico"/>'
            b'<yearpublished value="2020"/>'
            b"</item></items>"
        )

    monkeypatch.setattr(services, "_http_get", fake)
    assert services._bgg_search("Calico (2020)") == 283155
    assert "Calico+%282020%29" not in calls[0]
    assert "query=Calico" in calls[0]


def test_resolve_uses_venue_game_bgg_id(db, monkeypatch):
    from apps.venues.models import Venue, VenueGame

    venue = Venue.objects.create(name="Cafe")
    VenueGame.objects.create(venue=venue, title="Calico", bgg_id=283155)
    monkeypatch.setattr(services, "_bgg_search", lambda name: pytest.fail("should use venue id"))
    assert services.resolve_bgg_id("Calico (2020)") == 283155


def test_cover_uses_venue_game_thumbnail(db, monkeypatch):
    from apps.venues.models import Venue, VenueGame

    venue = Venue.objects.create(name="Cafe")
    VenueGame.objects.create(
        venue=venue,
        title="Spicy",
        bgg_id=299169,
        thumbnail_url="https://cf.geekdo-images.com/spicy.jpg",
    )
    monkeypatch.setattr(services, "_http_get", lambda url, headers=None: pytest.fail("no http"))
    assert services.resolve_cover_url("Spicy") == "https://cf.geekdo-images.com/spicy.jpg"


def test_search_boardgames_returns_multiple_hits(monkeypatch):
    xml = (
        b'<items total="2">'
        b'<item type="boardgame" id="13">'
        b'<name type="primary" value="Catan"/>'
        b'<yearpublished value="1995"/>'
        b"</item>"
        b'<item type="boardgame" id="9209">'
        b'<name type="primary" value="Ticket to Ride"/>'
        b'<yearpublished value="2004"/>'
        b"</item>"
        b"</items>"
    )
    monkeypatch.setattr(services, "_http_get", lambda url, headers=None: xml)
    hits = services.search_boardgames("cat", limit=10)
    assert [h["bgg_id"] for h in hits] == [13, 9209]
    assert hits[0]["name"] == "Catan"
    assert hits[0]["year"] == 1995


def test_search_boardgames_falls_back_to_venue_inventory(db, monkeypatch):
    from apps.venues.models import Venue, VenueGame

    monkeypatch.setattr(services, "_http_get", lambda url, headers=None: None)
    venue = Venue.objects.create(name="Cafe", location="Here")
    VenueGame.objects.create(venue=venue, title="Patchwork", bgg_id=163412, is_active=True)
    VenueGame.objects.create(venue=venue, title="Love Letter", bgg_id=129622, is_active=True)
    hits = services.search_boardgames("pat", limit=10)
    assert hits[0]["name"] == "Patchwork"
    assert hits[0]["bgg_id"] == 163412


def test_bgg_search_api_requires_auth(db, client, monkeypatch):
    monkeypatch.setattr(
        services,
        "search_boardgames",
        lambda q, limit=20: [{"bgg_id": 13, "name": "Catan", "year": 1995}],
    )
    assert client.get("/api/bgg/search?q=Catan").status_code in (401, 403)
    from apps.accounts.models import Role, User

    user = User.objects.create_user(username="searcher", password="pw-testing-123", role=Role.USER)
    client.force_authenticate(user=user)
    resp = client.get("/api/bgg/search?q=Catan")
    assert resp.status_code == 200
    assert resp.data["results"][0]["name"] == "Catan"


def test_list_directory_boardgames_uniques_by_bgg_id(db):
    from apps.bgg.models import BggResolution
    from apps.venues.models import Venue, VenueGame

    venue = Venue.objects.create(name="Cafe", location="Here")
    VenueGame.objects.create(venue=venue, title="Patchwork", bgg_id=163412, is_active=True)
    VenueGame.objects.create(venue=venue, title="Love Letter", bgg_id=129622, is_active=True)
    BggResolution.objects.create(
        query_norm="patchwork",
        bgg_id=163412,
        matched_name="Patchwork",
    )
    BggResolution.objects.create(
        query_norm="catan",
        bgg_id=13,
        matched_name="Catan",
    )
    hits = services.list_directory_boardgames()
    by_id = {h["bgg_id"]: h["name"] for h in hits}
    assert by_id[163412] == "Patchwork"
    assert by_id[129622] == "Love Letter"
    assert by_id[13] == "Catan"
    assert [h["name"] for h in hits] == sorted(by_id.values(), key=services.normalize)


def test_bgg_directory_api_requires_auth(db, client):
    from apps.accounts.models import Role, User
    from apps.venues.models import Venue, VenueGame

    venue = Venue.objects.create(name="Cafe", location="Here")
    VenueGame.objects.create(venue=venue, title="Catan", bgg_id=13, is_active=True)
    assert client.get("/api/bgg/directory").status_code in (401, 403)
    user = User.objects.create_user(username="diruser", password="pw-testing-123", role=Role.USER)
    client.force_authenticate(user=user)
    resp = client.get("/api/bgg/directory")
    assert resp.status_code == 200
    by_id = {row["bgg_id"]: row["name"] for row in resp.data["results"]}
    assert by_id[13] == "Catan"


# --- Cover images ---------------------------------------------------------

_SEARCH_XML = b'<items><item type="boardgame" id="13"><name type="primary" value="Catan"/></item></items>'
_THING_XML = (
    b'<items><item type="boardgame" id="13">'
    b'<name type="primary" value="Catan"/>'
    b"<thumbnail>//cf.geekdo-images.com/abc__thumb/img/catan.jpg</thumbnail>"
    b'<playingtime value="90"/>'
    b'<minplaytime value="60"/>'
    b'<maxplaytime value="120"/>'
    b"</item></items>"
)


def test_fetch_thing_includes_playtime(monkeypatch):
    monkeypatch.setattr(services, "_http_get", lambda url, headers=None: _THING_XML)
    thing = services.fetch_thing(13)
    assert thing["name"] == "Catan"
    assert thing["playing_time"] == 90
    assert thing["min_play_time"] == 60
    assert thing["max_play_time"] == 120


def test_bgg_thing_api_requires_auth(db, client, monkeypatch):
    monkeypatch.setattr(
        services,
        "fetch_thing",
        lambda bgg_id: {
            "bgg_id": bgg_id,
            "name": "Catan",
            "thumbnail_url": "",
            "playing_time": 90,
            "min_play_time": 60,
            "max_play_time": 120,
        },
    )
    assert client.get("/api/bgg/thing?id=13").status_code in (401, 403)
    from apps.accounts.models import Role, User

    user = User.objects.create_user(username="thinger", password="pw-testing-123", role=Role.USER)
    client.force_authenticate(user=user)
    resp = client.get("/api/bgg/thing?id=13")
    assert resp.status_code == 200
    assert resp.data["playing_time"] == 90


def _fake_http(monkeypatch):
    def fake(url, headers=None):
        if "xmlapi2/search" in url:
            return _SEARCH_XML
        if "thing" in url:
            return _THING_XML
        return None

    monkeypatch.setattr(services, "_http_get", fake)


def test_cover_redirects_to_thumbnail(db, client, monkeypatch):
    _fake_http(monkeypatch)
    resp = client.get("/api/bgg/cover?q=Catan")
    assert resp.status_code == 302
    assert resp["Location"] == "https://cf.geekdo-images.com/abc__thumb/img/catan.jpg"


def test_cover_falls_back_to_wikipedia_without_bgg(db, client, monkeypatch):
    wiki_search = b'{"query":{"search":[{"title":"Wingspan (board game)"}]}}'
    wiki_summary = b'{"thumbnail":{"source":"https://upload.wikimedia.org/x/wingspan.jpg"}}'

    def fake(url, headers=None):
        if "boardgamegeek.com" in url:
            return None  # BGG blocked (no token)
        if "list=search" in url:
            return wiki_search
        if "page/summary" in url:
            return wiki_summary
        return None

    monkeypatch.setattr(services, "_http_get", fake)
    resp = client.get("/api/bgg/cover?q=Wingspan")
    assert resp.status_code == 302
    assert resp["Location"] == "https://upload.wikimedia.org/x/wingspan.jpg"


def test_cover_404_when_unresolved(db, client, monkeypatch):
    monkeypatch.setattr(services, "_http_get", lambda url, headers=None: None)
    assert client.get("/api/bgg/cover?q=Nope").status_code == 404


def test_cover_is_cached(db, monkeypatch):
    _fake_http(monkeypatch)
    assert services.resolve_cover_url("Catan").endswith("catan.jpg")
    # Second call should read from the cached thumbnail_url (no HTTP needed).
    monkeypatch.setattr(services, "_http_get", lambda url, headers=None: pytest.fail("cached"))
    assert services.resolve_cover_url("catan").endswith("catan.jpg")


def test_auth_header_added_with_token(monkeypatch):
    monkeypatch.setenv("BGG_API_TOKEN", "test-token-123")
    assert services._auth_headers()["Authorization"] == "Bearer test-token-123"


def test_no_auth_header_without_token(monkeypatch):
    monkeypatch.delenv("BGG_API_TOKEN", raising=False)
    assert "Authorization" not in services._auth_headers()
