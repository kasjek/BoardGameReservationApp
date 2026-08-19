/** Add/list/remove games on a venue inventory (ADMIN any venue, VENUE_USER own). */

const { resolveThing } = require("./bgg");

function serializeGame(g) {
  if (!g) return null;
  return {
    id: g.id,
    venue: g.venue_id,
    title: g.title,
    bgg_id: g.bgg_id,
    thumbnail_url: g.thumbnail_url || "",
    cover_url: g.thumbnail_url || null,
    bgg_url: g.bgg_id ? `https://boardgamegeek.com/boardgame/${g.bgg_id}` : null,
    is_active: !!g.is_active,
  };
}

function findDuplicate(database, venueId, bggId, title) {
  if (bggId) {
    const byId = database
      .prepare("SELECT * FROM venue_games WHERE venue_id=? AND bgg_id=?")
      .get(venueId, bggId);
    if (byId) return byId;
  }
  if (title) {
    return database
      .prepare("SELECT * FROM venue_games WHERE venue_id=? AND lower(title)=lower(?)")
      .get(venueId, title);
  }
  return null;
}

function fail(status, body) {
  const err = new Error(typeof body === "string" ? body : JSON.stringify(body));
  err.status = status;
  err.body = typeof body === "string" ? { detail: body } : body;
  throw err;
}

async function addVenueGame(database, venueId, body) {
  const rawId = body?.bgg_id;
  const bggId = rawId == null || rawId === "" ? null : Number(rawId);
  if (bggId != null && (!Number.isFinite(bggId) || bggId < 1)) {
    fail(400, { bgg_id: ["Invalid bgg_id."] });
  }
  let title = String(body?.title || "").trim();
  let thumb = "";

  if (bggId) {
    const local = database
      .prepare(
        `SELECT title, thumbnail_url FROM venue_games
         WHERE bgg_id=?
         ORDER BY CASE WHEN thumbnail_url != '' THEN 0 ELSE 1 END
         LIMIT 1`,
      )
      .get(bggId);
    if (local) {
      title = title || local.title;
      thumb = local.thumbnail_url || "";
    }
    if (!title) {
      const thing = await resolveThing(bggId);
      title = (thing && thing.name) || "";
      thumb = (thing && thing.thumbnail_url) || thumb;
    }
    if (!title) fail(400, { bgg_id: ["Could not load that BoardGameGeek game."] });
  }
  if (!title) fail(400, { detail: "Provide bgg_id or title." });

  const existing = findDuplicate(database, venueId, bggId, title);
  if (existing) {
    if (existing.is_active) {
      fail(400, {
        [bggId ? "bgg_id" : "title"]: ["That game is already listed for this venue."],
      });
    }
    database
      .prepare(
        `UPDATE venue_games SET
           is_active=1,
           title=?,
           bgg_id=COALESCE(?, bgg_id),
           thumbnail_url=CASE WHEN ? != '' THEN ? ELSE thumbnail_url END
         WHERE id=?`,
      )
      .run(title, bggId, thumb, thumb, existing.id);
    return serializeGame(database.prepare("SELECT * FROM venue_games WHERE id=?").get(existing.id));
  }

  const info = database
    .prepare(
      `INSERT INTO venue_games (venue_id, title, bgg_id, thumbnail_url, is_active)
       VALUES (?, ?, ?, ?, 1)`,
    )
    .run(venueId, title, bggId, thumb);
  return serializeGame(database.prepare("SELECT * FROM venue_games WHERE id=?").get(info.lastInsertRowid));
}

function listVenueGames(database, venueId) {
  return database
    .prepare(
      `SELECT * FROM venue_games WHERE venue_id=? AND is_active=1 ORDER BY title`,
    )
    .all(venueId)
    .map(serializeGame);
}

function removeVenueGame(database, venueId, gameId) {
  const row = database
    .prepare("SELECT * FROM venue_games WHERE id=? AND venue_id=?")
    .get(gameId, venueId);
  if (!row) return false;
  database
    .prepare("UPDATE venue_games SET is_active=0 WHERE id=? AND venue_id=?")
    .run(gameId, venueId);
  return true;
}

module.exports = {
  addVenueGame,
  listVenueGames,
  removeVenueGame,
  serializeGame,
};
