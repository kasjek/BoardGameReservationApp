/** Seat limits stored on venue games and applied when hosting or joining a table. */

function lookupGameLimits(database, venueId, title, bggId) {
  if (!database || !venueId) return null;
  const cols = database.prepare("PRAGMA table_info(venue_games)").all().map((c) => c.name);
  if (!cols.includes("min_players") || !cols.includes("max_players")) return null;

  if (bggId != null && Number(bggId) > 0) {
    const byId = database
      .prepare(
        `SELECT min_players, max_players FROM venue_games
         WHERE venue_id=? AND is_active=1 AND bgg_id=? LIMIT 1`,
      )
      .get(venueId, Number(bggId));
    if (byId) return { min: byId.min_players, max: byId.max_players };
  }

  if (!title) return null;
  const row = database
    .prepare(
      `SELECT min_players, max_players FROM venue_games
       WHERE venue_id=? AND is_active=1 AND lower(title)=lower(?) LIMIT 1`,
    )
    .get(venueId, String(title).trim());
  if (!row) return null;
  return { min: row.min_players, max: row.max_players };
}

function normalizeSeatLimits(minPlayers, maxPlayers, fallbackMin = 2, fallbackMax = 8) {
  let min = Number(minPlayers);
  let max = Number(maxPlayers);
  if (!Number.isFinite(min) || min < 1) min = fallbackMin;
  if (!Number.isFinite(max) || max < 1) max = fallbackMax;
  min = Math.floor(min);
  max = Math.floor(max);
  if (min < 1 || max > 99 || max < min) {
    return { error: "Require 1 <= min_players <= max_players <= 99." };
  }
  return { min_players: min, max_players: max };
}

function applyGamePlayerLimits(
  database,
  { title, minPlayers, maxPlayers, venueMin = 2, venueMax = 8, venueId, bggId } = {},
) {
  let min = Number(minPlayers);
  let max = Number(maxPlayers);
  if (!Number.isFinite(min) || min < 1) min = venueMin;
  if (!Number.isFinite(max) || max < 1) max = venueMax;

  const game = lookupGameLimits(database, venueId, title, bggId);
  if (game) {
    const allowedMin = Math.max(venueMin, game.min);
    let allowedMax = Math.min(venueMax, game.max);
    if (allowedMax < allowedMin) allowedMax = allowedMin;
    min = Math.min(Math.max(min, allowedMin), allowedMax);
    max = Math.min(Math.max(max, allowedMin), allowedMax);
  }
  if (max < min) max = min;
  return { min_players: min, max_players: max };
}

function effectiveMaxPlayers(database, table) {
  const game = lookupGameLimits(database, table.venue_id, table.game_title);
  if (!game) return table.max_players;
  return Math.min(table.max_players, game.max);
}

function capTablesToGameLimits(database) {
  const rows = database
    .prepare("SELECT id, venue_id, game_title, min_players, max_players, seats_taken FROM tables")
    .all();
  const update = database.prepare("UPDATE tables SET min_players=?, max_players=? WHERE id=?");
  let capped = 0;
  for (const row of rows) {
    const game = lookupGameLimits(database, row.venue_id, row.game_title);
    if (!game) continue;
    const maxPlayers = Math.max(Math.min(row.max_players, game.max), row.seats_taken || 0);
    const minPlayers = Math.min(Math.max(row.min_players, game.min), maxPlayers);
    if (row.min_players !== minPlayers || row.max_players !== maxPlayers) {
      update.run(minPlayers, maxPlayers, row.id);
      capped += 1;
    }
  }
  return capped;
}

module.exports = {
  applyGamePlayerLimits,
  capTablesToGameLimits,
  effectiveMaxPlayers,
  lookupGameLimits,
  normalizeSeatLimits,
};
