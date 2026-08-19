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
- **Decision:** The core booking unit is a `Table` (event) at a `Venue`, with `SeatReservation`s bounded by the table's `max_players`. A game catalog and per-venue inventory exist as supporting data (hosts book a game from that venue's library), not as the reservation target.
- **Consequences:** Data model, API, and roadmap center on venues/tables/seats (`docs/Database.md`, `docs/API.md`, `docs/Roadmap.md`).

## ADR-006: Payments via hosted providers (PayPal / Revolut)

- **Status:** Accepted (fee model decided)
- **Context:** Users want quick reservation-fee payment and automatic refunds (`stories 30–32`).
- **Decision:** Integrate hosted PayPal and Revolut flows; the app never stores card data. Refunds are triggered automatically on table/seat cancellation. **Fee model (owner decision):** the host may either **pay for the whole table at once** or the fee may be **split per seat**, chosen per table. In all cases **the payer is always a `USER`** (a `Payment` always references the paying user).
- **Consequences:** Keeps card handling out of PCI scope; payment/refund state is tracked in `Payment` with a `scope` of `full_table` or `per_seat` (`docs/Database.md`). Full-table payment is made by the host; per-seat payments are made by each seated user.

## ADR-007: Backend-owned table status lifecycle

- **Status:** Accepted (venue-confirmation-first decided)
- **Context:** Table status must be consistent and visible to all parties (ADR-003).
- **Decision:** The backend owns transitions: `waiting_for_venue_confirmation` → (venue accepts) `waiting_for_players` → (enough seats) `confirmed` → `completed`; any state may move to `cancelled` (by organizer, venue, or admin), triggering notifications and refunds. **Sequencing (owner decision):** after the host requests a table, **the venue must confirm availability first** before any remaining users can book seats. When the host requested a venue-provided game, the venue must also **confirm the requested game is available** as part of accepting (not just the table). Only the host's own seat exists during `waiting_for_venue_confirmation`.
- **Consequences:** Predictable state machine; clients render status only. Seat-booking endpoints reject joins until status is `waiting_for_players` (`409`/`403`). Venue acceptance covers both table and (if applicable) game availability.

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

- **Status:** Accepted (confirmed by owner — structural Option A + PostgreSQL)
- **Context:** The product needs strong booking invariants (capacity, no double-booking), rich filtering, and low operational overhead for a greenfield team (`docs/Architecture.md`, `docs/Vision.md`).
- **Decision:** Build the backend as a single deployable **modular monolith** (modules: auth, venues, tables, payments, social, moderation, notifications) over **PostgreSQL**, with S3-compatible object storage for media. The launch client is a mobile-first responsive web app (see `ADR-012`).
- **Consequences:** Seat/payment invariants live in local DB transactions; no distributed-transaction complexity. Clear module boundaries leave room to extract services later if scale demands. Relational constraints back the trust requirements.

## ADR-011: Seat-capacity concurrency via row lock + partial unique index

- **Status:** Accepted
- **Context:** Multiple users may try to reserve the last seat(s) simultaneously; availability must stay trustworthy (`docs/Vision.md`, `stories 2, 4`).
- **Decision:** Reserve seats inside a transaction that takes `SELECT ... FOR UPDATE` on the `Table` row, checks a denormalized `seats_taken < max_players`, inserts the `SeatReservation`, and increments the counter. Enforce a **partial unique index** on `SeatReservation(table_id, user_id) WHERE status = 'reserved'` to prevent duplicate seats. Venue capacity is checked against `VenueAvailability.tables_available` at confirmation time. **Slot spacing (owner decision):** physical-table slots start **at least 15 minutes apart** to allow cleanup between reservations, so two tables at a venue conflict when `[starts_at, ends_at]` windows are within **15 minutes** of each other. Conflicts return `409`.
- **Consequences:** Deterministic capacity behavior under concurrency without table-wide locking; the `seats_taken` counter must be maintained on every seat insert/cancel. The 15-minute turnover buffer is applied when counting overlapping tables against `VenueAvailability.tables_available`. Reinforces `ADR-002` (backend owns rules) and `ADR-007` (status lifecycle).

## ADR-012: Mobile-first responsive web is the launch client

- **Status:** Accepted (owner decision)
- **Context:** The owner wants the product to look and work perfectly on phones from launch day; a native app can come later.
- **Decision:** Ship a **single responsive web app** with role-based views, designed **mobile-first** (phone viewport is the default; enhance upward to tablet/desktop). Native mobile apps are deferred and, if built, reuse the same backend API. No native app is required for launch.
- **Consequences:** Front-end work prioritizes small-viewport layouts, touch targets, and fast first load (`NFR-6`). One codebase/client to maintain at launch; the API stays client-agnostic so native apps can be added without backend changes.

## ADR-013: Waitlist promotion and late-cancellation marks

- **Status:** Accepted (owner decision)
- **Context:** Popular tables fill up, and late cancellations hurt other players' plans (`stories 21, 23`).
- **Decision:**
  - **Waitlist** — when a table is full, additional users join a **waitlist** (`SeatReservation.status = 'waitlisted'` with an ordered `waitlist_position`). When a `reserved` seat is cancelled, the **earliest waitlisted user is automatically promoted** to `reserved` (and notified).
  - **Late cancellation** — cancelling a seat **within 24h** of `starts_at` (i.e. after the free-cancellation window of `story 21`) is a *late cancellation*. It records a **late-cancellation mark** on the user's profile that is **visible to others for 30 days**, then expires.
- **Consequences:** Adds a `LateCancellationMark` entity (with `expires_at = created_at + 30 days`) and a `waitlisted` seat status + `waitlist_position`. Promotion runs in the same transaction as the cancellation. Marks are shown on public profiles only while active (alongside `cancellations_count`).

## ADR-014: Technology stack

- **Status:** Accepted (owner decision)
- **Context:** With the modular monolith (`ADR-010`), mobile-first web launch client (`ADR-012`), and PostgreSQL locked in, the team needs a concrete, agreed stack so Developer/Tester/Penetration-Tester can build and run consistently.
- **Decision:**
  - **Backend:** **Python + Django + Django REST Framework** (batteries-included: ORM, migrations, auth, permissions, and the Django admin site to jump-start the `ADMIN` console).
  - **Database:** **PostgreSQL**; Django ORM + built-in migrations.
  - **Frontend:** **React + Next.js** with **Tailwind CSS**, mobile-first; consumes the DRF API so a future native app can reuse it (`ADR-012`).
  - **Repo layout:** **monorepo** — `/backend` (Django) and `/frontend` (Next.js).
  - **Python tooling:** **uv** (dependencies), **ruff** (lint/format), **pytest + pytest-django** (tests).
  - **Frontend tooling:** **pnpm**, **Vitest + React Testing Library**, **Playwright** for end-to-end (also used for mobile-viewport checks).
  - **Local environment:** **Docker Compose** (Postgres + backend + frontend).
  - **Staging/test environment:** a container PaaS (**Render** or **Fly.io**) — the environment Tester and Penetration-Tester use before production.
  - **CI:** **GitHub Actions** (lint + tests on every PR).
  - **Design:** **Figma** is the source of truth for UI design; exports/links are referenced from the repo docs.
- **Consequences:** Developer builds against Django/DRF + Next.js; the DRF API stays client-agnostic for future native apps. Security tooling (Bandit, pip-audit, Semgrep, OWASP ZAP) targets this stack. The exact staging provider (Render vs. Fly.io) can be finalized when first deploying.
