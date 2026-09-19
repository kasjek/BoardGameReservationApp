/** A user may hold only one reserved seat at a time, across every venue. */

const OVERLAP_DETAIL =
  "You already have a reservation that overlaps this time. Cancel it first, or pick another slot.";

function overlappingReservation(db, userId, startsAt, endsAt, excludeTableId = null) {
  const start = typeof startsAt === "string" ? startsAt : new Date(startsAt).toISOString();
  const end = typeof endsAt === "string" ? endsAt : new Date(endsAt).toISOString();
  const row = db
    .prepare(
      `SELECT t.id FROM seats s
       JOIN tables t ON t.id = s.table_id
       WHERE s.user_id=? AND s.status='reserved'
         AND t.status != 'cancelled'
         AND t.starts_at < ? AND t.ends_at > ?
         AND t.id != ?`,
    )
    .get(userId, end, start, excludeTableId || 0);
  return Boolean(row);
}

module.exports = { overlappingReservation, OVERLAP_DETAIL };
