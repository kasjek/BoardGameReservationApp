# API

## Overview

HTTP API used by the player/organizer client, the venue-admin client, and the admin console. Authentication is required for personal, venue, and admin endpoints. Authorization follows the role matrix in `docs/Permissions.md` and is enforced server-side.

Roles referenced below: `USER`, `VENUE_USER`, `ADMIN` (ADMIN is a superset of both).

## Auth & profile

- `POST /auth/register` — self-register a `USER` account *(9)*
- `POST /auth/login` — exchange credentials for a session/token *(9)*
- `POST /auth/logout` — end session
- `GET /auth/me` — current user profile and role (and venue link for `VENUE_USER`)
- `PATCH /me/avatar` — set avatar from the allocated set *(10)*
- `PATCH /me/settings` — e.g. toggle `allow_invites` *(17)*
- `GET /users/{id}` — public profile: avatar, name, rating, cancellation count only *(20, 23, 26)*
- `GET /users?q=` — search users *(14)*

## Venues

- `GET /venues` — list/browse venues (with location info) *(3)*
- `GET /venues/{id}` — venue details, description, photos, rating *(3)*
- `POST /venues` — create venue (ADMIN) *(46)*
- `PATCH /venues/{id}` — edit venue description/photos (VENUE_USER own, ADMIN any) *(36, 46)*
- `DELETE /venues/{id}` — remove venue (ADMIN) *(46)*
- `GET /venues/{id}/availability` — days/times/table counts *(34)*
- `PUT /venues/{id}/availability` — set availability/capacity (VENUE_USER own, ADMIN) *(34)*
- `GET /venues/{id}/rules` / `POST|PATCH|DELETE /venues/{id}/rules/{ruleId}` — reservation rules *(45)*
- `GET /venues/{id}/games` — games available at the venue *(29)*
- `POST|PATCH|DELETE /venues/{id}/games/{inventoryId}` — manage venue inventory: copies, condition, language (VENUE_USER own, ADMIN any) *(38, 44, 47)*
- `GET /venues/{id}/tables` — all events at a venue, single view (VENUE_USER own, ADMIN) *(41)*
- `GET /venues/{id}/history` — past tables at the venue *(40)*

## Games (catalog)

- `GET /games` — list/search catalog *(6)*
- `GET /games/{id}` — game details + picture *(6)*
- `POST|PATCH|DELETE /games/{id}` — manage catalog (ADMIN) *(47)*

## Tables (events)

- `GET /tables` — browse/filter events (`date`, `time`, `past|future`, `game`, `minPlayers`, `maxPlayers`, `venueId`) *(2, 13)*
- `GET /tables/{id}` — table details incl. game, status, seats *(2, 6, 33)*
- `POST /tables` — create a table (venue, time, duration, min/max, game or bring-own, language); organizer auto-seated *(1, 4)*
- `PATCH /tables/{id}` — edit a table (organizer own; ADMIN any) — triggers relevant notifications *(28)*
- `POST /tables/{id}/cancel` — organizer cancels; notifies attendees by email *(22)*
- `GET /tables/{id}/share` — external share link *(15)*

### Seats

- `POST /tables/{id}/seats` — reserve a seat *(2)*
- `POST /tables/{id}/seats/cancel` — cancel own seat (allowed up to 24h before); notifies others *(21)*

### Invitations

- `POST /tables/{id}/invitations` — invite a user in-app (respects `allow_invites`) *(16, 17)*
- `POST /invitations/{id}/accept` / `POST /invitations/{id}/decline` *(16)*

### Event chat & photos

- `GET /tables/{id}/messages` / `POST /tables/{id}/messages` — event chat *(8)*
- `POST /tables/{id}/photos` — add photos after the event ends *(7)*

## Reservation requests (venue side)

- `GET /venues/{id}/requests` — pending reservation requests *(35, 43)*
- `POST /requests/{id}/accept` / `POST /requests/{id}/reject` — confirm/reject a table at the venue *(24, 25, 35)*

## Friends & blocking

- `POST /friends/requests` — send friend request *(14, 27)*
- `POST /friends/requests/{id}/accept` / `.../reject` *(27)*
- `GET /friends` — list friends *(14)*
- `POST /blocks` — block a user *(12)*
- `DELETE /blocks/{userId}` — unblock

## Reviews & ratings

- `GET /users/{id}/reviews` / `GET /venues/{id}/reviews` *(20)*
- `POST /reviews` — review a user or venue *(5, 39)*
- `POST /reviews/{id}/response` — venue admin responds to a review *(37)*

## Payments

- `POST /payments` — start a reservation-fee payment (`provider: paypal|revolut`) *(30)*
- `GET /payments/{id}` — payment status *(32)*
- `POST /payments/{id}/refund` — refund (auto-triggered on cancellation) *(31)*
- `GET /admin/payments/report` — fees per venue/user/game (ADMIN) *(50, 51)*

## Reports (safety, bugs, feedback)

- `POST /reports` — abuse report, bug report (with screenshot), or feedback *(11, 18, 19)*
- `GET /admin/reports` — review queue (ADMIN) *(49)*
- `DELETE /content/{type}/{id}` — remove abusive content (ADMIN) *(48)*

## Admin / platform

- `POST|PATCH|DELETE /admin/venues/{id}/staff` — add/edit/remove venue admins (ADMIN) *(46)*
- `POST /admin/users/{id}/block` / `POST /admin/venues/{id}/block` — block user/venue (ADMIN) *(53)*
- `POST /admin/users/{id}/super` / `POST /admin/venues/{id}/super` — mark super user/location (ADMIN) *(54)*

## Notifications

- `GET /notifications` — current user's notifications (relevant-only) *(28)*
- `POST /notifications/{id}/read` — mark read

## Errors

- `400` validation errors
- `401` unauthenticated
- `403` forbidden (role/permission or block)
- `404` not found
- `409` conflict (see below)

### Conflict (`409`) conditions

Backend-enforced invariants (see `ADR-011` and `docs/Database.md`):

- `POST /tables/{id}/seats` — table is full (`seats_taken >= max_players`), or the user already holds an active seat at the table (partial unique on `SeatReservation(table_id, user_id)`).
- `POST /requests/{id}/accept` — venue over capacity for the requested slot (overlapping tables `>= venue_availability.tables_available`).
- `POST /tables/{id}/seats/cancel` — seat already cancelled, or a state that forbids cancellation.
- `POST /tables` / `PATCH /tables/{id}` — requested slot outside the venue's published availability.
- `POST /payments/{id}/refund` — payment not in a refundable state.
