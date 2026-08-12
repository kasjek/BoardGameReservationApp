"""Demo VENUE_USER managers for seeded venues.

Passwords are set ONLY when a manager account is first created — existing
usernames/passwords are never overwritten.
"""

from __future__ import annotations

from django.contrib.auth import get_user_model

from apps.accounts.models import Role
from apps.venues.seed import ensure_hotel_knorz, ensure_katzentempel

User = get_user_model()

# (username, password, email, venue_factory)
# Password applies only on create. Role/venue are kept in sync for existing users
# without touching their password.
DEMO_VENUE_MANAGERS = (
    ("katzen", "VenuePass1!", "katzen@katzentempel.example", ensure_katzentempel),
    ("knorz", "VenuePass1!", "knorz@hotelknorz.example", ensure_hotel_knorz),
)


def ensure_venue_managers() -> list:
    """Create (or link) VENUE_USER managers for Katzentempel and Hotel Knorz."""
    managers = []
    for username, password, email, ensure_venue in DEMO_VENUE_MANAGERS:
        venue = ensure_venue()
        user, created = User.objects.get_or_create(
            username=username,
            defaults={
                "email": email,
                "role": Role.VENUE_USER,
                "venue": venue,
            },
        )
        if created:
            user.set_password(password)
            user.save(update_fields=["password"])
        else:
            # Keep role/venue linked for demos; never reset the password.
            dirty = []
            if user.role != Role.VENUE_USER:
                user.role = Role.VENUE_USER
                dirty.append("role")
            if user.venue_id != venue.id:
                user.venue = venue
                dirty.append("venue")
            if dirty:
                user.save(update_fields=dirty)
        managers.append(user)
    return managers
