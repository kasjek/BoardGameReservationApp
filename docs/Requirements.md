# Requirements

## Overview

BoardGameReservationApp helps board game players **find people to play with** and helps **venue owners (cafes/restaurants) manage table reservations**. Users **create tables** (board game events) at venues, other users **reserve a seat** at those tables, and **venue admins** confirm and manage the capacity of their location. An **admin** operates the platform.

This document is derived from `docs/Vision.md` and `docs/UserStories.md`, and uses the roles defined in `docs/Permissions.md` (`USER`, `VENUE_USER`, `ADMIN`).

Priorities use MoSCoW for a first release. Each requirement links to the originating user story number(s) in `docs/UserStories.md`.

## Roles (summary)

- **USER** — a player. Can create tables, reserve seats, socialize, review, and pay.
- **VENUE_USER** — staff/owner of one venue. Manages that venue's capacity, reservations, inventory, and rules.
- **ADMIN** — platform superuser. Has all `USER` and all `VENUE_USER` rights (across every venue) plus global add/edit/delete. See `docs/Permissions.md`.

## Functional Requirements

### A. Accounts, authentication & profiles

- **FR-A1 (Must)** Users register and log in quickly to access a personalized history of events attended and organized. *(9)*
- **FR-A2 (Must)** A public profile exposes only avatar, display name, and aggregate rating — no other personal information. *(26)*
- **FR-A3 (Should)** Users can change their avatar from a system-allocated set. *(10)*
- **FR-A4 (Should)** Users can view another user's public profile including rating, reviews, and number of past cancellations. *(20, 23)*

### B. Tables / events (core)

- **FR-B1 (Must)** A user creates a table specifying venue, date/time, duration, min/max player count, the game (own or one available at the venue), and event language (English, German, or Other free-text). The organizer is seated by default. *(1, 4, 6, 29)*
- **FR-B2 (Must)** Users can browse all tables offered by other users and reserve a seat at one. *(2)*
- **FR-B3 (Must)** Users can view table details, including the game description and picture. *(6)*
- **FR-B4 (Must)** Users can filter events by date, time, past/future, board game name, min/max player count, and location. *(13)*
- **FR-B5 (Must)** Each table exposes a clear status to all parties: `waiting for venue confirmation`, `waiting for players`, `confirmed`, `cancelled` (and `completed` after it ends). *(33, 24)*
- **FR-B6 (Must)** An attendee can cancel their own seat up to 24h before the event; other attendees are notified automatically. *(21)*
- **FR-B7 (Must)** An organizer can cancel their table; all signed-up attendees receive a timely email notification. *(22)*
- **FR-B8 (Should)** After an event ends, participants can add pictures of the event. *(7)*
- **FR-B9 (Could)** A user can share an external link to a table so friends outside the app can register and join. *(15)*

### C. Venues & capacity (VENUE_USER)

- **FR-C1 (Must)** A venue admin defines the days, times, and number of tables available at their location. *(34)*
- **FR-C2 (Must)** A venue admin accepts or rejects reservation requests (with or without a requested game), making the outcome visible to all parties. *(35)*
- **FR-C3 (Must)** A venue admin sees all events planned at their location on a single screen. *(41)*
- **FR-C4 (Should)** A venue admin edits the venue description and pictures. *(36)*
- **FR-C5 (Should)** A venue admin manages the venue's game inventory: number of copies, condition (new / like new / good), and language. *(38, 44, 29)*
- **FR-C6 (Should)** A venue admin adds, edits, and removes reservation rules (max reservation time, food/drink requirements, minimum spend per person). *(45)*
- **FR-C7 (Should)** A venue admin views all past tables reserved at their location for their own analytics/advertising. *(40)*
- **FR-C8 (Could)** A venue admin responds to reviews of their location and writes reviews of players who visited. *(37, 39)*
- **FR-C9 (Could)** A venue admin blocks a user from booking at their venue with a reason, and notifies the admin. *(42)*

### D. Payments & refunds

- **FR-D1 (Should)** Users pay a reservation fee quickly via PayPal or Revolut. *(30)*
- **FR-D2 (Should)** Users receive a notification of successful or unsuccessful payment. *(32)*
- **FR-D3 (Should)** Users are refunded automatically when a table or their seat is cancelled. *(31)*
- **FR-D4 (Could)** The platform collects reservation fees; admin sees fee reporting per venue, per user, and per game. *(50, 51)*

### E. Social: friends, invites & chat

- **FR-E1 (Should)** Users can search for other users, send/accept/reject friend requests, and manage their friend list. *(14, 27)*
- **FR-E2 (Should)** Users can invite other users in-app to join their table. *(16)*
- **FR-E3 (Could)** Each table has an event chat so players can coordinate without exchanging phone numbers. *(8)*
- **FR-E4 (Could)** Users can block the ability of others to invite them to tables. *(17)*

### F. Reviews & ratings

- **FR-F1 (Should)** Users can write short reviews of players they have played with and of venues they have used. *(5)*
- **FR-F2 (Should)** Reviews contribute to aggregate ratings shown on user and venue profiles. *(20)*

### G. Trust, safety & moderation

- **FR-G1 (Must)** A user can block another user, preventing them from joining the blocker's tables, sending private messages, or writing to them in event chats. *(12)*
- **FR-G2 (Should)** A user can report abusive, racist, nationalistic, exclusionary, or harassing content to the admin. *(11)*
- **FR-G3 (Should)** A user can report a bug (with a screenshot and message) and submit feedback from any part of the app. *(18, 19)*
- **FR-G4 (Should)** The admin can delete abusive comments, responses, posts, and pictures. *(48)*
- **FR-G5 (Should)** The admin can block any user or venue that breaks the rules. *(49, 53)*

### H. Notifications (email + in-app)

- **FR-H1 (Must)** Users are notified only about tables relevant to them (organized or joined) when there is a change to time, day, or venue; a cancellation; a missing-players state; or a confirmed-event state. *(28, 25)*
- **FR-H2 (Should)** Venue admins are notified of new, edited, and cancelled reservation requests for their venue. *(43)*
- **FR-H3 (Should)** The admin is notified of abuse reports and of any bad review for a user or location. *(49, 52)*

### I. Admin / platform operations

- **FR-I1 (Must)** The admin can do everything users and venue admins can, plus add, edit, and remove venues and venue admins. *(46)*
- **FR-I2 (Should)** The admin can add, edit, and remove games from the inventory of any venue. *(47)*
- **FR-I3 (Could)** The admin can mark venues or users as "super locations" or "super users". *(54)*

## Non-Functional Requirements

- **NFR-1 Privacy** — Public views expose only avatar, display name, and rating; personal data is protected and a data-deletion path is provided. *(26)*
- **NFR-2 Authorization** — The permission matrix in `docs/Permissions.md` is enforced server-side on every endpoint; hiding UI is not sufficient.
- **NFR-3 Payments compliance** — Payments use hosted PayPal/Revolut flows; the app never stores card data.
- **NFR-4 Notifications** — Notifications are reliable across email and in-app, and scoped to relevance so users are not spammed.
- **NFR-5 Internationalization** — Event language is first-class data (EN / DE / Other); the UI is expected to localize (at least EN/DE).
- **NFR-6 Mobile-first & clear status** — The experience is mobile-friendly and reservation/event status is obvious at a glance (per `docs/Vision.md`).
- **NFR-7 Auditability** — Moderation actions, blocks, cancellations, and refunds are logged.

## Traceability

Every functional requirement above cites the story number(s) it implements from `docs/UserStories.md`. Stories 1–33 map to Section A/B/D/E/F/G/H; 34–45 to Section C (and H2); 46–54 to Section I (and G4/G5/H3).
