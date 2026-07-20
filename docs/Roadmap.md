# Roadmap

## Phase 1 — Table reservation (Priority 0)

First development focus.

- Project setup (backend + player client shell)
- Core data model for users, tables, and table reservations
- Seed tables for a single venue (no admin UI yet)
- Player auth (login required)
- Player can see table availability for a time slot
- Player can create, view, and cancel own table reservations
- Prevent double-booking of tables
- Confirmed status on create; clear status in the player view

## Phase 2 — Foundation for games

- Core data model for games and copies
- Admin can manage game inventory
- Players can browse the catalog

## Phase 3 — Game reservations

- Availability calculation by time slot for game copies
- Create, view, and cancel game reservations
- Prevent double-booking of copies
- Basic reservation status in player and admin views
- Optional link between a visit (table reservation) and game bookings

## Phase 4 — Operations

- Admin table management
- Reservation rules (slot length, lead time, limits)
- Admin reservation management (confirm, cancel, mark returned)
- Search and filtering for the catalog
- Notifications for confirmation and cancellation

## Phase 5 — Polish

- Reservation history for players
- Better availability UX (clear free/busy states)
- Performance and reliability hardening
- Analytics for popular games and occupancy (optional)
