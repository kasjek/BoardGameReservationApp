# Roadmap

Sequencing for the table/venue model. Phases roughly follow requirement priority (Must → Should → Could) in `docs/Requirements.md`.

## Phase 1 — Foundation

- Project setup (backend API, player/organizer client, venue-admin client, admin console shells)
- Core data model: users, venues, availability/capacity, games, tables, seat reservations (`docs/Database.md`)
- Accounts, fast login, profiles and avatars *(9, 10, 26)*
- Role model + server-side authorization for `USER` / `VENUE_USER` / `ADMIN` (`docs/Permissions.md`)

## Phase 2 — Tables & reservations (core)

- Create a table (venue, time, duration, min/max, game or bring-own, language) *(1, 4, 6)*
- Browse and filter tables; view details *(2, 13)*
- Reserve and cancel seats (24h rule); organizer cancels table *(2, 21, 22)*
- Venue availability/capacity and accept/reject reservation requests *(34, 35)*
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
