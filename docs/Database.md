# Database

## Overview

Relational model (PostgreSQL — see `ADR-010`) for a social table-booking product: **users** create **tables** (board game events) at **venues**, other users **reserve seats**, **venue admins** confirm and manage capacity, and the platform supports payments, reviews, friends, chat, and moderation.

This model reflects `docs/UserStories.md` and `docs/Requirements.md`. It supersedes the earlier game-copy "library" model (see `ADR-001` in `docs/Decisions.md`).

Each entity below is shown as **(1)** a column definition table and **(2)** example rows. All example rows share one scenario so the model is easy to follow:

- Users: **Alice** (`u_1`), **Bob** (`u_2`), **Carol** (`u_3`, staff at Board & Brew), **Dan** (`u_4`, admin), **Erin** (`u_5`).
- Venue: **Board & Brew** (`v_1`) in Berlin.
- Table: Alice hosts a **Catan** night (`t_1`) at Board & Brew; Bob reserves a seat.

> IDs are shown as short readable strings (`u_1`, `t_1`) for readability; in the database they are UUIDs.

## Entities

### User

Accounts and roles. *(stories 9, 10, 17, 23, 26, 53, 54)*

| Column | Type | Description |
|---|---|---|
| `id` | uuid (PK) | Unique user id |
| `email` | text (unique) | Login email |
| `display_name` | text | Public name |
| `avatar_id` | text | Chosen avatar from allocated set |
| `role` | enum(`USER`,`VENUE_USER`,`ADMIN`) | Access level |
| `venue_id` | uuid (FK→Venue, null) | Linked venue for `VENUE_USER` |
| `allow_invites` | bool | Whether others may invite them to tables |
| `rating_avg` | numeric(2,1) | Derived from received reviews |
| `cancellations_count` | int | Derived; visible to others |
| `late_cancel_marks_active` | int | Derived count of non-expired `LateCancellationMark`s; visible to others for 30 days each *(decision 7)* |
| `is_super_user` | bool | Marked "super user" by admin |
| `is_blocked` | bool | Platform-level block |
| `created_at` | timestamptz | Registration time |

| id | email | display_name | avatar_id | role | venue_id | allow_invites | rating_avg | cancellations_count | late_cancel_marks_active | is_super_user | is_blocked |
|---|---|---|---|---|---|---|---|---|---|---|---|
| u_1 | alice@example.com | Alice | av_07 | USER | — | true | 4.8 | 0 | 0 | true | false |
| u_2 | bob@example.com | Bob | av_12 | USER | — | true | 4.5 | 1 | 0 | false | false |
| u_3 | carol@brew.example | Carol | av_03 | VENUE_USER | v_1 | false | 5.0 | 0 | 0 | false | false |
| u_4 | dan@example.com | Dan | av_01 | ADMIN | — | true | 5.0 | 0 | 0 | false | false |
| u_5 | erin@example.com | Erin | av_19 | USER | — | false | 3.9 | 4 | 1 | false | false |

### Venue

A cafe/restaurant that hosts tables. *(stories 3, 36, 53, 54)*

| Column | Type | Description |
|---|---|---|
| `id` | uuid (PK) | Unique venue id |
| `name` | text | Venue name |
| `description` | text | Public short description (create form max 100 characters) |
| `location` | text | Address / city |
| `min_players` | int | Minimum party size for tables at this venue |
| `max_players` | int | Maximum party size for tables at this venue |
| `rating_avg` | numeric(2,1) | Derived from reviews |
| `min_reservation_minutes` | int | Minimum table booking length (minutes) |
| `max_reservation_minutes` | int | Maximum table booking length (minutes) |
| `min_spend` | text (blank) | Short minimum-spend note, e.g. "€10 per person" |
| `booking_horizon_weeks` | int (1–52, default 12) | How many weeks ahead a table can be booked |
| `picture_ext` | text (blank) | File extension of the location picture; served at `GET /venues/{id}/picture` |
| `is_super_location` | bool | Marked "super location" by admin |
| `is_blocked` | bool | Platform-level block |
| `created_at` | timestamptz | Created time |
| `updated_at` | timestamptz | Last update |

| id | name | description | location | min_players | max_players | rating_avg | is_super_location | is_blocked |
|---|---|---|---|---|---|---|---|---|
| v_1 | Board & Brew | Cozy board game cafe with 20+ tables | Berlin, DE | 2 | 8 | 4.7 | true | false |
| v_2 | Meeple Corner | Quiet spot, great coffee | Munich, DE | 2 | 6 | 4.2 | false | false |
| v_3 | Date House Cafe | Board-game-friendly cafe in the old town | Breite G. 88, 90402 Nürnberg | 2 | 8 | — | false | false |
| v_4 | Katzentempel | Vegan cat café restaurant in the old town | Peter-Vischer-Straße 21, 90403 Nürnberg | 2 | 8 | — | false | false |
| v_5 | Hotel Knorz | Family hotel near Playmobil FunPark | Volkhardtstraße 18, 90513 Zirndorf | 2 | 8 | — | false | false |

### VenuePhoto

Images for a venue. *(story 36)*

| Column | Type | Description |
|---|---|---|
| `id` | uuid (PK) | Photo id |
| `venue_id` | uuid (FK→Venue) | Owning venue |
| `url` | text | Object-storage URL |
| `created_at` | timestamptz | Upload time |

| id | venue_id | url |
|---|---|---|
| vp_1 | v_1 | https://cdn.app/venues/v_1/front.jpg |

### VenueAvailability

When and how many tables a venue offers. *(story 34)*

| Column | Type | Description |
|---|---|---|
| `id` | uuid (PK) | Availability id |
| `venue_id` | uuid (FK→Venue) | Owning venue |
| `date` | date | Day offered |
| `start_time` | time | Opening for bookings |
| `end_time` | time | Closing for bookings |
| `tables_available` | int | Concurrent tables bookable |

| id | venue_id | date | start_time | end_time | tables_available |
|---|---|---|---|---|---|
| va_1 | v_1 | 2026-08-15 | 17:00 | 23:00 | 5 |

### VenueRule

Booking rules per venue. *(story 45)*

| Column | Type | Description |
|---|---|---|
| `id` | uuid (PK) | Rule id |
| `venue_id` | uuid (FK→Venue) | Owning venue |
| `max_reservation_minutes` | int (null) | Max table length |
| `food_drink_required` | bool | Must order food/drink |
| `min_spend_per_person` | numeric(6,2) (null) | Minimum spend |
| `notes` | text | Free-text notes |

| id | venue_id | max_reservation_minutes | food_drink_required | min_spend_per_person | notes |
|---|---|---|---|---|---|
| vr_1 | v_1 | 180 | true | 8.00 | One drink per player minimum |

### Game

Global catalog entry. *(story 6)*

| Column | Type | Description |
|---|---|---|
| `id` | uuid (PK) | Game id |
| `title` | text | Game title |
| `description` | text | Summary |
| `image_url` | text | Box art URL |
| `min_players` | int | Minimum players |
| `max_players` | int | Maximum players |
| `created_at` | timestamptz | Created time |

| id | title | description | image_url | min_players | max_players |
|---|---|---|---|---|---|
| g_1 | Catan | Trade, build, settle | https://cdn.app/games/catan.jpg | 3 | 4 |
| g_2 | Carcassonne | Tile-laying classic | https://cdn.app/games/carc.jpg | 2 | 5 |

### VenueGameInventory

Games physically available at a venue. *(stories 29, 38, 44)*

| Column | Type | Description |
|---|---|---|
| `id` | uuid (PK) | Inventory row id |
| `venue_id` | uuid (FK→Venue) | Owning venue |
| `game_id` | uuid (FK→Game) | Catalog game |
| `copies` | int | Number of copies |
| `condition` | enum(`new`,`like_new`,`good`) | Physical condition |
| `language` | text | Copy language |
| `is_active` | bool | Currently offered |

| id | venue_id | game_id | copies | condition | language | is_active |
|---|---|---|---|---|---|---|
| vgi_1 | v_1 | g_1 | 2 | like_new | en | true |
| vgi_2 | v_1 | g_2 | 1 | good | de | true |

### Table (Event)

The core booking unit — a hosted board game event. *(stories 1, 4, 33)*

| Column | Type | Description |
|---|---|---|
| `id` | uuid (PK) | Table id |
| `organizer_id` | uuid (FK→User) | Host |
| `venue_id` | uuid (FK→Venue) | Location |
| `game_id` | uuid (FK→Game, null) | Game played (venue's game or the host's own; null only if not yet chosen) |
| `bring_own_game` | bool | `true` = host brings the game; `false` = uses a venue game (venue must confirm it) *(decision 4)* |
| `game_language` | enum(`en`,`de`,`other`) | Language of the game/event. For host-brought games the choice is English or German *(decision 4)*; `other` retained per story 1 |
| `game_language_other` | text (null) | Free text when `game_language=other` |
| `venue_game_confirmed` | bool | For `bring_own_game=false`: venue confirmed the requested game is available *(decision 4)* |
| `starts_at` | timestamptz | Event start (from) |
| `ends_at` | timestamptz | Event end (to) *(decision 4)* |
| `min_players` | int | Minimum capacity needed to confirm |
| `max_players` | int | Maximum seat capacity |
| `status` | enum(`waiting_for_venue_confirmation`,`waiting_for_players`,`confirmed`,`cancelled`,`completed`) | Lifecycle state |
| `seats_taken` | int | Active-seat counter (capacity guard — `ADR-011`) |
| `created_at` | timestamptz | Created time |
| `updated_at` | timestamptz | Last update |

| id | organizer_id | venue_id | game_id | bring_own_game | game_language | venue_game_confirmed | starts_at | ends_at | min_players | max_players | status | seats_taken |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| t_1 | u_1 | v_1 | g_1 | true | en | — | 2026-08-15 19:00 | 2026-08-15 20:30 | 2 | 4 | confirmed | 2 |
| t_2 | u_5 | v_1 | g_2 | false | de | false | 2026-08-16 18:00 | 2026-08-16 20:00 | 3 | 5 | waiting_for_venue_confirmation | 1 |

### SeatReservation

One user's seat at a table (organizer seated by default). *(stories 2, 4, 21)*

| Column | Type | Description |
|---|---|---|
| `id` | uuid (PK) | Seat id |
| `table_id` | uuid (FK→Table) | The table |
| `user_id` | uuid (FK→User) | The attendee (always a `USER`) |
| `is_organizer` | bool | True for the host's seat |
| `status` | enum(`reserved`,`waitlisted`,`cancelled`) | Seat state *(decision 7)* |
| `waitlist_position` | int (null) | Order in the waitlist when `status=waitlisted` *(decision 7)* |
| `created_at` | timestamptz | Reserved/queued time |
| `cancelled_at` | timestamptz (null) | Cancellation time |

| id | table_id | user_id | is_organizer | status | waitlist_position | created_at | cancelled_at |
|---|---|---|---|---|---|---|---|
| sr_1 | t_1 | u_1 | true | reserved | — | 2026-08-10 12:00 | — |
| sr_2 | t_1 | u_2 | false | reserved | — | 2026-08-11 09:30 | — |
| sr_3 | t_1 | u_5 | false | cancelled | — | 2026-08-11 10:00 | 2026-08-15 09:00 |
| sr_4 | t_1 | u_4 | false | waitlisted | 1 | 2026-08-11 11:00 | — |

> `sr_4` is illustrative of a full table: when a `reserved` seat is cancelled, the earliest `waitlisted` user (lowest `waitlist_position`) is auto-promoted to `reserved` and notified (`ADR-013`).

### LateCancellationMark

A mark placed on a user's profile for cancelling within 24h of the event; visible to others for 30 days, then expires. *(story 23, decision 7; see `ADR-013`)*

| Column | Type | Description |
|---|---|---|
| `id` | uuid (PK) | Mark id |
| `user_id` | uuid (FK→User) | User who cancelled late |
| `table_id` | uuid (FK→Table) | Table cancelled from |
| `created_at` | timestamptz | When the late cancellation happened |
| `expires_at` | timestamptz | `created_at + 30 days`; mark hidden after this |

| id | user_id | table_id | created_at | expires_at |
|---|---|---|---|---|
| lcm_1 | u_5 | t_1 | 2026-08-15 09:00 | 2026-09-14 09:00 |

> A mark is "active" (shown on the public profile) while `now < expires_at`. Cancelling **more than 24h** before the event does **not** create a mark (`story 21`).

### EventPhoto

Photos added by participants after the event. *(story 7)*

| Column | Type | Description |
|---|---|---|
| `id` | uuid (PK) | Photo id |
| `table_id` | uuid (FK→Table) | The event |
| `user_id` | uuid (FK→User) | Uploader |
| `url` | text | Object-storage URL |
| `created_at` | timestamptz | Upload time |

| id | table_id | user_id | url |
|---|---|---|---|
| ep_1 | t_1 | u_2 | https://cdn.app/events/t_1/win.jpg |

### Invitation

In-app invite to join a table. *(story 16)*

| Column | Type | Description |
|---|---|---|
| `id` | uuid (PK) | Invite id |
| `table_id` | uuid (FK→Table) | Target table |
| `inviter_id` | uuid (FK→User) | Who invited |
| `invitee_id` | uuid (FK→User) | Who is invited |
| `status` | enum(`pending`,`accepted`,`declined`) | Invite state |
| `created_at` | timestamptz | Sent time |

| id | table_id | inviter_id | invitee_id | status |
|---|---|---|---|---|
| inv_1 | t_1 | u_1 | u_2 | accepted |
| inv_2 | t_1 | u_1 | u_5 | pending |

### Friendship

Friend request / relationship. *(stories 14, 27)*

| Column | Type | Description |
|---|---|---|
| `id` | uuid (PK) | Friendship id |
| `requester_id` | uuid (FK→User) | Sender |
| `addressee_id` | uuid (FK→User) | Recipient |
| `status` | enum(`pending`,`accepted`,`rejected`) | State |
| `created_at` | timestamptz | Requested time |

| id | requester_id | addressee_id | status |
|---|---|---|---|
| fr_1 | u_1 | u_2 | accepted |
| fr_2 | u_5 | u_1 | pending |

### Block

A user blocking another user. *(story 12)*

| Column | Type | Description |
|---|---|---|
| `id` | uuid (PK) | Block id |
| `blocker_id` | uuid (FK→User) | Who blocks |
| `blocked_id` | uuid (FK→User) | Who is blocked |
| `created_at` | timestamptz | Block time |

| id | blocker_id | blocked_id |
|---|---|---|
| blk_1 | u_2 | u_5 |

### VenueBlock

A venue blocking a user from booking. *(story 42)*

| Column | Type | Description |
|---|---|---|
| `id` | uuid (PK) | Venue-block id |
| `venue_id` | uuid (FK→Venue) | Venue |
| `user_id` | uuid (FK→User) | Blocked user |
| `reason` | text | Reason (notified to admin) |
| `created_at` | timestamptz | Block time |

| id | venue_id | user_id | reason |
|---|---|---|---|
| vblk_1 | v_1 | u_5 | Repeated no-shows |

### ChatMessage

Per-table event chat. *(story 8)*

| Column | Type | Description |
|---|---|---|
| `id` | uuid (PK) | Message id |
| `table_id` | uuid (FK→Table) | The event chat |
| `user_id` | uuid (FK→User) | Author |
| `body` | text | Message text |
| `created_at` | timestamptz | Sent time |

| id | table_id | user_id | body |
|---|---|---|---|
| cm_1 | t_1 | u_1 | Running 5 min late, start without me! |

### Review

Reviews of users and venues (and venue responses). *(stories 5, 20, 37, 39)*

| Column | Type | Description |
|---|---|---|
| `id` | uuid (PK) | Review id |
| `author_id` | uuid (FK→User) | Reviewer |
| `target_type` | enum(`user`,`venue`) | What is reviewed |
| `target_user_id` | uuid (FK→User, null) | Reviewed user |
| `target_venue_id` | uuid (FK→Venue, null) | Reviewed venue |
| `rating` | int (1–5) | Star rating |
| `body` | text | Review text |
| `response_body` | text (null) | Venue admin response |
| `created_at` | timestamptz | Posted time |

| id | author_id | target_type | target_user_id | target_venue_id | rating | body | response_body |
|---|---|---|---|---|---|---|---|
| rev_1 | u_2 | venue | — | v_1 | 5 | Great tables and coffee | Thanks, Bob! |
| rev_2 | u_1 | user | u_2 | — | 4 | Fun to play with | — |

### Payment

Reservation fee payment and refunds. *(stories 30, 31, 32, 50, 51)*

| Column | Type | Description |
|---|---|---|
| `id` | uuid (PK) | Payment id |
| `user_id` | uuid (FK→User) | Payer — **always a `USER`** *(decision 1)* |
| `table_id` | uuid (FK→Table) | Related table |
| `scope` | enum(`full_table`,`per_seat`) | Whole-table payment (by host) or per-seat *(decision 1)* |
| `seat_reservation_id` | uuid (FK→SeatReservation, null) | Related seat (for `per_seat`) |
| `venue_id` | uuid (FK→Venue) | Venue (reporting) |
| `game_id` | uuid (FK→Game, null) | Game (reporting) |
| `provider` | enum(`paypal`,`revolut`) | Payment provider |
| `amount` | numeric(8,2) | Fee amount |
| `currency` | text | ISO currency |
| `status` | enum(`pending`,`succeeded`,`failed`,`refunded`) | Payment state |
| `created_at` | timestamptz | Created time |

| id | user_id | table_id | scope | seat_reservation_id | venue_id | provider | amount | currency | status |
|---|---|---|---|---|---|---|---|---|---|
| pay_1 | u_2 | t_1 | per_seat | sr_2 | v_1 | paypal | 5.00 | EUR | succeeded |
| pay_2 | u_5 | t_1 | per_seat | sr_3 | v_1 | revolut | 5.00 | EUR | refunded |
| pay_3 | u_1 | t_1 | full_table | — | v_1 | paypal | 20.00 | EUR | succeeded |

> A table uses **exactly one** payment mode. The rows above illustrate both: with `per_seat`, each seated user pays for their own seat (`pay_1`, `pay_2`); with `full_table`, the host pays once for the whole table (`pay_3`). `pay_3` is shown as an illustrative alternative arrangement for `t_1`, not in addition to the per-seat rows.

### Report

Abuse reports, bug reports, and feedback. *(stories 11, 18, 19)*

| Column | Type | Description |
|---|---|---|
| `id` | uuid (PK) | Report id |
| `reporter_id` | uuid (FK→User) | Reporter |
| `type` | enum(`abuse`,`bug`,`feedback`) | Report kind |
| `subject_type` | enum(`user`,`venue`,`content`,`app`) (null) | What it is about |
| `subject_id` | uuid (null) | Target id |
| `message` | text | Details |
| `screenshot_url` | text (null) | Attached screenshot |
| `status` | enum(`open`,`reviewing`,`resolved`) | Handling state |
| `created_at` | timestamptz | Filed time |

| id | reporter_id | type | subject_type | subject_id | message | screenshot_url | status |
|---|---|---|---|---|---|---|---|
| rep_1 | u_1 | bug | app | — | Filter crashes on date range | https://cdn.app/rep/rep_1.png | open |
| rep_2 | u_2 | abuse | user | u_5 | Harassing chat messages | — | reviewing |

### Notification

In-app + email notifications, scoped to relevance. *(stories 21, 22, 24, 25, 28, 32, 43, 49, 52)*

| Column | Type | Description |
|---|---|---|
| `id` | uuid (PK) | Notification id |
| `user_id` | uuid (FK→User) | Recipient |
| `type` | text | e.g. `table_changed`, `venue_confirmed`, `payment_result` |
| `table_id` | uuid (FK→Table, null) | Related table |
| `payload` | jsonb | Structured details |
| `channel` | enum(`in_app`,`email`) | Delivery channel |
| `read_at` | timestamptz (null) | When read |
| `created_at` | timestamptz | Created time |

| id | user_id | type | table_id | payload | channel | read_at |
|---|---|---|---|---|---|---|
| n_1 | u_2 | venue_confirmed | t_1 | {"venue":"Board & Brew"} | in_app | 2026-08-12 09:00 |
| n_2 | u_1 | seat_cancelled | t_1 | {"user":"Erin"} | email | — |

## Relationships

- A Venue has many Tables, VenueAvailability rows, VenueRules, VenuePhotos, and VenueGameInventory rows.
- A User (organizer) has many Tables; a Table has many SeatReservations (bounded by `max_players`).
- A User has many SeatReservations, Reviews (authored and received), Payments, and Notifications.
- A Table has many ChatMessages, EventPhotos, Invitations, and (optionally) one or more Payments.
- Friendship and Block are user-to-user; VenueBlock is venue-to-user.

## Keys, enums & constraints

Concrete relational details for implementation. Datastore is PostgreSQL (see `ADR-010`).

### Unique constraints

- `User(email)` unique.
- `SeatReservation(table_id, user_id)` **partial unique WHERE `status = 'reserved'`** — a user cannot hold two active seats at the same table (duplicate join → `409`).
- `VenueGameInventory(venue_id, game_id, language)` unique.
- `Friendship(requester_id, addressee_id)` unique; `Block(blocker_id, blocked_id)` unique; `VenueBlock(venue_id, user_id)` unique.

### Concurrency & integrity (see `ADR-011`)

- **Seat capacity:** reserving a seat runs in a transaction that takes `SELECT ... FOR UPDATE` on the `Table` row, checks `seats_taken < max_players`, inserts the `SeatReservation`, and increments `seats_taken`. When full, the user is added as `waitlisted` instead. Over-capacity errors → `409`.
- **Venue capacity + 15-min turnover:** when a venue confirms a table, count pending/confirmed `Table`s at that venue whose `[starts_at, ends_at]` windows fall within **15 minutes** of the requested one, and require the total to be `< venue_availability.tables_available`. Slots therefore start at least 15 minutes apart *(decision 3)*. Conflict → `409`.
- **Venue confirmation covers the game:** for `bring_own_game=false`, the venue confirms `venue_game_confirmed` (requested game available in `VenueGameInventory`) as part of accepting *(decision 4)*.
- **Waitlist promotion:** cancelling a `reserved` seat promotes the lowest-`waitlist_position` `waitlisted` seat to `reserved` in the same transaction *(decision 7; `ADR-013`)*.
- **Late cancellation:** cancelling within 24h of `starts_at` writes a `LateCancellationMark` (`expires_at = now + 30 days`) *(decision 7)*.
- **Refunds:** cancelling a `Table` or `SeatReservation` triggers `Payment` refund(s) in the same unit of work where possible.

## Indexes (suggested)

- `Table(venue_id, starts_at)`
- `Table(status, starts_at)`
- `SeatReservation(table_id, status)`
- `SeatReservation(user_id, status)`
- `VenueAvailability(venue_id, date)`
- `Review(target_venue_id)`, `Review(target_user_id)`
- `Payment(venue_id, status)`, `Payment(user_id, status)`
- `Notification(user_id, read_at)`
