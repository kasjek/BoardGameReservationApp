# Database

## Overview

Relational model for a social table-booking product: **users** create **tables** (board game events) at **venues**, other users **reserve seats**, **venue admins** confirm and manage capacity, and the platform supports payments, reviews, friends, chat, and moderation.

This model reflects `docs/UserStories.md` and `docs/Requirements.md`. It supersedes the earlier game-copy "library" model (see `ADR-001` in `docs/Decisions.md`).

## Core Entities

### User

- `id`
- `email`
- `display_name`
- `avatar_id` (from a system-allocated set)
- `role` (`USER` | `VENUE_USER` | `ADMIN`)
- `venue_id` → Venue (nullable; set for `VENUE_USER`)
- `allow_invites` (bool; user can disable table invites) *(story 17)*
- `rating_avg` (derived from received reviews)
- `cancellations_count` (derived; visible to others) *(story 23)*
- `is_super_user` (bool) *(story 54)*
- `is_blocked` (bool; platform-level block) *(story 53)*
- `created_at`

### Venue

- `id`
- `name`
- `description`
- `address` / `location`
- `rating_avg` (derived)
- `is_super_location` (bool) *(story 54)*
- `is_blocked` (bool) *(story 53)*
- `created_at`
- `updated_at`

### VenuePhoto

- `id`
- `venue_id` → Venue
- `url`
- `created_at`

### VenueAvailability

Defines when and how many tables a venue offers. *(story 34)*

- `id`
- `venue_id` → Venue
- `day` / `date`
- `start_time`
- `end_time`
- `tables_available` (int)

### VenueRule

- `id`
- `venue_id` → Venue
- `max_reservation_minutes` (optional)
- `food_drink_required` (bool)
- `min_spend_per_person` (optional)
- `notes`

### Game

Global catalog entry (title, description, image). *(story 6)*

- `id`
- `title`
- `description`
- `image_url`
- `min_players`
- `max_players`
- `created_at`

### VenueGameInventory

Games physically available at a venue. *(stories 29, 38, 44)*

- `id`
- `venue_id` → Venue
- `game_id` → Game
- `copies` (int)
- `condition` (`new` | `like_new` | `good`)
- `language`
- `is_active`

### Table (Event)

The core booking unit — a hosted board game event. *(stories 1, 4, 33)*

- `id`
- `organizer_id` → User
- `venue_id` → Venue
- `game_id` → Game (nullable if bring-your-own)
- `bring_own_game` (bool)
- `starts_at`
- `duration_minutes`
- `min_players`
- `max_players`
- `language` (`en` | `de` | `other`)
- `language_other` (free text when `language = other`)
- `status` (`waiting_for_venue_confirmation` | `waiting_for_players` | `confirmed` | `cancelled` | `completed`)
- `created_at`
- `updated_at`

### SeatReservation

One user's seat at a table (organizer gets one by default). *(stories 2, 4, 21)*

- `id`
- `table_id` → Table
- `user_id` → User
- `is_organizer` (bool)
- `status` (`reserved` | `cancelled`)
- `created_at`
- `cancelled_at` (nullable)

### EventPhoto

Photos added by participants after the event. *(story 7)*

- `id`
- `table_id` → Table
- `user_id` → User
- `url`
- `created_at`

### Invitation

In-app invite to join a table. *(story 16)*

- `id`
- `table_id` → Table
- `inviter_id` → User
- `invitee_id` → User
- `status` (`pending` | `accepted` | `declined`)
- `created_at`

### Friendship

Friend request / relationship between two users. *(stories 14, 27)*

- `id`
- `requester_id` → User
- `addressee_id` → User
- `status` (`pending` | `accepted` | `rejected`)
- `created_at`

### Block

A user blocking another user. *(story 12)*

- `id`
- `blocker_id` → User
- `blocked_id` → User
- `created_at`

### VenueBlock

A venue blocking a user from booking. *(story 42)*

- `id`
- `venue_id` → Venue
- `user_id` → User
- `reason`
- `created_at`

### ChatMessage

Per-table event chat. *(story 8)*

- `id`
- `table_id` → Table
- `user_id` → User
- `body`
- `created_at`

### Review

Reviews of users and venues (and venue responses). *(stories 5, 20, 37, 39)*

- `id`
- `author_id` → User
- `target_type` (`user` | `venue`)
- `target_user_id` → User (nullable)
- `target_venue_id` → Venue (nullable)
- `rating` (int)
- `body`
- `response_body` (nullable; venue admin response) *(story 37)*
- `created_at`

### Payment

Reservation fee payment and refunds. *(stories 30, 31, 32, 50, 51)*

- `id`
- `user_id` → User
- `table_id` → Table
- `seat_reservation_id` → SeatReservation (nullable)
- `venue_id` → Venue
- `game_id` → Game (nullable; for per-game reporting)
- `provider` (`paypal` | `revolut`)
- `amount`
- `currency`
- `status` (`pending` | `succeeded` | `failed` | `refunded`)
- `created_at`

### Report

Abuse reports, bug reports, and feedback. *(stories 11, 18, 19)*

- `id`
- `reporter_id` → User
- `type` (`abuse` | `bug` | `feedback`)
- `subject_type` (`user` | `venue` | `content` | `app`) (nullable)
- `subject_id` (nullable)
- `message`
- `screenshot_url` (nullable) *(story 18)*
- `status` (`open` | `reviewing` | `resolved`)
- `created_at`

### Notification

In-app + email notifications, scoped to relevance. *(stories 21, 22, 24, 25, 28, 32, 43, 49, 52)*

- `id`
- `user_id` → User
- `type` (e.g. `table_changed`, `table_cancelled`, `seat_cancelled`, `venue_confirmed`, `payment_result`, `reservation_request`, `abuse_report`, `bad_review`)
- `table_id` → Table (nullable)
- `payload` (JSON)
- `channel` (`in_app` | `email`)
- `read_at` (nullable)
- `created_at`

## Relationships

- A Venue has many Tables, VenueAvailability rows, VenueRules, VenuePhotos, and VenueGameInventory rows.
- A User (organizer) has many Tables; a Table has many SeatReservations (bounded by `max_players`).
- A User has many SeatReservations, Reviews (authored and received), Payments, and Notifications.
- A Table has many ChatMessages, EventPhotos, Invitations, and (optionally) one or more Payments.
- Friendship and Block are user-to-user; VenueBlock is venue-to-user.

## Constraints & rules (enforced in backend)

- A Table cannot exceed `max_players` active `SeatReservation`s. *(story 4)*
- Seat cancellation is allowed up to 24h before `starts_at`; later cancellation is governed by rules/penalties (open question). *(story 21)*
- A blocked user (Block or VenueBlock) cannot join the relevant tables or message the blocker. *(stories 12, 42)*
- Refund is triggered automatically when a Table or SeatReservation is cancelled. *(story 31)*
- Table status transitions are owned by the backend (see `ADR-007`).

## Indexes (suggested)

- `Table(venue_id, starts_at)`
- `Table(status, starts_at)`
- `SeatReservation(table_id, status)`
- `SeatReservation(user_id, status)`
- `VenueAvailability(venue_id, date)`
- `Review(target_venue_id)`, `Review(target_user_id)`
- `Payment(venue_id, status)`, `Payment(user_id, status)`
- `Notification(user_id, read_at)`
