# Architecture picture (production GoDaddy deploy)

This document is the **visual map of what we actually run today** on GoDaddy:
one Node process that serves the Next.js UI and an embedded REST API over SQLite.

The older target design (Django + PostgreSQL modular monolith) remains in
`docs/Architecture.md`. Prefer **this file** when reasoning about the live app,
deploy ZIP, BGG search/covers, and request flows.

Rendered PNGs (same diagrams): [`docs/architecture/`](./architecture/).

---

## 1. Big picture — who talks to what

![Big picture](./architecture/arch_01-big-picture.png)

```mermaid
flowchart LR
  subgraph people ["People"]
    player["Player / Host USER"]
    venue["Venue admin VENUE_USER"]
    admin["Platform ADMIN"]
  end

  subgraph godaddy ["GoDaddy Node Hosting"]
    browser["Browser"]
    nodeProc["server.js one process"]
    sqlite[("data/app.sqlite3")]
  end

  subgraph outside ["External"]
    bgg["BoardGameGeek XML API"]
    geekdo["Geekdo item API"]
    wiki["Wikipedia"]
  end

  player --> browser
  venue --> browser
  admin --> browser
  browser -->|"HTTPS pages + /api/*"| nodeProc
  nodeProc -->|"read/write"| sqlite
  nodeProc -.->|"BGG_API_TOKEN Bearer search / thing / cover"| bgg
  nodeProc -.->|"cover fallback"| geekdo
  nodeProc -.->|"cover fallback"| wiki
```

**Why this shape**

| Choice | Why |
|--------|-----|
| One Node process | GoDaddy Node hosting is one app; no second Django dyno or `BACKEND_URL` |
| SQLite file on disk | No managed Postgres required; DB appears on first `npm start` |
| Same origin `/api/*` | Browser calls relative `/api/...`; no CORS, no reverse-proxy rewrite to Django |
| BGG as external | Game catalog + covers live on BGG; we cache thumbs on `venue_games` when we can |

---

## 2. Inside the process — request routing

![Request routing](./architecture/arch_02-request-routing.png)

```mermaid
flowchart TB
  req["Incoming HTTP request"]
  decide{"pathname starts with /api?"}
  api["api/handler.js REST"]
  nextUi["Next.js App Router UI frontend/"]
  dbMod["api/db.js better-sqlite3"]
  bggMod["api/bgg.js search thing cover"]
  store[("SQLite")]

  req --> decide
  decide -->|"yes"| api
  decide -->|"no pages assets"| nextUi
  api --> dbMod
  api --> bggMod
  dbMod --> store
  bggMod --> store
  nextUi -->|"browser fetch /api/* same host"| api
```

**Entry:** `server.js` creates one `http.Server`.

1. `/api` or `/api/...` → `handleApi` in `api/handler.js`
2. Everything else → Next.js request handler (`frontend/`)

Frontend `api.ts` calls `/api/...` with optional `Authorization: Token <key>`.
BGG routes get a longer client timeout (25s) because search XML can be large.

---

## 3. Auth flow — how identity moves

![Auth flow](./architecture/arch_05-auth.png)

```mermaid
sequenceDiagram
  participant U as Browser
  participant API as api/handler.js
  participant DB as SQLite

  U->>API: POST /api/auth/register or login
  API->>DB: create/find user + insert token
  API-->>U: user + token
  Note over U: store token in localStorage
  U->>API: later requests Authorization Token
  API->>DB: resolve token to user + role
  API-->>U: 200 data or 401/403
```

Roles enforced in the API (not only in the UI):

- **USER** — host tables, reserve seats
- **VENUE_USER** — confirm/reject tables, manage venue games/hours (cannot host/reserve as a player)
- **ADMIN** — both worlds

---

## 4. Core domain — create table → venue confirm → seats

![Table lifecycle](./architecture/arch_03-table-lifecycle.png)

```mermaid
sequenceDiagram
  participant Host as Host USER
  participant API as API + SQLite
  participant Venue as Venue admin
  participant Guest as Other USER

  Host->>API: POST /api/tables game time venue
  API->>API: status waiting_for_venue_confirmation seat host
  API-->>Host: table created
  Note over Guest: cannot book yet 403/409
  Venue->>API: POST /api/tables/id/confirm
  API->>API: need VenueAvailability + 15min turnover
  API->>API: status waiting_for_players
  Guest->>API: POST /api/tables/id/seats
  API->>API: if full then waitlisted else seated
  API->>API: when seats >= min_players then confirmed
```

**Why these gates exist**

| Rule | Why |
|------|-----|
| Start as `waiting_for_venue_confirmation` | Venue must accept the booking before strangers fill seats |
| Availability + 15‑minute turnover | Prevents overlapping tables at the same venue |
| Waitlist instead of hard reject | Full tables still capture demand; cancel promotes next waitlisted seat |

---

## 5. BGG — search dropdown + covers

![BGG search and covers](./architecture/arch_04-bgg-search-cover.png)

```mermaid
flowchart TB
  ui["New table / Venue manage game picker"]
  searchApi["GET /api/bgg/search?q=&limit=500"]
  live["api/bgg.js liveSearch"]
  token{"BGG_API_TOKEN set?"}
  xml["BGG XML search up to ~1000 ranked hits"]
  local["SQLite venue_games title LIKE fallback"]
  rank["Rank exact then prefix then contains"]
  dropdown["Dropdown results"]

  coverUi["Game cover image"]
  coverApi["GET /api/bgg/cover?name="]
  coverRes["resolveCoverUrl"]
  known{"venue_games has thumb or bgg_id?"}
  thing["BGG thing / Geekdo by id"]
  wikiFb["Wikipedia thumbnail"]
  cache["UPDATE venue_games.thumbnail_url"]

  ui --> searchApi --> live --> token
  token -->|yes| xml --> rank --> dropdown
  token -->|no| local --> rank

  coverUi --> coverApi --> coverRes --> known
  known -->|cached url| coverUi
  known -->|bgg_id| thing --> cache
  known -->|no id| wikiFb
```

**Why search was “missing” games like ICE**

BGG can return hundreds of hits for a short query. An old hard cap (~40) dropped
exact titles that sorted late. Today we request up to **500** (API max **1000**)
and **rank exact/prefix matches first**.

**Why covers must not search on every image**

Calling live BGG search from `/api/bgg/cover` for each card hammered BGG and
starved the Node process (timeouts on login/API). Covers now use a known
`bgg_id` / cached thumb, then Geekdo/Wikipedia — not a fresh search per pixel.

---

## 6. Data at rest — SQLite tables that matter

```mermaid
erDiagram
  users ||--o{ tokens : has
  users ||--o{ tables : organizes
  users ||--o{ seats : sits
  venues ||--o{ tables : hosts
  venues ||--o{ venue_games : inventory
  venues ||--o{ venue_availability : opens
  venues ||--o{ venue_hours : weekly
  venues ||--o{ venue_closures : blocks
  tables ||--o{ seats : capacity
  users ||--o{ reviews : writes
  venues ||--o{ reviews : about

  users {
    int id
    string username
    string role
  }
  tokens {
    string key
    int user_id
  }
  venues {
    int id
    string name
  }
  venue_games {
    int id
    int bgg_id
    string title
    string thumbnail_url
  }
  tables {
    int id
    string status
    string game_title
    int bgg_id
  }
  seats {
    int id
    string status
  }
```

---

## 7. Deploy shape (what goes on GoDaddy)

```mermaid
flowchart LR
  zip["GitHub ZIP branch cursor/godaddy-single-node-4187"]
  host["GoDaddy Node app"]
  install["npm install"]
  build["npm run build frontend"]
  start["npm start = node server.js"]
  env["Env BGG_API_TOKEN PORT"]
  data["data/app.sqlite3 created on first start"]

  zip --> host --> install --> build --> start
  env -.-> start
  start --> data
```

**Not on GoDaddy:** Django `backend/`, Postgres, `BACKEND_URL` proxy.

**Still in the monorepo for history/local experiments:** `backend/` (Django). The
production ZIP / start path is the Node stack above.

---

## 8. Mental model in one sentence

**Browser → `server.js` → either Next.js pages or `api/handler.js` → SQLite for app
state, BoardGameGeek (with token) for game search/metadata/covers.**

Roles and table-status rules live in the API so the UI cannot bypass venue
confirmation or seat capacity.
