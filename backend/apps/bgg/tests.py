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
    assert services._bgg_search("Catan") == 13  # first result
    assert len(calls) == 1  # single search, no exact-match pre-check
    assert "exact=1" not in calls[0]


# --- Cover images ---------------------------------------------------------

_SEARCH_XML = b'<items><item type="boardgame" id="13"><name type="primary" value="Catan"/></item></items>'
_THING_XML = (
    b'<items><item type="boardgame" id="13">'
    b"<thumbnail>//cf.geekdo-images.com/abc__thumb/img/catan.jpg</thumbnail>"
    b"</item></items>"
)


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
