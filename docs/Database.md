# Database

## Overview

Relational model for users, venue tables, table reservations, and (later) game catalog, physical copies, and game reservations.

**Priority 0 entities:** User, Table, TableReservation.

## Core Entities (Priority 0)

### User

- `id`
- `email`
- `name`
- `role` (`player` | `admin`)
- `created_at`

### Table

- `id`
- `name` / `label` (e.g. "Table 3")
- `capacity` (max party size)
- `is_active`
- `created_at`
- `updated_at`

### TableReservation

- `id`
- `user_id` → User
- `table_id` → Table
- `starts_at`
- `ends_at`
- `party_size`
- `status` (`confirmed` | `cancelled` | `completed` | `overdue`; v1 create uses `confirmed`)
- `created_at`
- `updated_at`

## Later Entities (games)

### Game

- `id`
- `title`
- `description`
- `min_players`
- `max_players`
- `play_time_minutes`
- `is_active`
- `created_at`
- `updated_at`

### GameCopy

- `id`
- `game_id` → Game
- `barcode` / `label` (optional)
- `condition` (optional)
- `is_active`
- `created_at`

### Reservation (game copy)

- `id`
- `user_id` → User
- `game_copy_id` → GameCopy
- `table_reservation_id` → TableReservation (optional; link visit to games later)
- `starts_at`
- `ends_at`
- `status` (`pending` | `confirmed` | `cancelled` | `completed` | `overdue`)
- `created_at`
- `updated_at`

### VenueSettings (optional / later)

- `id`
- `default_slot_minutes` (v1 hardcoded to 120)
- `max_active_table_reservations_per_user` (v1 hardcoded to 1)
- `min_lead_time_minutes`

## Relationships

### Priority 0

- A Table has many TableReservations over time
- A User has many TableReservations
- Only one active (non-cancelled/completed) TableReservation may cover a Table for an overlapping time range
- A player may have at most one active upcoming TableReservation (v1 rule)

### Later

- A Game has many GameCopies
- A User has many game Reservations
- A GameCopy has many Reservations over time
- Only one active (non-cancelled/completed) game Reservation may cover a GameCopy for an overlapping time range

## Indexes (suggested)

### Priority 0

- `Table(is_active)`
- `TableReservation(table_id, starts_at, ends_at)`
- `TableReservation(user_id, status)`
- `TableReservation(status, starts_at)`

### Later

- `Game(title)`
- `GameCopy(game_id, is_active)`
- `Reservation(game_copy_id, starts_at, ends_at)`
- `Reservation(user_id, status)`
- `Reservation(status, ends_at)`
