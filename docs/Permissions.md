# Permissions

Defines user types (roles) and what each may do in BoardGameReservationApp.

Aligned with `docs/Vision.md`: people who **create a table**, people who **reserve a seat** at an existing table, **venue owners**, and **admins**.

## Roles

| Role | Code | Description |
|---|---|---|
| User | `USER` | Standard player — lowest privilege level |
| Venue User | `VENUE_USER` | Staff/owner for a specific cafe or restaurant |
| Admin | `ADMIN` | Platform superuser |

## Inheritance rules

- **`USER`** — base player rights only.
- **`VENUE_USER`** — **does not** inherit from `USER` or from `ADMIN`. Separate, venue-scoped rights only.
- **`ADMIN`** — has **all `USER` rights** **and all `VENUE_USER` rights** (across **every** venue, not just one), plus additional global superpowers (add / edit / delete **any part of the application**).

`VENUE_USER` remains a **parallel**, venue-scoped role that does **not** inherit `USER`.  
`ADMIN`, however, is a superset of **both** `USER` and `VENUE_USER`: it can do anything either of those roles can do, and adds global add/edit/delete on top. So while `USER < VENUE_USER < ADMIN` is **not** a strict ladder (`VENUE_USER` is not a superset of `USER`), `ADMIN` sits above **both** other roles.

## Registration and login

- Self-registration creates a **`USER`** account.
- Login returns the account’s role (and venue link for `VENUE_USER`).
- Promotion to **`VENUE_USER`** or **`ADMIN`** is done by an **`ADMIN`** only (no self-serve upgrade in v1).
- A **`VENUE_USER`** is linked to **one specific venue** (their restaurant/cafe). Access is limited to that venue’s tables and visiting users.

## Permission matrix

| Action | USER | VENUE_USER | ADMIN |
|---|---|---|---|
| Register / login | yes | yes | yes |
| View all tables | yes | no — **own venue only** | yes (via USER + VENUE_USER rights + global) |
| Filter tables | yes | own venue only | yes |
| Create a table | yes | own venue only | yes |
| Edit a table | **own tables only** | tables at own venue | **any** |
| Remove / delete a table | **own tables only** | tables at own venue | **any** |
| Reserve a seat at an existing table | yes | no (unless also a USER account — not inherited) | yes (as USER) |
| View users visiting a venue | no (except self / own bookings as needed) | **own venue only** | **all venues** |
| Manage venue capacity / operations | no | **own venue only** | **all venues** |
| Add / edit / delete any other resource (users, roles, venues, settings, etc.) | no | no | **yes** |

## Notes

1. **Create table** vs **reserve a seat** are different actions (see Vision principles). A `USER` may create a table and may also reserve a seat at someone else’s table.
2. **`VENUE_USER`** only sees and manages data for **their** restaurant/cafe — not the whole platform.
3. **`ADMIN`** can do everything a `USER` can **and everything a `VENUE_USER` can (for every venue, not a single one)**, and can also add, edit, and delete anything across the system.
4. Backend must enforce these rules; hiding UI alone is not enough.

## Open points (to refine later)

- Exact fields when creating a table (capacity, date/time, venue, game, etc.)
- Whether one person may hold more than one role (e.g. `ADMIN` + venue link)
- Whether `VENUE_USER` needs a separate `USER` account to book as a player
- Seat-reservation permissions in more detail (cancel own seat, waitlist, etc.)
