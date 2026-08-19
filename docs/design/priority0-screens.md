# Priority‑0 screens — first drafts

Mobile-first wireframes for the Priority‑0 flows. These are low-fidelity, build-ready
specs that map to the Figma frames (source of truth, `ADR-014`). Each screen lists the
stories/FRs it serves, its components, states, and the API it uses (`docs/API.md`).

> Figma link: _to be added once the Figma project is available._

Legend: `[ Button ]`  `( input )`  `‹ back`  `•••` overflow. Frames are ~360px wide (phone).

---

## 1. Sign up / Log in — *(stories 9; FR-A1)*

```
┌────────────────────────────┐
│        BoardGameApp        │
│                            │
│   Find a table. Play.      │
│                            │
│   [ Continue with Google ] │
│   [ Continue with Facebook]│
│            or              │
│   ( Email )                │
│   ( Password )             │
│   [ I'm not a robot ]      │
│                            │
│   [   Sign up   ]          │
│                            │
│   New here?  Sign up ›     │
└────────────────────────────┘
```

- **Sign up** collects display name, email, password, and a **reCAPTCHA** → creates an inactive `USER` and emails an activation link. The user must click **Activate account** before password login.
- **Google** uses Google Identity Services; the API verifies the ID token and creates/links a `USER`.
- **Facebook** uses Facebook Login; the API verifies the user access token and creates/links a `USER`.
- **States:** idle, loading, invalid-credentials error, field validation, captcha required, Google/Facebook not configured (button hidden), check-email after sign-up, not-activated on login.
- **API:** `POST /api/auth/register` (`captcha_token` required; no token until activated), `GET /api/auth/captcha/config`, `POST /api/auth/login`, `GET|POST /api/auth/activate`, `POST /api/auth/activate/resend`, `GET /api/auth/google/config`, `POST /api/auth/google`, `GET /api/auth/facebook/config`, `POST /api/auth/facebook`.

---

## 2. Browse tables (home) — *(stories 2, 3, 13; FR-B2, FR-B4)*

```
┌────────────────────────────┐
│ Tables        ⌕   ☰ Filter │
├────────────────────────────┤
│ ┌────────────────────────┐ │
│ │ Catan · Board & Brew   │ │
│ │ Sat 7 Aug · 18:00–20:00 │ │
│ │ 🟢 Confirmed · 2/4 seats│ │
│ └────────────────────────┘ │
│ ┌────────────────────────┐ │
│ │ Carcassonne · Meeple.. │ │
│ │ Sun 8 Aug · 18:00      │ │
│ │ 🟡 Waiting for players  │ │
│ └────────────────────────┘ │
│                            │
│         [ + Create ]       │  ← thumb-reachable FAB
├────────────────────────────┤
│  Browse   My games   Me    │  ← bottom nav
└────────────────────────────┘
```

- **Filters (sheet):** date, time, past/future, game name, min/max players, location/venue.
- **Status chip** color-codes table status (waiting-venue / waiting-players / confirmed / cancelled).
- **Empty/loading/error** states for the list.
- **API:** `GET /api/tables?date=&game=&venueId=&status=…`

---

## 3. Table detail — *(stories 2, 6, 21, 33; FR-B3, FR-B5, FR-B6, FR-B10)*

```
┌────────────────────────────┐
│ ‹ back            Catan  •••│
│ [   game image   ]         │
│ Board & Brew · Berlin      │
│ Sat 7 Aug · 18:00–20:00    │
│ Language: EN               │
│                            │
│ Status: 🟢 Confirmed        │
│ Seats: ●●○○  2/4            │
│ Waitlist: 1                │
│                            │
│ Players: Alice(host), Bob  │
│                            │
│ [   Reserve a seat   ]     │
└────────────────────────────┘
```

- **Primary action adapts to state:**
  - not confirmed by venue → button disabled + hint "Waiting for venue to confirm".
  - space free → `Reserve a seat`.
  - full → `Join waitlist` (shows position after).
  - already seated → `Cancel seat` (with a warning if within 24h → late-cancel mark).
- **States:** each table status; full vs open; own-seat vs not; error `409`/`403` toasts.
- **API:** `GET /api/tables/{id}`, `POST /api/tables/{id}/seats`, `POST /api/tables/{id}/seats/cancel`.

---

## 4. Create a table (host) — *(stories 1, 4, 6, 29; FR-B1)*

```
┌────────────────────────────┐
│ ‹ back      Create table    │
│ Venue      ( Board & Brew ▾)│
│ Date       ( Sat 7 Aug   ▾ )│
│ From ( 18:00 )  To ( 20:00 )│
│ Players  min (2)  max (4)   │
│ Game     ( Catan )          │
│ Who brings the game?        │
│  (•) I bring it             │
│      Language ( EN ▾ )      │
│  ( ) Use a venue game       │
│      Game ( pick ▾ )        │
│                            │
│ [   Request table   ]      │
└────────────────────────────┘
```

- Host is auto-seated; table starts `waiting_for_venue_confirmation`.
- **Bring-own** → language EN/DE (Other allowed). **Venue game** → venue must confirm availability.
- **Validation:** to > from; max ≥ min ≥ 1; required game.
- **Note:** only a `USER` sees Create (a `VENUE_USER` cannot host — hide/disable).
- **API:** `POST /api/tables`.

---

## 5. My profile — *(stories 10, 20, 23, 26; FR-A2, FR-A3, FR-B11)*

```
┌────────────────────────────┐
│ Me                     •••  │
│      ( avatar )            │
│      Alice                 │
│      ★ 4.8                  │
│      ⚑ 0 late cancels      │
│                            │
│  [ Change avatar ]         │
│                            │
│  Upcoming                  │
│  • Catan · Sat 7 Aug       │
│  Organized                 │
│  • Catan · Sat 7 Aug       │
└────────────────────────────┘
```

- Public view of **other** users shows only avatar, name, rating, active late-cancel marks (privacy, `NFR-1`).
- **API:** `GET /api/auth/me`, `GET /api/users/{id}` (later), `PATCH /me/avatar` (later).

---

## 6. Venue admin — requests & capacity — *(stories 34, 35, 41; FR-C1, FR-C2, FR-C3)*

```
┌────────────────────────────┐
│ Venue: Board & Brew        │
│ [Requests] [Calendar] [•••]│
├────────────────────────────┤
│ Pending requests           │
│ ┌────────────────────────┐ │
│ │ Catan · Sat 7 · 18–20  │ │
│ │ Host: Alice · own game │ │
│ │ [ Reject ]  [ Confirm ]│ │
│ └────────────────────────┘ │
│ ┌────────────────────────┐ │
│ │ Carcassonne (venue game)│ │
│ │ needs game confirmation │ │
│ │ [ Reject ]  [ Confirm ]│ │
│ └────────────────────────┘ │
└────────────────────────────┘
```

- **Confirm** checks table availability + (for venue games) game availability; enforces the 15‑min turnover; moves status to `waiting_for_players`.
- **Calendar tab:** all events at the venue in one view; **Availability** editor sets days/times/#tables.
- **States:** empty queue; capacity-conflict error (`409`) on confirm.
- **API:** `GET /api/venues/{id}/availability`, `POST …/availability`, `POST /api/tables/{id}/confirm|reject`.

---

## Flow summary

```
Sign up → Browse → (Create table → venue Confirms) → Reserve seat / Join waitlist → Confirmed
                                   └ Venue admin: Requests → Confirm/Reject, Availability
```

## Open questions for the owner (raise to Consultant)

- Exact avatar set and brand palette/logo (needed for high-fidelity Figma).
- Copy tone for EN/DE and who approves translations.
- Whether payment appears in the Priority‑0 reserve flow or a later phase screen.
