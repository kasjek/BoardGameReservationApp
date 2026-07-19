# Requirements

## Overview

BoardGameReservationApp lets players discover and reserve board games, and helps venues manage inventory and bookings.

## Functional Requirements

### Players

- Browse the catalog of available board games
- Filter and search by name, player count, duration, and availability
- View game details (description, player count, estimated play time, copies available)
- Reserve a game for a specific time slot
- Cancel or modify an upcoming reservation
- View personal reservation history and upcoming bookings

### Venue / Organizer Admins

- Manage game inventory (add, edit, remove games and copies)
- Define reservation time slots and rules (duration, lead time, limits)
- View and manage reservations (confirm, cancel, mark returned)
- See availability and occupancy at a glance

### System

- Prevent double-booking of the same physical copy
- Keep availability accurate when reservations are created, changed, or cancelled
- Notify users of reservation confirmations and changes (when notifications are enabled)

## Non-Functional Requirements

- Mobile-friendly experience for players
- Clear reservation status at every step
- Consistent availability between browse and booking flows
- Secure access for admin actions
- Reasonable response times for catalog and reservation operations
