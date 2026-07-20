# User Stories

## Priority 0 — Table reservation (players)

First stories to implement.

1. **P0** As a player, I want to see free tables for a chosen time so I know we can sit.
2. **P0** As a player, I want to reserve a table for my group’s time slot so we have a place when we arrive.
3. **P0** As a player, I want to see my upcoming table reservation so I remember what I booked.
4. **P0** As a player, I want to cancel my table reservation so the table frees for others.

### Priority 0 acceptance notes

- A table reservation succeeds only when the chosen table is free for the full slot.
- Cancelled reservations free the table immediately for new bookings.
- Create sets status to `confirmed` (no pending step in v1).
- Players see actionable states: available (pre-book), confirmed, cancelled.
- Party size must be ≤ table capacity.
- A player may have at most one active upcoming table reservation.

## Later — Games (players)

5. As a player, I want to browse available board games so I can find something to play.
6. As a player, I want to filter games by player count and duration so I can match my group.
7. As a player, I want to see whether a game is free now or for a chosen time so I know I can reserve it.
8. As a player, I want to reserve a game for a time slot so my group has a copy when we arrive.
9. As a player, I want to cancel a game reservation so the game becomes available for others.
10. As a player, I want to see my upcoming game reservations so I remember what I booked.

## Later — Venue admins

11. As a venue admin, I want to manage tables (capacity, active/inactive) so seating stays accurate.
12. As a venue admin, I want to add and update games in inventory so the catalog stays current.
13. As a venue admin, I want to manage how many copies of each game we have so availability is accurate.
14. As a venue admin, I want to configure reservation rules so bookings fit our operations.
15. As a venue admin, I want to view and manage reservations so I can help guests and resolve conflicts.
16. As a venue admin, I want to mark a game as returned so it becomes available again.

## Later — Game reservation acceptance notes

- A game reservation succeeds only when at least one matching copy is free for the full slot.
- Cancelled or completed game reservations free inventory immediately for new bookings.
- Players only see actionable statuses (e.g. available, reserved, overdue).
