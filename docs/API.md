# API

## Overview

HTTP API used by the admin and player clients. Auth required for personal and admin endpoints.

## Auth

- `POST /auth/login` — exchange credentials for a session/token
- `POST /auth/logout` — end session
- `GET /auth/me` — current user profile and role

## Games

- `GET /games` — list/search catalog (`q`, `minPlayers`, `maxPlayers`, `availableFrom`, `availableTo`)
- `GET /games/{id}` — game details
- `POST /games` — create game (admin)
- `PATCH /games/{id}` — update game (admin)
- `DELETE /games/{id}` — deactivate/remove game (admin)

## Copies

- `GET /games/{id}/copies` — list copies for a game (admin)
- `POST /games/{id}/copies` — add a copy (admin)
- `PATCH /copies/{id}` — update copy (admin)
- `DELETE /copies/{id}` — deactivate copy (admin)

## Availability

- `GET /games/{id}/availability` — free/busy for a time range (`from`, `to`)
- Response indicates whether at least one copy can be reserved for the requested slot

## Reservations

- `GET /reservations` — list reservations (player: own; admin: filterable)
- `GET /reservations/{id}` — reservation details
- `POST /reservations` — create reservation (`gameId` or `gameCopyId`, `startsAt`, `endsAt`)
- `PATCH /reservations/{id}` — update status / times (owner cancel; admin manage)
- `POST /reservations/{id}/cancel` — cancel reservation
- `POST /reservations/{id}/complete` — mark returned/completed (admin)

## Errors

- `400` validation errors
- `401` unauthenticated
- `403` forbidden
- `404` not found
- `409` conflict (e.g. no available copy / overlapping reservation)
