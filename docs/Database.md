# Database

## Overview

Relational model for users, game catalog, physical copies, and reservations.

## Core Entities

### User

- `id`
- `email`
- `name`
- `role` (`player` | `admin`)
- `created_at`

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

### Reservation

- `id`
- `user_id` → User
- `game_copy_id` → GameCopy
- `starts_at`
- `ends_at`
- `status` (`pending` | `confirmed` | `cancelled` | `completed` | `overdue`)
- `created_at`
- `updated_at`

### VenueSettings (optional / later)

- `id`
- `default_slot_minutes`
- `max_active_reservations_per_user`
- `min_lead_time_minutes`

## Relationships

- A Game has many GameCopies
- A User has many Reservations
- A GameCopy has many Reservations over time
- Only one active (non-cancelled/completed) Reservation may cover a GameCopy for an overlapping time range

## Indexes (suggested)

- `Game(title)`
- `GameCopy(game_id, is_active)`
- `Reservation(game_copy_id, starts_at, ends_at)`
- `Reservation(user_id, status)`
- `Reservation(status, ends_at)`
