/** Official seat caps that override a host's min/max when the game only supports that count. */

const TWO_PLAYER_ONLY = new Map([
  ["patchwork", { min: 2, max: 2, bggId: 163412 }],
]);

function normalizeGameTitle(title) {
  return String(title || "")
    .trim()
    .toLowerCase()
    .replace(/^the\s+/, "");
}

function gamePlayerLimits(title, bggId) {
  const byTitle = TWO_PLAYER_ONLY.get(normalizeGameTitle(title));
  if (byTitle) return { min: byTitle.min, max: byTitle.max };
  if (bggId != null) {
    for (const limits of TWO_PLAYER_ONLY.values()) {
      if (limits.bggId === Number(bggId)) return { min: limits.min, max: limits.max };
    }
  }
  return null;
}

function applyGamePlayerLimits(title, minPlayers, maxPlayers, venueMin = 2, venueMax = 8, bggId) {
  let min = Number(minPlayers);
  let max = Number(maxPlayers);
  if (!Number.isFinite(min) || min < 1) min = venueMin;
  if (!Number.isFinite(max) || max < 1) max = venueMax;

  const game = gamePlayerLimits(title, bggId);
  if (game) {
    min = Math.max(venueMin, game.min);
    max = Math.min(venueMax, game.max);
  }
  if (max < min) max = min;
  return { min_players: min, max_players: max };
}

function effectiveMaxPlayers(table) {
  const game = gamePlayerLimits(table.game_title);
  if (!game) return table.max_players;
  return Math.min(table.max_players, game.max);
}

function capExistingTwoPlayerTables(database) {
  const rows = database.prepare("SELECT id, game_title, min_players, max_players, seats_taken FROM tables").all();
  const update = database.prepare("UPDATE tables SET min_players=?, max_players=? WHERE id=?");
  for (const row of rows) {
    const game = gamePlayerLimits(row.game_title);
    if (!game) continue;
    const minPlayers = game.min;
    const maxPlayers = Math.max(game.max, row.seats_taken || 0);
    if (row.min_players !== minPlayers || row.max_players !== maxPlayers) {
      update.run(minPlayers, maxPlayers, row.id);
    }
  }
}

module.exports = {
  applyGamePlayerLimits,
  capExistingTwoPlayerTables,
  effectiveMaxPlayers,
  gamePlayerLimits,
};
