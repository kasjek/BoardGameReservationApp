# AGENTS.md

BoardGameReservationApp — a social table-booking app. See `docs/` for the source of
truth: `Vision.md`, `UserStories.md`, `Requirements.md`, `Permissions.md`,
`Architecture.md`, `Database.md`, `API.md`, `Roadmap.md`, `Decisions.md` (ADRs).
Custom subagents live in `.cursor/agents/` (architect, consultant, developer, tester,
designer, penetration-tester, release-manager).

## Repository layout

- `backend/` — Django + Django REST Framework API (Python, `uv`). PostgreSQL in
  staging/prod; SQLite locally.
- `frontend/` — Next.js (app router) + TypeScript + Tailwind, mobile-first web client.
- `docs/` — planning docs and ADRs. `docs/design/` — screen specs + HTML mockups.

## Cursor Cloud specific instructions

The startup update script runs `uv sync` (backend) and `pnpm install` (frontend); it also
bootstraps `uv` if missing (not on the base image). `pnpm` is preinstalled. After the
script runs you do NOT need to reinstall dependencies.

### Backend (`backend/`)

- `uv` installs to `~/.local/bin`; if `uv` is not on `PATH`, use `~/.local/bin/uv` or add it to `PATH`.
- Run commands with `uv run` (auto-uses the project venv), e.g. from `backend/`:
  - Migrate: `uv run python manage.py migrate`
  - Dev server: `uv run python manage.py runserver 127.0.0.1:8000`
  - Tests: `uv run pytest`  ·  Lint: `uv run ruff check .`
- **Database:** settings read `DATABASE_URL`. When it is unset it falls back to
  **SQLite** (`backend/db.sqlite3`, gitignored) so tests/dev run with no DB server.
  PostgreSQL is the real target (`docker compose up -d` in `backend/` + `.env`).
  Non-obvious: `select_for_update` (the seat-capacity lock, `ADR-011`) is a **no-op on
  SQLite** and only truly enforced on PostgreSQL; the tests validate the functional
  logic, not the locking.
- Auth is DRF **token** auth. `POST /api/auth/register` always creates a `USER`;
  promotion to `VENUE_USER`/`ADMIN` is done via the Django admin or a shell.

### Frontend (`frontend/`)

- Package manager is **pnpm**. Dev: `pnpm dev` (port **3000**). Typecheck/build: `pnpm build`.
- The browser calls `/api/*`, which Next.js **proxies to the backend** via
  `next.config.mjs` rewrites (avoids CORS). Set `BACKEND_URL` (default
  `http://127.0.0.1:8000`). **Start the backend first**, otherwise API calls 502.

### Non-obvious domain rules (enforced server-side; will trip up manual testing)

- Hosting a table and reserving a seat are **`USER`-only** actions — a `VENUE_USER`
  gets `403`. `ADMIN` can do everything.
- A new table starts `waiting_for_venue_confirmation`; **other users cannot book seats
  until the venue confirms it** (`403`/`409` before then). The venue account confirms
  from the "Venue" tab.
- Confirming a table requires a `VenueAvailability` row covering the table's date/time,
  and enforces a **15-minute turnover** between tables at the same venue — so to make a
  table confirmable you must first seed availability for that venue/date. When full,
  new reservations become **waitlisted** (not rejected).

### Quick local run (both services)

```bash
# terminal 1
cd backend && uv run python manage.py migrate && uv run python manage.py runserver 127.0.0.1:8000
# terminal 2
cd frontend && BACKEND_URL=http://127.0.0.1:8000 pnpm dev   # http://127.0.0.1:3000
```
