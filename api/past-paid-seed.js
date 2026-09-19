/** Demo history: completed, paid tables hosted by demo or alice at the three venues. */

const { KNOWN_GAME_TYPES_BY_TITLE } = require("./game-types");

const VENUE_CATALOG = {
  "Date House Cafe": new Set(["Love Letter", "Patchwork", "Onitama"]),
  Katzentempel: new Set(["The Isle of Cats", "Spicy", "Calico"]),
  "Hotel Knorz": new Set(["Catan", "Secret Hitler"]),
};

/** Fixed past slots (UTC) so the seed stays in the past and is idempotent. */
const PAST_PAID_TABLES = [
  { venue: "Date House Cafe", organizer: "demo", game: "Love Letter", start: "2026-07-04T14:00:00.000Z", guests: ["alice", "bob"] },
  { venue: "Date House Cafe", organizer: "alice", game: "Patchwork", start: "2026-07-06T15:00:00.000Z", guests: ["demo"] },
  { venue: "Date House Cafe", organizer: "demo", game: "Onitama", start: "2026-07-11T16:00:00.000Z", guests: ["bob", "charlie"] },
  { venue: "Date House Cafe", organizer: "alice", game: "Azul", start: "2026-07-13T14:00:00.000Z", guests: ["demo", "chester"] },
  { venue: "Date House Cafe", organizer: "demo", game: "Ticket to Ride", start: "2026-07-18T11:00:00.000Z", guests: ["alice"] },
  { venue: "Date House Cafe", organizer: "alice", game: "7 Wonders", start: "2026-07-20T17:00:00.000Z", guests: ["bob", "charlie"] },
  { venue: "Date House Cafe", organizer: "demo", game: "Wingspan", start: "2026-07-25T13:00:00.000Z", guests: ["alice", "chester"] },
  { venue: "Katzentempel", organizer: "alice", game: "The Isle of Cats", start: "2026-07-05T12:00:00.000Z", guests: ["demo", "bob"] },
  { venue: "Katzentempel", organizer: "demo", game: "Spicy", start: "2026-07-12T15:00:00.000Z", guests: ["charlie"] },
  { venue: "Katzentempel", organizer: "alice", game: "Calico", start: "2026-07-19T14:00:00.000Z", guests: ["demo", "chester"] },
  { venue: "Katzentempel", organizer: "demo", game: "Cascadia", start: "2026-07-26T16:00:00.000Z", guests: ["alice", "bob"] },
  { venue: "Katzentempel", organizer: "alice", game: "Everdell", start: "2026-08-02T13:00:00.000Z", guests: ["charlie", "chester"] },
  { venue: "Katzentempel", organizer: "demo", game: "Dixit", start: "2026-08-09T11:00:00.000Z", guests: ["alice"] },
  { venue: "Katzentempel", organizer: "alice", game: "The Quacks of Quedlinburg", start: "2026-08-16T15:00:00.000Z", guests: ["demo", "bob"] },
  { venue: "Hotel Knorz", organizer: "demo", game: "Catan", start: "2026-07-07T18:00:00.000Z", guests: ["alice", "bob", "charlie"] },
  { venue: "Hotel Knorz", organizer: "alice", game: "Secret Hitler", start: "2026-07-14T19:00:00.000Z", guests: ["demo", "chester"] },
  { venue: "Hotel Knorz", organizer: "demo", game: "Carcassonne", start: "2026-07-21T17:00:00.000Z", guests: ["alice"] },
  { venue: "Hotel Knorz", organizer: "alice", game: "Terraforming Mars", start: "2026-07-28T16:00:00.000Z", guests: ["demo", "bob"] },
  { venue: "Hotel Knorz", organizer: "demo", game: "Codenames", start: "2026-08-04T18:00:00.000Z", guests: ["charlie", "chester"] },
  { venue: "Hotel Knorz", organizer: "alice", game: "Splendor", start: "2026-08-11T14:00:00.000Z", guests: ["demo"] },
  { venue: "Hotel Knorz", organizer: "demo", game: "Pandemic", start: "2026-08-18T15:00:00.000Z", guests: ["alice", "bob"] },
];

function typesFor(title) {
  const key = String(title || "")
    .toLowerCase()
    .replace(/\s*\(\d{4}\)\s*/g, " ")
    .replace(/^the\s+/, "")
    .trim();
  return (
    KNOWN_GAME_TYPES_BY_TITLE[key] ||
    KNOWN_GAME_TYPES_BY_TITLE[String(title || "").toLowerCase()] ||
    []
  );
}

function endsAt(startIso, hours = 2) {
  return new Date(new Date(startIso).getTime() + hours * 60 * 60 * 1000).toISOString();
}

function ensurePastPaidTables(database) {
  const venues = new Map(
    database.prepare("SELECT id, name FROM venues").all().map((row) => [row.name, row.id]),
  );
  const users = new Map(
    database.prepare("SELECT id, username FROM users").all().map((row) => [row.username, row.id]),
  );
  const insertTable = database.prepare(
    `INSERT INTO tables (organizer_id, venue_id, game_title, bring_own_game, game_language, game_language_other, venue_game_confirmed, starts_at, ends_at, min_players, max_players, status, seats_taken, created_at, game_types)
     VALUES (?, ?, ?, ?, ?, '', 1, ?, ?, ?, ?, 'completed', ?, ?, ?)`,
  );
  const insertSeat = database.prepare(
    `INSERT INTO seats (table_id, user_id, is_organizer, status, waitlist_position, paid)
     VALUES (?, ?, ?, 'reserved', NULL, 1)`,
  );
  const findExisting = database.prepare(
    `SELECT id FROM tables
     WHERE organizer_id=? AND venue_id=? AND game_title=? AND starts_at=? AND status != 'cancelled'`,
  );

  let created = 0;
  const tx = database.transaction(() => {
    for (const spec of PAST_PAID_TABLES) {
      const venueId = venues.get(spec.venue);
      const organizerId = users.get(spec.organizer);
      if (!venueId || !organizerId) continue;
      const guestIds = (spec.guests || [])
        .map((name) => users.get(name))
        .filter((id) => id && id !== organizerId);
      const existing = findExisting.get(organizerId, venueId, spec.game, spec.start);
      if (existing) continue;

      const catalog = VENUE_CATALOG[spec.venue] || new Set();
      const bringOwn = catalog.has(spec.game) ? 0 : 1;
      const maxPlayers = spec.game.toLowerCase() === "patchwork" ? 2 : 8;
      const seatsTaken = 1 + guestIds.length;
      const start = spec.start;
      const end = endsAt(start, spec.hours || 2);
      const tid = insertTable.run(
        organizerId,
        venueId,
        spec.game,
        bringOwn,
        bringOwn ? "en" : "de",
        start,
        end,
        2,
        maxPlayers,
        seatsTaken,
        start,
        JSON.stringify(typesFor(spec.game)),
      ).lastInsertRowid;
      insertSeat.run(tid, organizerId, 1);
      for (const guestId of guestIds) {
        insertSeat.run(tid, guestId, 0);
      }
      created += 1;
    }
  });
  tx();
  return created;
}

module.exports = {
  PAST_PAID_TABLES,
  ensurePastPaidTables,
};
