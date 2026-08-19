# BoardGameReservationApp — Backend

Django + Django REST Framework backend (per `docs/Decisions.md` ADR-010 / ADR-014).
This is the **Priority‑0** slice: accounts/auth, venues + availability, tables, and seat
reservations with the capacity guard, waitlist, venue-first confirmation, and
late-cancellation marks.

## Stack

- Python 3.12, Django 5, Django REST Framework
- PostgreSQL (staging/production). Local test runs fall back to SQLite when
  `DATABASE_URL` is unset, so the suite runs without a DB server.
- Tooling: `uv` (deps), `ruff` (lint), `pytest` + `pytest-django` (tests)

## Setup

```bash
uv sync                       # create the venv and install deps
# Optional: real Postgres locally
docker compose up -d
cp .env.example .env          # sets DATABASE_URL for Postgres
uv run python manage.py migrate
uv run python manage.py runserver
```

Without Postgres, just run `uv run python manage.py migrate` (uses SQLite).

## Test & lint

```bash
uv run pytest
uv run ruff check .
```

## API (Priority‑0)

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET /api/auth/google/config`, `POST /api/auth/google` (set `GOOGLE_CLIENT_ID` for GIS)
- `GET/POST /api/venues`, `GET /api/venues/{id}`, `GET/POST /api/venues/{id}/availability`
- `GET/POST /api/tables`, `GET /api/tables/{id}`
- `POST /api/tables/{id}/confirm`, `POST /api/tables/{id}/reject`
- `POST /api/tables/{id}/seats`, `POST /api/tables/{id}/seats/cancel`

Business rules (capacity, waitlist, venue-first confirmation, 15-min turnover,
late-cancellation marks) are enforced in `apps/tables/services.py` per
ADR-002/007/011/013.

## Notes / next steps

- `Game` is a simple `game_title` field in this slice; the full game catalog +
  per-venue inventory (`docs/Database.md`) comes in a later phase.
- Payments, social, reviews, chat, and moderation are later roadmap phases.
