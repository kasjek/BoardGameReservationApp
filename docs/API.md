# API

## Overview

HTTP API used by the player/organizer client, the venue-admin client, and the admin console. Authentication is required for personal, venue, and admin endpoints. Authorization follows the role matrix in `docs/Permissions.md` and is enforced server-side.

Roles referenced below: `USER`, `VENUE_USER`, `ADMIN` (ADMIN is a superset of both).

## Auth & profile

- `POST /auth/register` — self-register a `USER` account; requires `captcha_token` from Google reCAPTCHA v2 *(9)*
- `GET /auth/captcha/config` — `{ captcha_enabled, recaptcha_site_key }` for the registration checkbox (public)
- `POST /auth/login` — exchange credentials for a session/token *(9)*
- `GET /auth/google/config` — `{ google_enabled, google_client_id }` for the GIS button (public)
- `POST /auth/google` — exchange a Google Identity Services ID token (`credential`) for an app token; creates a `USER` or logs into the existing account with the same verified email *(9)*
- `POST /auth/logout` — end session
- `GET /auth/me` — current user profile and role (and venue link for `VENUE_USER`)
- `POST /me/password` — change own password (`current_password`, `new_password`, `confirm_password`); rotates auth token *(9)*
- `PATCH /me/avatar` — set avatar from the allocated set *(10)*
- `PATCH /me/settings` — e.g. toggle `allow_invites` *(17)*
- `GET /users/{id}` — public profile: avatar, name, rating, cancellation count only *(20, 23, 26)*
- `GET /users?q=` — search users *(14)*

## Venues

- `GET /venues` — list/browse venues (with location info) *(3)*
- `GET /venues/{id}` — venue details, description, photos, rating *(3)*
- `POST /venues` — create venue (ADMIN); may include `weekly_hours` and `closures` *(46)*
- `PATCH /venues/{id}` — edit venue description/photos (VENUE_USER own, ADMIN any) *(36, 46)*
- `DELETE /venues/{id}` — remove venue (ADMIN) *(46)*
- `GET /venues/{id}/availability` — days/times/table counts *(34)*
- `PUT /venues/{id}/availability` — set availability/capacity (VENUE_USER own, ADMIN) *(34)*
- `GET/PUT /venues/{id}/hours` — recurring bookable hours per weekday (Mon=0…Sun=6); PUT replaces the full week (VENUE_USER own, ADMIN) *(34)*
- `GET/POST /venues/{id}/closures` / `DELETE /venues/{id}/closures/{id}` — date-specific closure alerts with comment; closed dates cannot be booked *(34)*
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
- `POST /tables` — create a table (venue, date, `startsAt`/`endsAt`, min/max, game + `bringOwnGame` and language, or venue game); host is a `USER`, auto-seated; starts in `waiting_for_venue_confirmation` *(1, 4; decisions 2, 4, 6)*
- `PATCH /tables/{id}` — edit a table (organizer own; ADMIN any) — triggers relevant notifications *(28)*
- `POST /tables/{id}/cancel` — organizer cancels; notifies attendees by email *(22)*
- `GET /tables/{id}/share` — external share link *(15)*

### Seats

- `POST /tables/{id}/seats` — reserve a seat (`USER`-only; only allowed once status is `waiting_for_players`; if full, the user is **waitlisted**) *(2; decisions 2, 6, 7)*
- `POST /tables/{id}/seats/cancel` — cancel own seat; **>24h before** is free, **within 24h** records a late-cancellation mark; on cancel of a reserved seat the earliest waitlisted user is promoted; notifies others *(21; decision 7)*
- `GET /tables/{id}/waitlist` — ordered waitlist for the table *(decision 7)*

### Invitations

- `POST /tables/{id}/invitations` — invite a user in-app (respects `allow_invites`) *(16, 17)*
- `POST /invitations/{id}/accept` / `POST /invitations/{id}/decline` *(16)*

### Event chat & photos

- `GET /tables/{id}/messages` / `POST /tables/{id}/messages` — event chat *(8)*
- `POST /tables/{id}/photos` — add photos after the event ends *(7)*

## Reservation requests (venue side)

- `GET /venues/{id}/requests` — pending reservation requests *(35, 43)*
- `POST /requests/{id}/accept` / `POST /requests/{id}/reject` — confirm/reject a table at the venue; accept confirms **table availability** and, for a venue game, **game availability** (`venueGameConfirmed`), moving status to `waiting_for_players` *(24, 25, 35; decisions 2, 4)*

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

- `POST /payments` — start a reservation-fee payment (`provider: paypal|revolut`, `scope: full_table|per_seat`); payer is always a `USER` — `full_table` is paid by the host, `per_seat` by each seated user *(30; decision 1)*
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
- `403` forbidden (role/permission or block) — e.g. a `VENUE_USER` attempting to host or reserve, or booking a seat before the venue has confirmed (status not yet `waiting_for_players`).
- `404` not found
- `409` conflict (see below)

### Conflict (`409`) conditions

Backend-enforced invariants (see `ADR-011` and `docs/Database.md`):

- `POST /tables/{id}/seats` — the user already holds an active seat at the table (partial unique on `SeatReservation(table_id, user_id)`). *(A full table is not an error — the user is **waitlisted** instead.)*
- `POST /requests/{id}/accept` — venue over capacity for the requested slot (tables within 15 min `>= venue_availability.tables_available`), or the requested venue game is unavailable.
- `POST /tables/{id}/seats/cancel` — seat already cancelled, or a state that forbids cancellation.
- `POST /tables` / `PATCH /tables/{id}` — requested slot outside the venue's published availability, or it starts within 15 minutes of another table's slot at the same venue.
- `POST /payments/{id}/refund` — payment not in a refundable state.
