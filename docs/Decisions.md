# Decisions

Lightweight architecture decision records for BoardGameReservationApp.

## ADR-001: Reserve physical copies, not abstract games

- **Status:** Accepted
- **Context:** Availability must reflect real inventory at a venue.
- **Decision:** Reservations bind to a `GameCopy`, even if the player picks a game and the system assigns a free copy.
- **Consequences:** Prevents double-booking; inventory count drives availability.

## ADR-002: Backend owns reservation rules

- **Status:** Accepted
- **Context:** Multiple clients (admin + player) must share the same booking constraints.
- **Decision:** Overlap checks, slot rules, and status transitions live in the backend API.
- **Consequences:** Clients stay simpler; conflicts return explicit API errors (e.g. `409`).

## ADR-003: Clear reservation statuses

- **Status:** Accepted
- **Context:** Players and staff need to know what is actionable.
- **Decision:** Use explicit statuses: `pending`, `confirmed`, `cancelled`, `completed`, `overdue`.
- **Consequences:** UI can map status to simple actions; reporting stays straightforward.

## ADR-004: Docs-first planning artifacts

- **Status:** Accepted
- **Context:** Greenfield project needs shared intent before deep implementation.
- **Decision:** Keep vision, requirements, stories, roadmap, data, architecture, API, and decisions in repo docs.
- **Consequences:** Implementation can track against written intent; decisions stay reviewable.
