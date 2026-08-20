from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import Role, User
from apps.reviews.models import average_rating_for_user, average_rating_for_venue
from apps.tables.models import SeatReservation, SeatStatus, Table, TableStatus
from apps.venues.models import Venue


def mk(username, role=Role.USER):
    return User.objects.create_user(username=username, password="pw-testing-123", role=role)


def seat(table, user):
    return SeatReservation.objects.create(table=table, user=user, status=SeatStatus.RESERVED)


def make_table(organizer, venue, *, ended=True, status=TableStatus.CONFIRMED_PAID):
    now = timezone.now()
    if ended:
        starts, ends = now - timedelta(hours=3), now - timedelta(hours=1)
    else:
        starts, ends = now + timedelta(days=2), now + timedelta(days=2, hours=2)
    return Table.objects.create(
        organizer=organizer,
        venue=venue,
        game_title="Catan",
        starts_at=starts,
        ends_at=ends,
        min_players=2,
        max_players=4,
        status=status,
        seats_taken=1,
    )


@pytest.fixture
def client():
    return APIClient()


def test_create_venue_review_and_aggregate(db, client):
    venue = Venue.objects.create(name="Board & Brew")
    a, b = mk("alice"), mk("bob")
    ta = make_table(a, venue)
    tb = make_table(b, venue)
    client.force_authenticate(user=a)
    assert (
        client.post(
            "/api/reviews",
            {"target_type": "venue", "table": ta.id, "rating": 5, "body": "Great!"},
            format="json",
        ).status_code
        == 201
    )
    client.force_authenticate(user=b)
    assert (
        client.post(
            "/api/reviews",
            {"target_type": "venue", "table": tb.id, "rating": 3},
            format="json",
        ).status_code
        == 201
    )
    assert average_rating_for_venue(venue.id) == 4.0

    detail = client.get(f"/api/venues/{venue.id}")
    assert detail.data["rating_avg"] == 4.0


def test_create_user_review(db, client):
    venue = Venue.objects.create(name="Board & Brew")
    alice, bob = mk("alice"), mk("bob")
    t = make_table(alice, venue)  # alice is organizer (participated)
    seat(t, bob)  # bob attended
    client.force_authenticate(user=alice)
    resp = client.post(
        "/api/reviews",
        {"target_type": "user", "target_user": bob.id, "table": t.id, "rating": 4},
        format="json",
    )
    assert resp.status_code == 201
    assert average_rating_for_user(bob.id) == 4.0

    listed = client.get(f"/api/users/{bob.id}/reviews")
    assert listed.status_code == 200
    assert listed.data[0]["rating"] == 4
    assert listed.data[0]["author_name"] == "alice"

    table_reviews = client.get(f"/api/tables/{t.id}/reviews")
    assert table_reviews.status_code == 200
    assert len(table_reviews.data) == 1


def test_review_requires_participation(db, client):
    venue = Venue.objects.create(name="Board & Brew")
    alice, outsider = mk("alice"), mk("outsider")
    t = make_table(alice, venue)  # outsider has no seat here
    client.force_authenticate(user=outsider)
    resp = client.post(
        "/api/reviews", {"target_type": "venue", "table": t.id, "rating": 1}, format="json"
    )
    assert resp.status_code == 400


def test_cannot_review_non_participant_user(db, client):
    venue = Venue.objects.create(name="Board & Brew")
    alice, stranger = mk("alice"), mk("stranger")
    t = make_table(alice, venue)  # stranger never attended
    client.force_authenticate(user=alice)
    resp = client.post(
        "/api/reviews",
        {"target_type": "user", "target_user": stranger.id, "table": t.id, "rating": 1},
        format="json",
    )
    assert resp.status_code == 400


def test_no_self_review(db, client):
    venue = Venue.objects.create(name="Board & Brew")
    alice = mk("alice")
    t = make_table(alice, venue)
    client.force_authenticate(user=alice)
    resp = client.post(
        "/api/reviews",
        {"target_type": "user", "target_user": alice.id, "table": t.id, "rating": 5},
        format="json",
    )
    assert resp.status_code == 400


def test_no_duplicate_review(db, client):
    venue = Venue.objects.create(name="Board & Brew")
    alice = mk("alice")
    t = make_table(alice, venue)
    client.force_authenticate(user=alice)
    payload = {"target_type": "venue", "table": t.id, "rating": 5}
    assert client.post("/api/reviews", payload, format="json").status_code == 201
    assert client.post("/api/reviews", payload, format="json").status_code == 400


def test_review_before_event_ends_rejected(db, client):
    venue = Venue.objects.create(name="Board & Brew")
    a = mk("alice")
    future = make_table(a, venue, ended=False)
    client.force_authenticate(user=a)
    resp = client.post(
        "/api/reviews",
        {"target_type": "venue", "table": future.id, "rating": 5},
        format="json",
    )
    assert resp.status_code == 400


def test_review_cancelled_event_rejected(db, client):
    venue = Venue.objects.create(name="Board & Brew")
    a = mk("alice")
    cancelled = make_table(a, venue, ended=True, status=TableStatus.CANCELLED)
    client.force_authenticate(user=a)
    resp = client.post(
        "/api/reviews",
        {"target_type": "venue", "table": cancelled.id, "rating": 5},
        format="json",
    )
    assert resp.status_code == 400


def test_review_requires_table(db, client):
    Venue.objects.create(name="Board & Brew")
    a = mk("alice")
    client.force_authenticate(user=a)
    resp = client.post("/api/reviews", {"target_type": "venue", "rating": 5}, format="json")
    assert resp.status_code == 400


def test_review_requires_auth(db, client):
    venue = Venue.objects.create(name="Board & Brew")
    a = mk("alice")
    t = make_table(a, venue)
    resp = client.post(
        "/api/reviews",
        {"target_type": "venue", "table": t.id, "rating": 5},
        format="json",
    )
    assert resp.status_code in (401, 403)


def test_invalid_rating_rejected(db, client):
    venue = Venue.objects.create(name="Board & Brew")
    a = mk("alice")
    t = make_table(a, venue)
    client.force_authenticate(user=a)
    resp = client.post(
        "/api/reviews",
        {"target_type": "venue", "table": t.id, "rating": 9},
        format="json",
    )
    assert resp.status_code == 400
