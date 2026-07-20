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

## ADR-005: Table reservation first for players

- **Status:** Accepted
- **Context:** The product must ship a thin vertical slice for a standard player before game catalog and admin tooling. Board game cafes typically need a place to sit before (or alongside) borrowing games.
- **Decision:** Treat venue **tables** as first-class reservable resources. Priority 0 is player create / view / cancel of **table reservations**. Game-copy reservations (ADR-001) remain valid and follow in a later phase.
- **Consequences:** Data model and API gain `Table` and `TableReservation`. Phase 1 of the roadmap centers on table booking with seeded tables (no admin inventory UI required for the first slice). Game browsing and copy booking come after.

## ADR-006: Fixed v1 rules for table booking

- **Status:** Accepted
- **Context:** Configurable venue rules belong later; the first slice needs predictable defaults.
- **Decision:** For Priority 0 table reservation: single venue; login required; default slot length **120 minutes**; party size required and must be ≤ table capacity; at most **one** active upcoming table reservation per player; successful create sets status to **`confirmed`** (no `pending` step in v1).
- **Consequences:** Simpler player UX and backend; VenueSettings / admin rule UI can relax these later.
