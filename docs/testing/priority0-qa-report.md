# QA Report — Priority-0 (top 10 features)

Owner: **tester** (with **penetration-tester** security input). Scope: the 10 Priority-0
features delivered in the backend (`backend/`) and frontend (`frontend/`).

## Result: PASS (with 2 minor follow-ups)

## Automated tests

- Backend: **24 passing** (`uv run pytest`), `ruff` clean.
  - Role rules: host/reserve are `USER`-only; `VENUE_USER` blocked; venue-confirm requires venue/admin.
  - Venue-first confirmation gating (`409` before confirm).
  - Capacity guard, duplicate-seat prevention, waitlist + auto-promotion.
  - Late-cancellation mark within 24h; none when >24h.
  - 15-minute venue turnover; venue-game confirmation.
  - Organizer-cancels-table; non-organizer cannot.
  - **Authorization (added this pass):** venue list scoped to own venue; `organizerId`/`attendeeId` restricted to self/admin (403 otherwise, incl. anonymous).
- Frontend: `pnpm build` passes (types valid, 9 routes).

## Manual / end-to-end verification

- Browser (recorded): register → create table → venue confirm → reserve → **Confirmed 2/4**; role gating (`403` VENUE_USER reserve) and venue-first gating (`409`) observed.
- HTTP (this pass) — waitlist + promotion + cancel on a `max_players=2` table:
  - fill to 2/2 → third user **waitlisted (pos 1)** → a reserved user cancels → waitlisted user **auto-promoted** (re-reserve returns `409` "already has active seat"), table stays `confirmed` at 2 seats. ✅

## Security (penetration-tester) findings & status

| Sev | Finding | Status |
|---|---|---|
| HIGH | `VENUE_USER` could list tables at other venues | **Fixed** — list scoped by role |
| MED | `organizerId`/`attendeeId` cross-user enumeration | **Fixed** — auth + self/admin only |
| MED | Insecure `SECRET_KEY`/`DEBUG` prod defaults | **Fixed** — fail-fast when `DEBUG=off` |
| MED | No rate limiting on login/register | **Fixed** — scoped throttles |
| LOW | Non-expiring token in `localStorage` | Follow-up (later phase) |

Write paths (confirm/reject/cancel/reserve/cancel-seat) and business rules were found well-enforced; no SQLi/XSS sinks in the diff.

## Follow-ups (not blocking)

1. **Feature 3 UI gap:** no in-app screen to create a venue / edit availability yet (done via Django admin/seed). Addressed by the venue availability-editor UI in the next developer batch.
2. Token hardening (expiry/rotation) and profile privacy fields fully surfaced — later phases.
