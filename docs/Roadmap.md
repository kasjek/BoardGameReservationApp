# Roadmap

Sequencing for the table/venue model. Phases roughly follow requirement priority (Must → Should → Could) in `docs/Requirements.md`.

## Phase 1 — Foundation

- Project setup (backend API, player/organizer client, venue-admin client, admin console shells)
- Core data model: users, venues, availability/capacity, games, tables, seat reservations (`docs/Database.md`)
- Accounts, fast login, profiles and avatars *(9, 10, 26)*
- Role model + server-side authorization for `USER` / `VENUE_USER` / `ADMIN` (`docs/Permissions.md`)

## Phase 2 — Tables & reservations (core)

- Create a table (venue, date, from/to time, min/max, game with bring-own + language or venue game) *(1, 4, 6)*
- Browse and filter tables; view details *(2, 13)*
- Reserve and cancel seats (24h rule); waitlist + auto-promotion; late-cancellation marks; organizer cancels table *(2, 21, 22, 23)*
- Venue availability/capacity (15-min turnover) and accept/reject requests (table + venue game) *(34, 35)*
- Table status lifecycle visible to all parties *(24, 33)*
- Relevant-only notifications (email + in-app) *(25, 28, 43)*

## Phase 3 — Payments & venue operations

- Reservation-fee payments via PayPal/Revolut, with result notifications *(30, 32)*
- Automatic refunds on cancellation *(31)*
- Venue profile, photos, rules, and game inventory management *(36, 44, 45)*
- Venue single-screen event dashboard and history *(40, 41)*

## Phase 4 — Social, reviews & trust/safety

- Friends (search, requests) and in-app invitations *(14, 16, 27)*
- Event chat *(8)*
- Reviews & ratings for users and venues; venue responses *(5, 20, 37, 39)*
- Blocking (user-to-user and venue-to-user) *(12, 42)*
- Reporting (abuse, bug, feedback) and admin moderation *(11, 18, 19, 48, 49, 53)*
- Fee reporting and "super user/location" tagging *(50, 51, 54)*

## Phase 5 — Polish

- External table sharing / invite-to-register *(15)*
- Event photos and richer history *(7, 23)*
- Internationalization (EN/DE) and mobile UX hardening *(NFR-5, NFR-6)*
- Performance, reliability, and analytics

## Backlog / Blocked

- **BoardGameGeek real cover images & exact game-page links** — **blocked on BGG approval.**
  BGG closed its free XML API in mid-2025; the search/`thing` endpoints now require a
  registered application token (`Authorization: Bearer`). An application has been submitted
  to BGG and is awaiting review/approval.
  - The feature is **already implemented and token-ready**: set the `BGG_API_TOKEN`
    env var and real covers/exact pages resolve automatically (see `apps/bgg`).
  - Until a token is available, the app **falls back gracefully**: game names show a
    lettered placeholder tile and link to a BGG search (no broken UI).
  - **Next step (when approved):** obtain the token, set `BGG_API_TOKEN` as a secret,
    and verify live covers/links; consider persisting resolved BGG ids/covers in a
    proper game catalog to avoid per-request lookups.
