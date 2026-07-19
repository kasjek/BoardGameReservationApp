# Architecture

## Overview

BoardGameReservationApp is split into a backend API, an admin client, and a player-facing mobile/web client.

## Components

### Backend API

- Owns business rules for inventory and reservations
- Exposes REST (or similar) endpoints for catalog, availability, and bookings
- Authenticates users and authorizes admin actions
- Persists data in a relational database

### Admin Client

- Used by venue staff to manage games, copies, and reservations
- Calls the Backend API for all reads and writes

### Player Client (mobile / web)

- Used by players to browse games and make reservations
- Calls the Backend API for catalog, availability, and personal bookings

## High-Level Flow

1. Admin adds games and copies to inventory
2. Player browses catalog and checks availability for a time range
3. Player creates a reservation against a free copy
4. Backend validates overlap rules and stores the reservation
5. Admin can monitor and update reservation status (e.g. returned / completed)

## Design Notes

- Availability is computed from active reservations against game copies
- Double-booking is prevented at the API/database layer, not only in the UI
- Clients remain thin; reservation rules live in the backend
