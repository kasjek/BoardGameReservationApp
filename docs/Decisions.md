# Decisions

Lightweight architecture decision records for BoardGameReservationApp.

## ADR-001: Reserve physical copies, not abstract games

- **Status:** Superseded by ADR-005
- **Context:** An early, default-generated model treated the product as a board-game *library* where players reserved a physical `GameCopy`.
- **Decision (original):** Reservations bind to a `GameCopy`.
- **Why superseded:** `docs/Vision.md` and `docs/UserStories.md` define a different product — users reserve a **seat at a table (event)** hosted at a **venue**, not a copy from a library. See ADR-005.

## ADR-002: Backend owns reservation rules

- **Status:** Accepted
- **Context:** Multiple clients (player, venue admin, admin) must share the same booking constraints.
- **Decision:** Capacity checks, table status transitions, permissions, and refunds live in the backend API.
- **Consequences:** Clients stay simpler; conflicts return explicit API errors (e.g. `409`). Reinforced by `docs/Permissions.md` (backend enforcement) and ADR-007.

## ADR-003: Clear, visible table statuses

- **Status:** Accepted
- **Context:** Players, organizers, and venues need to know what is actionable (per `docs/Vision.md`).
- **Decision:** Use explicit table statuses: `waiting_for_venue_confirmation`, `waiting_for_players`, `confirmed`, `cancelled`, `completed`.
- **Consequences:** UI maps status to simple next-steps; status is shown to all parties. Detailed transitions in ADR-007.

## ADR-004: Docs-first planning artifacts

- **Status:** Accepted
- **Context:** Greenfield project needs shared intent before deep implementation.
- **Decision:** Keep vision, requirements, stories, roadmap, data, architecture, API, and decisions in repo docs.
- **Consequences:** Implementation can track against written intent; decisions stay reviewable.

## ADR-005: Reserve a seat at a table hosted at a venue

- **Status:** Accepted (supersedes ADR-001)
- **Context:** The product connects players and helps venues manage table reservations (`docs/Vision.md`). Users create **tables** (events) at **venues**; others reserve **seats**.
- **Decision:** The core booking unit is a `Table` (event) at a `Venue`, with `SeatReservation`s bounded by the table's `max_players`. A game catalog and per-venue inventory exist as supporting data (bring-your-own or venue-provided), not as the reservation target.
- **Consequences:** Data model, API, and roadmap center on venues/tables/seats (`docs/Database.md`, `docs/API.md`, `docs/Roadmap.md`).

## ADR-006: Payments via hosted providers (PayPal / Revolut)

- **Status:** Accepted
- **Context:** Users want quick reservation-fee payment and automatic refunds (`stories 30–32`).
- **Decision:** Integrate hosted PayPal and Revolut flows; the app never stores card data. Refunds are triggered automatically on table/seat cancellation.
- **Consequences:** Keeps card handling out of PCI scope; payment/refund state is tracked in `Payment` (`docs/Database.md`). Open question: fee model (per seat vs per table) and payee split.

## ADR-007: Backend-owned table status lifecycle

- **Status:** Accepted
- **Context:** Table status must be consistent and visible to all parties (ADR-003).
- **Decision:** The backend owns transitions: `waiting_for_venue_confirmation` → (venue accepts) `waiting_for_players` → (enough seats) `confirmed` → `completed`; any state may move to `cancelled` (by organizer, venue, or admin), triggering notifications and refunds.
- **Consequences:** Predictable state machine; clients render status only. Open question: whether venue confirmation gates seat joining or runs in parallel.

## ADR-008: Notifications are relevant-scoped, email + in-app

- **Status:** Accepted
- **Context:** Users want notifications only for tables relevant to them (`story 28`); venues and admin need targeted alerts.
- **Decision:** Deliver notifications over in-app and email channels, scoped to a user's organized/joined tables and role-specific events (reservation requests, abuse reports, bad reviews).
- **Consequences:** Avoids spam; a `Notification` record backs both channels (`docs/Database.md`).

## ADR-009: Trust & safety are first-class

- **Status:** Accepted
- **Context:** Users must feel safe; abusive behavior must be actionable (`stories 11, 12, 42, 48, 49, 53`).
- **Decision:** Support user-to-user blocking, venue-to-user blocking, reporting (abuse/bug/feedback), admin content removal, and user/venue blocking. All moderation actions are auditable.
- **Consequences:** Requires `Block`, `VenueBlock`, and `Report` entities and admin tooling; privacy rules limit public profile data (`NFR-1`).

## ADR-010: PostgreSQL modular monolith

- **Status:** Accepted
- **Context:** The product needs strong booking invariants (capacity, no double-booking), rich filtering, and low operational overhead for a greenfield team (`docs/Architecture.md`, `docs/Vision.md`).
- **Decision:** Build the backend as a single deployable **modular monolith** (modules: auth, venues, tables, payments, social, moderation, notifications) over **PostgreSQL**, with S3-compatible object storage for media. Clients start as one responsive web app with role-based views.
- **Consequences:** Seat/payment invariants live in local DB transactions; no distributed-transaction complexity. Clear module boundaries leave room to extract services later if scale demands. Relational constraints back the trust requirements.

## ADR-011: Seat-capacity concurrency via row lock + partial unique index

- **Status:** Accepted
- **Context:** Multiple users may try to reserve the last seat(s) simultaneously; availability must stay trustworthy (`docs/Vision.md`, `stories 2, 4`).
- **Decision:** Reserve seats inside a transaction that takes `SELECT ... FOR UPDATE` on the `Table` row, checks a denormalized `seats_taken < max_players`, inserts the `SeatReservation`, and increments the counter. Enforce a **partial unique index** on `SeatReservation(table_id, user_id) WHERE status = 'reserved'` to prevent duplicate seats. Venue capacity is checked against `VenueAvailability.tables_available` for overlapping slots at confirmation time. Conflicts return `409`.
- **Consequences:** Deterministic capacity behavior under concurrency without table-wide locking; the `seats_taken` counter must be maintained on every seat insert/cancel. Reinforces `ADR-002` (backend owns rules) and `ADR-007` (status lifecycle).
