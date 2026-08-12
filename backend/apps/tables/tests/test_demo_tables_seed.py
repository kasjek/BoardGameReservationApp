import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command

from apps.accounts.models import Role
from apps.tables.models import Table
from apps.tables.seed import (
    DATE_HOUSE_DEMO_TABLES,
    HOTEL_KNORZ_DEMO_TABLES,
    KATZENTEMPEL_DEMO_TABLES,
    ensure_demo_tables,
)
from apps.venues.models import Venue
from apps.venues.seed import ensure_date_house_cafe, ensure_hotel_knorz, ensure_katzentempel

User = get_user_model()


@pytest.mark.django_db
def test_ensure_demo_tables_seeds_both_venues_without_touching_passwords():
    ensure_date_house_cafe()
    ensure_katzentempel()
    ensure_hotel_knorz()

    # Migrations / earlier seeds may already have created demo hosts — never
    # assume a blank user table. Set a known password, then assert seed leaves it.
    host, _ = User.objects.get_or_create(
        username="alice",
        defaults={"role": Role.USER, "email": "alice@example.com"},
    )
    host.set_password("OriginalPass1!")
    host.save(update_fields=["password"])
    original_hash = host.password
    original_username = host.username

    by_venue = ensure_demo_tables()
    assert len(by_venue["Date House Cafe"]) >= len(DATE_HOUSE_DEMO_TABLES)
    assert len(by_venue["Katzentempel"]) >= len(KATZENTEMPEL_DEMO_TABLES)
    assert len(by_venue["Hotel Knorz"]) >= len(HOTEL_KNORZ_DEMO_TABLES)

    date_house = Venue.objects.get(name="Date House Cafe")
    katzentempel = Venue.objects.get(name="Katzentempel")
    hotel_knorz = Venue.objects.get(name="Hotel Knorz")
    assert not Venue.objects.filter(name="Katzentempel Nürnberg").exists()

    assert Table.objects.filter(venue=date_house).count() >= len(DATE_HOUSE_DEMO_TABLES)
    assert Table.objects.filter(venue=katzentempel).count() >= len(KATZENTEMPEL_DEMO_TABLES)
    assert Table.objects.filter(venue=hotel_knorz).count() >= len(HOTEL_KNORZ_DEMO_TABLES)

    host.refresh_from_db()
    assert host.password == original_hash
    assert host.check_password("OriginalPass1!")
    assert host.username == original_username


@pytest.mark.django_db
def test_seed_demo_tables_command():
    ensure_date_house_cafe()
    ensure_katzentempel()
    ensure_hotel_knorz()
    call_command("seed_demo_tables")
    assert Table.objects.filter(venue__name="Date House Cafe").count() >= len(
        DATE_HOUSE_DEMO_TABLES
    )
    assert Table.objects.filter(venue__name="Katzentempel").count() >= len(
        KATZENTEMPEL_DEMO_TABLES
    )
    assert Table.objects.filter(venue__name="Hotel Knorz").count() >= len(
        HOTEL_KNORZ_DEMO_TABLES
    )


@pytest.mark.django_db
def test_katzentempel_name_has_no_nurnberg():
    ensure_katzentempel()
    assert Venue.objects.filter(name="Katzentempel").exists()
    assert not Venue.objects.filter(name__icontains="Nürnberg").filter(
        name__icontains="Katzentempel"
    ).exclude(name="Katzentempel").exists()
    assert Venue.objects.get(name="Katzentempel").name == "Katzentempel"
