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

- **`USER`** — base player rights only. **Only a `USER` may host/request a table or reserve a seat.**
- **`VENUE_USER`** — **does not** inherit from `USER` or from `ADMIN`. Separate, venue-scoped rights only. In particular, a `VENUE_USER` **cannot host/request tables or reserve seats** — those are `USER`-only actions. A person who both runs a venue and wants to play needs a **separate `USER` account** (or `ADMIN`, which holds all roles).
- **`ADMIN`** — **holds all roles**: has **all `USER` rights** **and all `VENUE_USER` rights** (across **every** venue, not just one), plus additional global superpowers (add / edit / delete **any part of the application**).

`VENUE_USER` remains a **parallel**, venue-scoped role that does **not** inherit `USER`.  
`ADMIN`, however, is a superset of **both** `USER` and `VENUE_USER`: it can do anything either of those roles can do (including hosting/reserving via its `USER` rights), and adds global add/edit/delete on top. So while `USER < VENUE_USER < ADMIN` is **not** a strict ladder (`VENUE_USER` is not a superset of `USER`), `ADMIN` sits above **both** other roles.

## Registration and login

- Self-registration creates a **`USER`** account.
- **Google sign-in** also creates a **`USER`** (or logs into an existing account with the same verified email).
- Login returns the account’s role (and venue link for `VENUE_USER`).
- Promotion to **`VENUE_USER`** or **`ADMIN`** is done by an **`ADMIN`** only (no self-serve upgrade in v1).
- A **`VENUE_USER`** is linked to **one specific venue** (their restaurant/cafe). Access is limited to that venue’s tables and visiting users.

## Permission matrix

| Action | USER | VENUE_USER | ADMIN |
|---|---|---|---|
| Register / login | yes | yes | yes |
| View all tables | yes | no — **own venue only** | yes (via USER + VENUE_USER rights + global) |
| Filter tables | yes | own venue only | yes |
| Host / request a table | yes | **no** (USER-only action) | yes (via USER rights) |
| Edit a table | **own tables only** | venue-side management of tables at own venue (accept/reject/cancel) | **any** |
| Remove / delete a table | **own tables only** | cancel/reject tables at own venue | **any** |
| Reserve a seat at an existing table | yes | **no** — needs a separate USER account (not inherited) | yes (as USER) |
| View public profile of a user at a table | yes | yes | yes |
| Search users by login and add friends | yes | yes | yes |
| Private 1:1 chat with another user | yes | yes | yes |
| Manage venue capacity / operations | no | **own venue only** | **all venues** |
| Add / edit / delete any other resource (users, roles, venues, settings, etc.) | no | no | **yes** |

## Notes

1. **Host/request a table** vs **reserve a seat** are different actions (see Vision principles), but **both are `USER`-only**. A `USER` may host a table and may also reserve a seat at someone else’s table. A `VENUE_USER` may do **neither** (their role is venue operations only).
2. **`VENUE_USER`** only sees and manages data for **their** restaurant/cafe — not the whole platform.
3. **`ADMIN`** holds all roles: it can do everything a `USER` can **and everything a `VENUE_USER` can (for every venue, not a single one)**, and can also add, edit, and delete anything across the system.
4. Backend must enforce these rules; hiding UI alone is not enough.

## Resolved decisions

- **Table creation fields** — defined in `docs/Requirements.md` FR-B1 (min/max capacity, date, from/to time, game, bring-own + language or venue game). *(decision 4)*
- **Multiple roles** — only `ADMIN` holds more than one role (all of them). `USER` and `VENUE_USER` are single, non-inherited roles. *(decision 5)*
- **VENUE_USER playing** — a `VENUE_USER` needs a **separate `USER` account** to host or reserve. *(decision 6)*
- **Seat cancellation, waitlist & late-cancel marks** — see `ADR-013` in `docs/Decisions.md`. *(decision 7)*
