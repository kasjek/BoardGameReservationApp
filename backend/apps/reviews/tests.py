import pytest
from rest_framework.test import APIClient

from apps.accounts.models import Role, User
from apps.reviews.models import average_rating_for_user, average_rating_for_venue
from apps.venues.models import Venue


def mk(username, role=Role.USER):
    return User.objects.create_user(username=username, password="pw-testing-123", role=role)


@pytest.fixture
def client():
    return APIClient()


def test_create_venue_review_and_aggregate(db, client):
    venue = Venue.objects.create(name="Board & Brew")
    a = mk("alice")
    b = mk("bob")
    client.force_authenticate(user=a)
    r1 = client.post(
        "/api/reviews",
        {"target_type": "venue", "target_venue": venue.id, "rating": 5, "body": "Great!"},
        format="json",
    )
    assert r1.status_code == 201
    client.force_authenticate(user=b)
    r2 = client.post(
        "/api/reviews",
        {"target_type": "venue", "target_venue": venue.id, "rating": 3, "body": "Ok"},
        format="json",
    )
    assert r2.status_code == 201
    assert average_rating_for_venue(venue.id) == 4.0

    listing = client.get(f"/api/venues/{venue.id}/reviews")
    assert listing.status_code == 200
    assert len(listing.data) == 2

    venue_detail = client.get(f"/api/venues/{venue.id}")
    assert venue_detail.data["rating_avg"] == 4.0


def test_create_user_review_and_public_profile(db, client):
    alice = mk("alice")
    bob = mk("bob")
    client.force_authenticate(user=alice)
    resp = client.post(
        "/api/reviews",
        {"target_type": "user", "target_user": bob.id, "rating": 4, "body": "Fun to play with"},
        format="json",
    )
    assert resp.status_code == 201
    assert average_rating_for_user(bob.id) == 4.0

    public = client.get(f"/api/users/{bob.id}")
    assert public.status_code == 200
    assert public.data["rating_avg"] == 4.0
    # Privacy: public profile does not leak email or role.
    assert "email" not in public.data
    assert "role" not in public.data


def test_review_requires_auth(db, client):
    venue = Venue.objects.create(name="Board & Brew")
    resp = client.post(
        "/api/reviews",
        {"target_type": "venue", "target_venue": venue.id, "rating": 5},
        format="json",
    )
    assert resp.status_code in (401, 403)


def test_invalid_rating_rejected(db, client):
    venue = Venue.objects.create(name="Board & Brew")
    a = mk("alice")
    client.force_authenticate(user=a)
    resp = client.post(
        "/api/reviews",
        {"target_type": "venue", "target_venue": venue.id, "rating": 9},
        format="json",
    )
    assert resp.status_code == 400
