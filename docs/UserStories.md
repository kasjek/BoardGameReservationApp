# User Stories

## Players

1. As a player, I want to browse available board games so I can find something to play.
2. As a player, I want to filter games by player count and duration so I can match my group.
3. As a player, I want to see whether a game is free now or for a chosen time so I know I can reserve it.
4. As a player, I want to reserve a game for a time slot so my group has a copy when we arrive.
5. As a player, I want to cancel a reservation so the game becomes available for others.
6. As a player, I want to see my upcoming reservations so I remember what I booked.

## Venue Admins

7. As a venue admin, I want to add and update games in inventory so the catalog stays current.
8. As a venue admin, I want to manage how many copies of each game we have so availability is accurate.
9. As a venue admin, I want to configure reservation rules so bookings fit our operations.
10. As a venue admin, I want to view and manage reservations so I can help guests and resolve conflicts.
11. As a venue admin, I want to mark a game as returned so it becomes available again.

## Acceptance Notes

- A reservation succeeds only when at least one matching copy is free for the full slot.
- Cancelled or completed reservations free inventory immediately for new bookings.
- Players only see actionable statuses (e.g. available, reserved, overdue).
