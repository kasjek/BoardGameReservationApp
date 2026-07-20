# Architecture

## Overview

BoardGameReservationApp is split into a backend API, an admin client, and a player-facing mobile/web client.

**Priority 0** delivers backend + player client for **table reservation** only. Admin client and game inventory come later.

## Components

### Backend API

- Owns business rules for table (and later game) reservations
- Exposes REST (or similar) endpoints for availability and bookings
- Authenticates users and authorizes personal vs admin actions
- Persists data in a relational database

### Admin Client (later)

- Used by venue staff to manage tables, games, copies, and reservations
- Calls the Backend API for all reads and writes

### Player Client (mobile / web)

- Priority 0: player logs in, checks table availability, creates/views/cancels table reservations
- Later: browse games and make game reservations
- Calls the Backend API for availability and personal bookings

## High-Level Flow (Priority 0)

1. Setup seeds active tables for a single venue
2. Player logs in
3. Player chooses a time slot (default duration 120 minutes) and sees free tables
4. Player creates a table reservation with party size
5. Backend validates capacity, overlap, and one-active-reservation rules; stores status `confirmed`
6. Player can view or cancel; cancel frees the table immediately

## Later Flow (games)

1. Admin adds games and copies to inventory
2. Player browses catalog and checks game availability for a time range
3. Player creates a reservation against a free copy (optionally linked to a table reservation)
4. Backend validates overlap rules and stores the reservation
5. Admin can monitor and update reservation status (e.g. returned / completed)

## Design Notes

- Table availability is computed from active table reservations against tables
- Double-booking is prevented at the API/database layer, not only in the UI
- Clients remain thin; reservation rules live in the backend (ADR-002)
- Game-copy reservation rules (ADR-001) apply when game booking is implemented
