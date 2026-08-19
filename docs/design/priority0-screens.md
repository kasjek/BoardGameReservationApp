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
│            or              │
│   ( Email )                │
│   ( Password )             │
│                            │
│   [   Log in   ]           │
│                            │
│   New here?  Sign up ›     │
└────────────────────────────┘
```

- **Sign up** collects display name, email, password → creates a `USER`.
- **Google** uses Google Identity Services; the API verifies the ID token and creates/links a `USER`.
- **States:** idle, loading, invalid-credentials error, field validation, Google not configured (button hidden).
- **API:** `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/google/config`, `POST /api/auth/google` → store token; route to Browse.

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
- **Status chip** color-codes table status (requested / available / confirmed unpaid / confirmed paid / cancelled).
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
│ Status: 🟢 Confirmed & paid │
│ Seats: ●●○○  2/4            │
│ Waitlist: 1                │
│                            │
│ Players: Alice(host), Bob  │
│          [Pay] under you   │
│                            │
│ [   Reserve a seat   ]     │
└────────────────────────────┘
```

- **Primary action adapts to state:**
  - not confirmed by venue → button disabled + hint "Waiting for venue to confirm".
  - space free → `Reserve a seat`.
  - full → `Join waitlist` (shows position after).
  - already seated (venue game, unpaid) → `Pay` under your own seat (opens PayPal; table stays `Confirmed & unpaid` until everyone seated has paid).
  - already seated → `Cancel seat` (with a warning if within 24h → late-cancel mark).
- **States:** each table status; full vs open; own-seat vs not; paid vs unpaid; error `409`/`403` toasts.
- **API:** `GET /api/tables/{id}`, `POST /api/tables/{id}/seats`, `POST /api/tables/{id}/seats/pay`, `POST /api/tables/{id}/seats/cancel`.

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

- Host is auto-seated; table starts `requested`. Payment is **not** collected at create time.
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

- Public view of **other** users shows avatar, username, rating, active late-cancel marks, games played, and different games (no email).
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

- **Confirm** checks table availability + (for venue games) game availability; enforces the 15‑min turnover; moves status to `available`.
- **Calendar tab:** all events at the venue in one view; **Availability** editor sets days/times/#tables.
- **States:** empty queue; capacity-conflict error (`409`) on confirm.
- **API:** `GET /api/venues/{id}/availability`, `POST …/availability`, `POST /api/tables/{id}/confirm|reject`.

---

## 8. Find friends — *(stories 14, 27; FR-E1)*

```
┌────────────────────────────┐
│  All Tables  New  Bookings │  ← purple menu
├────────────────────────────┤
│ ( Search friends by login )│  ← under the menu, every signed-in screen
├────────────────────────────┤
│ Results for “alice”        │
│ ┌────────────────────────┐ │
│ │ ☺ alice     [Add friend]│ │
│ └────────────────────────┘ │
│                            │
│ Own profile:               │
│ Friends                    │
│  ☺ alice                   │
└────────────────────────────┘
```

- Search is **by login (username)** only — never email.
- **Add friend** sends a request; the other person **Accepts** on their profile or the Find friends page. Adding someone who already requested you accepts it.
- Own `/profile` lists **your** friends (avatars + logins). Tapping a friend opens their public profile.
- **API:** `GET /api/users?q=`, `POST /api/friends/requests`, `GET /api/friends`, `POST …/accept|reject`.

---

## 9. Private chat — *(story 12; FR-E5)*

```
┌────────────────────────────┐
│  All Tables  New  Bookings │
│ (search) [Search] [Chats]  │
├────────────────────────────┤
│ Chats                      │
│ ┌────────────────────────┐ │
│ │ ☺ alice                │ │
│ │ You: See you at 11:00  │ │
│ └────────────────────────┘ │
│                            │
│ Thread with alice          │
│   [See you at 11:00] →     │
│ ← [Yes!]                   │
│ ( Write a message… ) [Send]│
└────────────────────────────┘
```

- Start a chat from a public profile (**Message**) or from a friend on your profile.
- Threads are private to the two users; email is never shown.
- **API:** `GET /api/chats`, `GET|POST /api/chats/{userId}`.

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
