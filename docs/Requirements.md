# Requirements

## Overview

BoardGameReservationApp lets players reserve a table at a venue, then discover and reserve board games. Venues manage seating, inventory, and bookings.

**Development priority:** table reservation for a standard player (Priority 0) is the first slice to implement. Game catalog and admin features follow.

## Priority 0 — Table reservation (standard player)

First slice to develop. Authenticated **player** only. Single venue. No admin UI required (seed tables in setup).

### Functional Requirements

- **FR-T1 — See available tables for a time**  
  Player picks a date/time (start + duration, default duration 120 minutes) and sees which tables are free for that slot.

- **FR-T2 — Create a table reservation**  
  Player reserves one free table for a slot (`starts_at`, `ends_at`, `party_size` ≤ table capacity).  
  On success, status is `confirmed`.

- **FR-T3 — View my table reservations**  
  Player sees upcoming/active table reservations with table, time, party size, and status.

- **FR-T4 — Cancel my table reservation**  
  Player can cancel an upcoming reservation; the table becomes free immediately.

- **FR-T5 — Prevent table conflicts**  
  System rejects overlapping bookings for the same table (`409`). Availability shown before book must match what create allows.

### Fixed v1 rules (see ADR-006)

- Default slot length: 120 minutes
- Party size required; must be ≤ table capacity
- At most one active upcoming table reservation per player
- Login required; only the owner can view/cancel their reservation

### Out of scope for Priority 0

- Game catalog, copy assignment, filters
- Admin inventory / reservation desk UI
- Waitlists, payments, notifications
- Modify reservation (cancel + rebook instead)
- Reservation history beyond upcoming/active
- Configurable rules UI

## Later — Games and venue operations

### Players

- Browse the catalog of available board games
- Filter and search by name, player count, duration, and availability
- View game details (description, player count, estimated play time, copies available)
- Reserve a game for a specific time slot
- Cancel or modify an upcoming game reservation
- View personal reservation history and upcoming bookings

### Venue / Organizer Admins

- Manage tables (add, edit, capacity, activate/deactivate)
- Manage game inventory (add, edit, remove games and copies)
- Define reservation time slots and rules (duration, lead time, limits)
- View and manage reservations (confirm, cancel, mark returned)
- See availability and occupancy at a glance

### System

- Prevent double-booking of the same table
- Prevent double-booking of the same physical game copy
- Keep availability accurate when reservations are created, changed, or cancelled
- Notify users of reservation confirmations and changes (when notifications are enabled)

## Non-Functional Requirements

- Mobile-friendly experience for players
- Clear reservation status at every step
- Consistent availability between browse and booking flows
- Secure access for personal and admin actions
- Reasonable response times for availability and reservation operations
