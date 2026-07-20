# API

## Overview

HTTP API used by the admin and player clients. Auth required for personal and admin endpoints.

**Priority 0:** auth, tables, table availability, and table reservations.

## Auth

- `POST /auth/login` — exchange credentials for a session/token
- `POST /auth/logout` — end session
- `GET /auth/me` — current user profile and role

## Tables (Priority 0)

- `GET /tables` — list active tables (`capacity` optional filter)
- `GET /tables/{id}` — table details
- `GET /tables/availability` — free/busy for a slot (`from`, `to` or `from` + `durationMinutes`)
  - Response lists tables and whether each is free for the full requested slot
- Admin table CRUD is **later** (Priority 0 uses seeded tables)

## Table reservations (Priority 0)

- `GET /table-reservations` — list current user’s table reservations (upcoming/active by default)
- `GET /table-reservations/{id}` — reservation details (owner only in v1)
- `POST /table-reservations` — create (`tableId`, `startsAt`, `endsAt`, `partySize`)
  - Success → status `confirmed`
  - Rejects if table busy, party size over capacity, or player already has an active upcoming table reservation
- `POST /table-reservations/{id}/cancel` — cancel (owner only); frees the table immediately

## Later — Games

- `GET /games` — list/search catalog (`q`, `minPlayers`, `maxPlayers`, `availableFrom`, `availableTo`)
- `GET /games/{id}` — game details
- `POST /games` — create game (admin)
- `PATCH /games/{id}` — update game (admin)
- `DELETE /games/{id}` — deactivate/remove game (admin)

## Later — Copies

- `GET /games/{id}/copies` — list copies for a game (admin)
- `POST /games/{id}/copies` — add a copy (admin)
- `PATCH /copies/{id}` — update copy (admin)
- `DELETE /copies/{id}` — deactivate copy (admin)

## Later — Game availability

- `GET /games/{id}/availability` — free/busy for a time range (`from`, `to`)
- Response indicates whether at least one copy can be reserved for the requested slot

## Later — Game reservations

- `GET /reservations` — list reservations (player: own; admin: filterable)
- `GET /reservations/{id}` — reservation details
- `POST /reservations` — create reservation (`gameId` or `gameCopyId`, `startsAt`, `endsAt`, optional `tableReservationId`)
- `PATCH /reservations/{id}` — update status / times (owner cancel; admin manage)
- `POST /reservations/{id}/cancel` — cancel reservation
- `POST /reservations/{id}/complete` — mark returned/completed (admin)

## Errors

- `400` validation errors
- `401` unauthenticated
- `403` forbidden
- `404` not found
- `409` conflict (e.g. table/copy unavailable, overlapping reservation, or player already has an active table reservation)
