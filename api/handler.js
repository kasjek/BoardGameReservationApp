const {
  ensureDb,
  hashPassword,
  checkPassword,
  newToken,
  serializeUser,
  serializeVenue,
  serializeTable,
  serializeSeat,
  validPassword,
  gameStats,
  canonicalTableStatus,
  expandStatusFilter,
  syncOpenTableStatus,
  JOINABLE_STATUSES,
} = require("./db");
const { resolveCoverUrl, resolveThing, liveSearch } = require("./bgg");
const { listCategories, parseCategoryIds } = require("./bgg-categories");
const {
  friendshipPayload,
  searchUsers,
  listFriends,
  listRequests,
  sendRequest,
  acceptRequest,
  rejectRequest,
} = require("./friends");
const { listChats, getThread, sendMessage } = require("./chats");

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(Object.assign(new Error("Invalid JSON"), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

function send(res, status, data, headers = {}) {
  const body = data === undefined || data === null ? "" : JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json",
    ...headers,
  });
  res.end(body);
}

function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

function getUser(req) {
  const db = ensureDb();
  const auth = req.headers.authorization || "";
  const m = auth.match(/^Token\s+(.+)$/i);
  if (!m) return null;
  const row = db
    .prepare(
      `SELECT u.* FROM tokens t JOIN users u ON u.id = t.user_id WHERE t.key = ?`,
    )
    .get(m[1].trim());
  return row || null;
}

function requireUser(req, res) {
  const u = getUser(req);
  if (!u) {
    send(res, 401, { detail: "Authentication credentials were not provided." });
    return null;
  }
  return u;
}

function canHost(u) {
  return u && (u.role === "USER" || u.role === "ADMIN");
}

function managesVenue(u, venueId) {
  if (!u) return false;
  if (u.role === "ADMIN") return true;
  return u.role === "VENUE_USER" && u.venue_id === venueId;
}

async function handleApi(req, res) {
  ensureDb();
  const db = ensureDb();
  const url = new URL(req.url || "/", "http://local");
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const method = req.method || "GET";

  try {
    // ---- Auth ----
    if (method === "POST" && path === "/api/auth/register") {
      const body = await readBody(req);
      const { username, email = "", password } = body;
      if (!username || !password) return send(res, 400, { detail: "username and password required." });
      const pwErr = validPassword(password);
      if (pwErr) return send(res, 400, { password: [pwErr] });
      if (db.prepare("SELECT id FROM users WHERE username=?").get(username)) {
        return send(res, 400, { username: ["A user with that username already exists."] });
      }
      const info = db
        .prepare(
          `INSERT INTO users (username, email, password_hash, role, avatar_seed) VALUES (?, ?, ?, 'USER', ?)`,
        )
        .run(username, email, hashPassword(password), username);
      const user = db.prepare("SELECT * FROM users WHERE id=?").get(info.lastInsertRowid);
      const token = newToken();
      db.prepare("INSERT INTO tokens (key, user_id) VALUES (?, ?)").run(token, user.id);
      return send(res, 201, { token, user: serializeUser(user) });
    }

    if (method === "POST" && path === "/api/auth/login") {
      const body = await readBody(req);
      const user = db.prepare("SELECT * FROM users WHERE username=?").get(body.username || "");
      if (!user || !checkPassword(body.password || "", user.password_hash)) {
        return send(res, 400, { non_field_errors: ["Unable to log in with provided credentials."] });
      }
      db.prepare("DELETE FROM tokens WHERE user_id=?").run(user.id);
      const token = newToken();
      db.prepare("INSERT INTO tokens (key, user_id) VALUES (?, ?)").run(token, user.id);
      return send(res, 200, { token });
    }

    if (method === "GET" && path === "/api/auth/me") {
      const u = requireUser(req, res);
      if (!u) return;
      return send(res, 200, serializeUser(u));
    }

    if (method === "POST" && path === "/api/me/avatar/roll") {
      const u = requireUser(req, res);
      if (!u) return;
      const seed = `${u.username}-${Date.now()}`;
      db.prepare("UPDATE users SET avatar_seed=? WHERE id=?").run(seed, u.id);
      return send(res, 200, serializeUser(db.prepare("SELECT * FROM users WHERE id=?").get(u.id)));
    }

    if (method === "PATCH" && path === "/api/me/favorite-categories") {
      const u = requireUser(req, res);
      if (!u) return;
      const body = await readBody(req);
      const parsed = parseCategoryIds(body.category_ids);
      if (parsed.error) return send(res, 400, { detail: parsed.error });
      db.prepare("UPDATE users SET favorite_categories=? WHERE id=?").run(
        JSON.stringify(parsed.ids),
        u.id,
      );
      return send(res, 200, serializeUser(db.prepare("SELECT * FROM users WHERE id=?").get(u.id)));
    }

    if (method === "POST" && path === "/api/me/password") {
      const u = requireUser(req, res);
      if (!u) return;
      const body = await readBody(req);
      if (!checkPassword(body.current_password || "", u.password_hash)) {
        return send(res, 400, { current_password: ["Incorrect password."] });
      }
      if (body.new_password !== body.confirm_password) {
        return send(res, 400, { confirm_password: ["Passwords do not match."] });
      }
      const pwErr = validPassword(body.new_password || "");
      if (pwErr) return send(res, 400, { new_password: [pwErr] });
      db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(
        hashPassword(body.new_password),
        u.id,
      );
      db.prepare("DELETE FROM tokens WHERE user_id=?").run(u.id);
      const token = newToken();
      db.prepare("INSERT INTO tokens (key, user_id) VALUES (?, ?)").run(token, u.id);
      return send(res, 200, { detail: "Password updated.", token });
    }

    // ---- Venues ----
    if (method === "GET" && path === "/api/venues") {
      const rows = db.prepare("SELECT * FROM venues ORDER BY name").all();
      return send(res, 200, rows.map(serializeVenue));
    }

    if (method === "POST" && path === "/api/venues") {
      const u = requireUser(req, res);
      if (!u) return;
      if (u.role !== "ADMIN") return send(res, 403, { detail: "Admin only." });
      const body = await readBody(req);
      const info = db
        .prepare(
          `INSERT INTO venues (name, description, location, min_players, max_players, min_reservation_minutes, max_reservation_minutes)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          body.name,
          body.description || "",
          body.location || "",
          body.min_players ?? 2,
          body.max_players ?? 8,
          body.min_reservation_minutes ?? 60,
          body.max_reservation_minutes ?? 180,
        );
      return send(res, 201, serializeVenue(db.prepare("SELECT * FROM venues WHERE id=?").get(info.lastInsertRowid)));
    }

    let m;
    if ((m = path.match(/^\/api\/venues\/(\d+)$/))) {
      const id = Number(m[1]);
      const venue = db.prepare("SELECT * FROM venues WHERE id=?").get(id);
      if (!venue) return send(res, 404, { detail: "Not found." });
      if (method === "GET") return send(res, 200, serializeVenue(venue));
      if (method === "PATCH") {
        const u = requireUser(req, res);
        if (!u) return;
        if (!managesVenue(u, id)) return send(res, 403, { detail: "Forbidden." });
        const body = await readBody(req);
        db.prepare(
          `UPDATE venues SET
            name=COALESCE(?, name),
            description=COALESCE(?, description),
            location=COALESCE(?, location),
            min_players=COALESCE(?, min_players),
            max_players=COALESCE(?, max_players),
            min_reservation_minutes=COALESCE(?, min_reservation_minutes),
            max_reservation_minutes=COALESCE(?, max_reservation_minutes)
           WHERE id=?`,
        ).run(
          body.name ?? null,
          body.description ?? null,
          body.location ?? null,
          body.min_players ?? null,
          body.max_players ?? null,
          body.min_reservation_minutes ?? null,
          body.max_reservation_minutes ?? null,
          id,
        );
        return send(res, 200, serializeVenue(db.prepare("SELECT * FROM venues WHERE id=?").get(id)));
      }
    }

    if ((m = path.match(/^\/api\/venues\/(\d+)\/availability$/)) && method === "GET") {
      const id = Number(m[1]);
      const rows = db
        .prepare(
          `SELECT id, date, start_time, end_time, tables_available FROM venue_availability
           WHERE venue_id=? ORDER BY date, start_time`,
        )
        .all(id);
      return send(res, 200, rows);
    }

    if ((m = path.match(/^\/api\/venues\/(\d+)\/hours$/))) {
      const id = Number(m[1]);
      if (method === "GET") {
        const rows = db
          .prepare(
            `SELECT weekday, is_closed, start_time, end_time FROM venue_hours WHERE venue_id=? ORDER BY weekday`,
          )
          .all(id)
          .map((r) => ({
            weekday: r.weekday,
            is_closed: !!r.is_closed,
            start_time: r.start_time,
            end_time: r.end_time,
          }));
        return send(res, 200, rows);
      }
      if (method === "PUT") {
        const u = requireUser(req, res);
        if (!u) return;
        if (!managesVenue(u, id)) return send(res, 403, { detail: "Forbidden." });
        const body = await readBody(req);
        const rows = Array.isArray(body) ? body : [];
        const tx = db.transaction(() => {
          db.prepare("DELETE FROM venue_hours WHERE venue_id=?").run(id);
          const ins = db.prepare(
            `INSERT INTO venue_hours (venue_id, weekday, is_closed, start_time, end_time) VALUES (?, ?, ?, ?, ?)`,
          );
          for (const r of rows) {
            ins.run(id, r.weekday, r.is_closed ? 1 : 0, r.start_time, r.end_time);
          }
        });
        tx();
        return send(
          res,
          200,
          db
            .prepare(
              `SELECT weekday, is_closed, start_time, end_time FROM venue_hours WHERE venue_id=? ORDER BY weekday`,
            )
            .all(id)
            .map((r) => ({
              weekday: r.weekday,
              is_closed: !!r.is_closed,
              start_time: r.start_time,
              end_time: r.end_time,
            })),
        );
      }
    }

    if ((m = path.match(/^\/api\/venues\/(\d+)\/closures$/))) {
      const id = Number(m[1]);
      if (method === "GET") {
        return send(
          res,
          200,
          db
            .prepare(
              `SELECT id, venue_id as venue, date, comment, created_at FROM venue_closures WHERE venue_id=? ORDER BY date`,
            )
            .all(id),
        );
      }
      if (method === "POST") {
        const u = requireUser(req, res);
        if (!u) return;
        if (!managesVenue(u, id)) return send(res, 403, { detail: "Forbidden." });
        const body = await readBody(req);
        const info = db
          .prepare(
            `INSERT INTO venue_closures (venue_id, date, comment, created_at) VALUES (?, ?, ?, ?)`,
          )
          .run(id, body.date, body.comment || "", new Date().toISOString());
        return send(
          res,
          201,
          db
            .prepare(
              `SELECT id, venue_id as venue, date, comment, created_at FROM venue_closures WHERE id=?`,
            )
            .get(info.lastInsertRowid),
        );
      }
    }

    if ((m = path.match(/^\/api\/venues\/(\d+)\/closures\/(\d+)$/)) && method === "DELETE") {
      const venueId = Number(m[1]);
      const u = requireUser(req, res);
      if (!u) return;
      if (!managesVenue(u, venueId)) return send(res, 403, { detail: "Forbidden." });
      db.prepare("DELETE FROM venue_closures WHERE id=? AND venue_id=?").run(Number(m[2]), venueId);
      return send(res, 204, null);
    }

    if ((m = path.match(/^\/api\/venues\/(\d+)\/games$/))) {
      const id = Number(m[1]);
      if (method === "GET") {
        const rows = db
          .prepare(`SELECT * FROM venue_games WHERE venue_id=? AND is_active=1 ORDER BY title`)
          .all(id)
          .map((g) => ({
            id: g.id,
            venue: g.venue_id,
            title: g.title,
            bgg_id: g.bgg_id,
            thumbnail_url: g.thumbnail_url || "",
            cover_url: g.thumbnail_url || null,
            bgg_url: g.bgg_id ? `https://boardgamegeek.com/boardgame/${g.bgg_id}` : null,
            is_active: !!g.is_active,
          }));
        return send(res, 200, rows);
      }
      if (method === "POST") {
        const u = requireUser(req, res);
        if (!u) return;
        if (!managesVenue(u, id)) return send(res, 403, { detail: "Forbidden." });
        const body = await readBody(req);
        const title = body.title || `Game ${body.bgg_id || ""}`;
        const info = db
          .prepare(
            `INSERT INTO venue_games (venue_id, title, bgg_id, thumbnail_url) VALUES (?, ?, ?, '')`,
          )
          .run(id, title, body.bgg_id || null);
        const g = db.prepare("SELECT * FROM venue_games WHERE id=?").get(info.lastInsertRowid);
        return send(res, 201, {
          id: g.id,
          venue: g.venue_id,
          title: g.title,
          bgg_id: g.bgg_id,
          thumbnail_url: "",
          cover_url: null,
          bgg_url: g.bgg_id ? `https://boardgamegeek.com/boardgame/${g.bgg_id}` : null,
          is_active: true,
        });
      }
    }

    if ((m = path.match(/^\/api\/venues\/(\d+)\/games\/(\d+)$/)) && method === "DELETE") {
      const venueId = Number(m[1]);
      const u = requireUser(req, res);
      if (!u) return;
      if (!managesVenue(u, venueId)) return send(res, 403, { detail: "Forbidden." });
      db.prepare("UPDATE venue_games SET is_active=0 WHERE id=? AND venue_id=?").run(
        Number(m[2]),
        venueId,
      );
      return send(res, 204, null);
    }

    if ((m = path.match(/^\/api\/venues\/(\d+)\/reviews$/)) && method === "GET") {
      const id = Number(m[1]);
      const rows = db
        .prepare(
          `SELECT r.*, u.username AS author_name FROM reviews r
           JOIN users u ON u.id = r.author_id
           WHERE r.target_type='venue' AND r.target_venue_id=?
           ORDER BY r.created_at DESC`,
        )
        .all(id)
        .map((r) => ({
          id: r.id,
          author: r.author_id,
          author_name: r.author_name,
          target_type: r.target_type,
          target_user: r.target_user_id,
          target_venue: r.target_venue_id,
          rating: r.rating,
          body: r.body,
          created_at: r.created_at,
        }));
      return send(res, 200, rows);
    }

    // ---- Tables ----
    if (path === "/api/tables") {
      if (method === "GET") {
        let sql = "SELECT * FROM tables WHERE 1=1";
        const params = [];
        const venueId = url.searchParams.get("venueId");
        const status = url.searchParams.get("status");
        const game = url.searchParams.get("game");
        const organizerId = url.searchParams.get("organizerId");
        const attendeeId = url.searchParams.get("attendeeId");
        if (venueId) {
          sql += " AND venue_id=?";
          params.push(Number(venueId));
        }
        if (status) {
          const expanded = expandStatusFilter(status);
          sql += ` AND status IN (${expanded.map(() => "?").join(",")})`;
          params.push(...expanded);
        }
        if (game) {
          sql += " AND game_title LIKE ?";
          params.push(`%${game}%`);
        }
        if (organizerId) {
          sql += " AND organizer_id=?";
          params.push(Number(organizerId));
        }
        if (attendeeId) {
          sql +=
            " AND id IN (SELECT table_id FROM seats WHERE user_id=? AND status IN ('reserved','waitlisted'))";
          params.push(Number(attendeeId));
        }
        sql += " ORDER BY starts_at";
        return send(res, 200, db.prepare(sql).all(...params).map(serializeTable));
      }
      if (method === "POST") {
        const u = requireUser(req, res);
        if (!u) return;
        if (!canHost(u)) return send(res, 403, { detail: "Only USER/ADMIN can host." });
        const body = await readBody(req);
        const venue = db.prepare("SELECT * FROM venues WHERE id=?").get(body.venue);
        if (!venue) return send(res, 400, { venue: ["Invalid venue."] });
        const starts = new Date(body.starts_at);
        const ends = new Date(body.ends_at);
        if (!(starts < ends)) return send(res, 400, { detail: "Invalid time range." });
        const date = body.starts_at.slice(0, 10);
        const startT = starts.toISOString().slice(11, 16);
        const endT = ends.toISOString().slice(11, 16);
        const avail = db
          .prepare(
            `SELECT id FROM venue_availability WHERE venue_id=? AND date=? AND start_time<=? AND end_time>=?`,
          )
          .get(venue.id, date, startT, endT);
        if (!avail) return send(res, 400, { detail: "Venue not available for that slot." });
        const now = new Date().toISOString();
        const info = db
          .prepare(
            `INSERT INTO tables (organizer_id, venue_id, game_title, bring_own_game, game_language, game_language_other, venue_game_confirmed, starts_at, ends_at, min_players, max_players, status, seats_taken, created_at)
             VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 'requested', 1, ?)`,
          )
          .run(
            u.id,
            venue.id,
            body.game_title,
            body.bring_own_game ? 1 : 0,
            body.game_language || "en",
            body.game_language_other || "",
            body.starts_at,
            body.ends_at,
            body.min_players || venue.min_players,
            body.max_players || venue.max_players,
            now,
          );
        const paid = body.bring_own_game ? 1 : 0;
        db.prepare(
          `INSERT INTO seats (table_id, user_id, is_organizer, status, paid) VALUES (?, ?, 1, 'reserved', ?)`,
        ).run(info.lastInsertRowid, u.id, paid);
        return send(
          res,
          201,
          serializeTable(db.prepare("SELECT * FROM tables WHERE id=?").get(info.lastInsertRowid)),
        );
      }
    }

    if ((m = path.match(/^\/api\/tables\/(\d+)$/)) && method === "GET") {
      const row = db.prepare("SELECT * FROM tables WHERE id=?").get(Number(m[1]));
      if (!row) return send(res, 404, { detail: "Not found." });
      return send(res, 200, serializeTable(row));
    }

    if ((m = path.match(/^\/api\/tables\/(\d+)\/confirm$/)) && method === "POST") {
      const u = requireUser(req, res);
      if (!u) return;
      const table = db.prepare("SELECT * FROM tables WHERE id=?").get(Number(m[1]));
      if (!table) return send(res, 404, { detail: "Not found." });
      if (!managesVenue(u, table.venue_id)) return send(res, 403, { detail: "Forbidden." });
      if (canonicalTableStatus(table.status) !== "requested") {
        return send(res, 409, { detail: "Table is not awaiting confirmation." });
      }
      db.prepare(
        `UPDATE tables SET status='available', venue_game_confirmed=? WHERE id=?`,
      ).run(table.bring_own_game ? 0 : 1, table.id);
      syncOpenTableStatus(db, table.id);
      return send(res, 200, serializeTable(db.prepare("SELECT * FROM tables WHERE id=?").get(table.id)));
    }

    if ((m = path.match(/^\/api\/tables\/(\d+)\/reject$/)) && method === "POST") {
      const u = requireUser(req, res);
      if (!u) return;
      const table = db.prepare("SELECT * FROM tables WHERE id=?").get(Number(m[1]));
      if (!table) return send(res, 404, { detail: "Not found." });
      if (!managesVenue(u, table.venue_id)) return send(res, 403, { detail: "Forbidden." });
      db.prepare(`UPDATE tables SET status='cancelled' WHERE id=?`).run(table.id);
      return send(res, 200, serializeTable(db.prepare("SELECT * FROM tables WHERE id=?").get(table.id)));
    }

    if ((m = path.match(/^\/api\/tables\/(\d+)\/cancel$/)) && method === "POST") {
      const u = requireUser(req, res);
      if (!u) return;
      const table = db.prepare("SELECT * FROM tables WHERE id=?").get(Number(m[1]));
      if (!table) return send(res, 404, { detail: "Not found." });
      if (table.organizer_id !== u.id && u.role !== "ADMIN") {
        return send(res, 403, { detail: "Forbidden." });
      }
      db.prepare(`UPDATE tables SET status='cancelled' WHERE id=?`).run(table.id);
      return send(res, 200, serializeTable(db.prepare("SELECT * FROM tables WHERE id=?").get(table.id)));
    }

    if ((m = path.match(/^\/api\/tables\/(\d+)\/seats$/))) {
      const tableId = Number(m[1]);
      const table = db.prepare("SELECT * FROM tables WHERE id=?").get(tableId);
      if (!table) return send(res, 404, { detail: "Not found." });
      if (method === "GET") {
        const u = requireUser(req, res);
        if (!u) return;
        const seats = db
          .prepare(
            `SELECT * FROM seats WHERE table_id=? AND status IN ('reserved','waitlisted') ORDER BY id`,
          )
          .all(tableId)
          .map(serializeSeat);
        return send(res, 200, seats);
      }
      if (method === "POST") {
        const u = requireUser(req, res);
        if (!u) return;
        if (!canHost(u)) return send(res, 403, { detail: "Only USER/ADMIN can reserve." });
        if (!JOINABLE_STATUSES.includes(canonicalTableStatus(table.status))) {
          return send(res, 409, { detail: "Venue has not confirmed this table yet." });
        }
        const existing = db
          .prepare(
            `SELECT id FROM seats WHERE table_id=? AND user_id=? AND status IN ('reserved','waitlisted')`,
          )
          .get(tableId, u.id);
        if (existing) return send(res, 409, { detail: "Already seated." });
        const reserved = db
          .prepare(`SELECT COUNT(*) AS c FROM seats WHERE table_id=? AND status='reserved'`)
          .get(tableId).c;
        let status = "reserved";
        let waitlist_position = null;
        if (reserved >= table.max_players) {
          status = "waitlisted";
          const maxPos =
            db
              .prepare(
                `SELECT MAX(waitlist_position) AS m FROM seats WHERE table_id=? AND status='waitlisted'`,
              )
              .get(tableId).m || 0;
          waitlist_position = maxPos + 1;
        }
        const paid = table.bring_own_game ? 1 : 0;
        const info = db
          .prepare(
            `INSERT INTO seats (table_id, user_id, is_organizer, status, waitlist_position, paid) VALUES (?, ?, 0, ?, ?, ?)`,
          )
          .run(tableId, u.id, status, waitlist_position, paid);
        if (status === "reserved") {
          const taken = reserved + 1;
          db.prepare("UPDATE tables SET seats_taken=? WHERE id=?").run(taken, tableId);
          syncOpenTableStatus(db, tableId);
        }
        return send(res, 201, serializeSeat(db.prepare("SELECT * FROM seats WHERE id=?").get(info.lastInsertRowid)));
      }
    }

    if ((m = path.match(/^\/api\/tables\/(\d+)\/seats\/pay$/)) && method === "POST") {
      const u = requireUser(req, res);
      if (!u) return;
      if (!canHost(u)) return send(res, 403, { detail: "Only USER/ADMIN can pay." });
      const tableId = Number(m[1]);
      const table = db.prepare("SELECT * FROM tables WHERE id=?").get(tableId);
      if (!table) return send(res, 404, { detail: "Not found." });
      const status = canonicalTableStatus(table.status);
      if (status === "cancelled" || status === "completed") {
        return send(res, 409, { detail: "This table is no longer active." });
      }
      if (table.bring_own_game) {
        return send(res, 409, { detail: "No payment is required for this table." });
      }
      const seat = db
        .prepare(
          `SELECT * FROM seats WHERE table_id=? AND user_id=? AND status='reserved'`,
        )
        .get(tableId, u.id);
      if (!seat) return send(res, 409, { detail: "You need a reserved seat to pay." });
      db.prepare("UPDATE seats SET paid=1 WHERE id=?").run(seat.id);
      syncOpenTableStatus(db, tableId);
      return send(res, 200, serializeSeat(db.prepare("SELECT * FROM seats WHERE id=?").get(seat.id)));
    }

    if ((m = path.match(/^\/api\/tables\/(\d+)\/seats\/cancel$/)) && method === "POST") {
      const u = requireUser(req, res);
      if (!u) return;
      const tableId = Number(m[1]);
      const seat = db
        .prepare(
          `SELECT * FROM seats WHERE table_id=? AND user_id=? AND status IN ('reserved','waitlisted')`,
        )
        .get(tableId, u.id);
      if (!seat) return send(res, 404, { detail: "No seat." });
      db.prepare(`UPDATE seats SET status='cancelled', waitlist_position=NULL WHERE id=?`).run(seat.id);
      if (seat.status === "reserved") {
        const table = db.prepare("SELECT * FROM tables WHERE id=?").get(tableId);
        const taken = db
          .prepare(`SELECT COUNT(*) AS c FROM seats WHERE table_id=? AND status='reserved'`)
          .get(tableId).c;
        db.prepare("UPDATE tables SET seats_taken=? WHERE id=?").run(taken, tableId);
        const next = db
          .prepare(
            `SELECT * FROM seats WHERE table_id=? AND status='waitlisted' ORDER BY waitlist_position ASC LIMIT 1`,
          )
          .get(tableId);
        if (next) {
          const paid = table.bring_own_game ? 1 : 0;
          db.prepare(
            `UPDATE seats SET status='reserved', waitlist_position=NULL, paid=? WHERE id=?`,
          ).run(paid, next.id);
          db.prepare("UPDATE tables SET seats_taken=? WHERE id=?").run(taken + 1, tableId);
        }
        syncOpenTableStatus(db, tableId);
      }
      return send(res, 200, serializeSeat(db.prepare("SELECT * FROM seats WHERE id=?").get(seat.id)));
    }

    // ---- Reviews ----
    if (method === "POST" && path === "/api/reviews") {
      const u = requireUser(req, res);
      if (!u) return;
      const body = await readBody(req);
      const info = db
        .prepare(
          `INSERT INTO reviews (author_id, table_id, target_type, target_user_id, target_venue_id, rating, body, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          u.id,
          body.table,
          body.target_type,
          body.target_user || null,
          body.target_venue || null,
          body.rating,
          body.body || "",
          new Date().toISOString(),
        );
      const r = db.prepare("SELECT * FROM reviews WHERE id=?").get(info.lastInsertRowid);
      return send(res, 201, {
        id: r.id,
        author: r.author_id,
        author_name: u.username,
        target_type: r.target_type,
        target_user: r.target_user_id,
        target_venue: r.target_venue_id,
        rating: r.rating,
        body: r.body,
        created_at: r.created_at,
      });
    }

    // ---- BGG (BGG_API_TOKEN enables live XML; Geekdo/Wikipedia fallbacks otherwise) ----
    if (method === "GET" && path === "/api/bgg/categories") {
      if (!requireUser(req, res)) return;
      return send(res, 200, { results: listCategories() });
    }

    if (method === "GET" && path === "/api/bgg/directory") {
      if (!requireUser(req, res)) return;
      const rows = db
        .prepare(
          `SELECT DISTINCT title AS name, bgg_id FROM venue_games WHERE is_active=1 AND bgg_id IS NOT NULL ORDER BY title`,
        )
        .all()
        .map((r) => ({ bgg_id: r.bgg_id, name: r.name, year: null }));
      return send(res, 200, { results: rows });
    }

    if (method === "GET" && path === "/api/bgg/search") {
      if (!requireUser(req, res)) return;
      const q = (url.searchParams.get("q") || "").trim();
      if (q.length < 2) return send(res, 200, { results: [] });
      // Default high so rare exact titles (e.g. ICE) are not cut off by a tiny page.
      const raw = Number(url.searchParams.get("limit") || 500);
      const limit = Math.min(Math.max(Number.isFinite(raw) ? raw : 500, 1), 1000);
      const rows = await liveSearch(q, limit);
      return send(res, 200, { results: rows });
    }

    if (method === "GET" && path === "/api/bgg/thing") {
      if (!requireUser(req, res)) return;
      const id = Number(url.searchParams.get("id"));
      if (!id) return send(res, 400, { detail: "id required." });
      return send(res, 200, await resolveThing(id));
    }

    if (method === "GET" && path === "/api/bgg/cover") {
      const q = url.searchParams.get("q") || "";
      const cover = await resolveCoverUrl(q);
      if (cover) return redirect(res, cover);
      return send(res, 404, { detail: "No cover." });
    }

    if (method === "GET" && path === "/api/bgg/redirect") {
      const q = url.searchParams.get("q") || "";
      const g = db
        .prepare(
          `SELECT bgg_id FROM venue_games WHERE title LIKE ? AND bgg_id IS NOT NULL LIMIT 1`,
        )
        .get(`%${q}%`);
      if (g?.bgg_id) return redirect(res, `https://boardgamegeek.com/boardgame/${g.bgg_id}`);
      return redirect(
        res,
        `https://boardgamegeek.com/geeksearch.php?action=search&objecttype=boardgame&q=${encodeURIComponent(q)}`,
      );
    }

    if (method === "GET" && path === "/api/users") {
      const u = requireUser(req, res);
      if (!u) return;
      return send(res, 200, searchUsers(db, u.id, url.searchParams.get("q") || ""));
    }

    if (method === "GET" && path === "/api/friends") {
      const u = requireUser(req, res);
      if (!u) return;
      return send(res, 200, listFriends(db, u.id));
    }

    if (method === "GET" && path === "/api/friends/requests") {
      const u = requireUser(req, res);
      if (!u) return;
      return send(res, 200, listRequests(db, u.id));
    }

    if (method === "POST" && path === "/api/friends/requests") {
      const u = requireUser(req, res);
      if (!u) return;
      const body = await readBody(req);
      return send(res, 201, sendRequest(db, u.id, body));
    }

    if ((m = path.match(/^\/api\/friends\/requests\/(\d+)\/accept$/)) && method === "POST") {
      const u = requireUser(req, res);
      if (!u) return;
      return send(res, 200, acceptRequest(db, u.id, m[1]));
    }

    if ((m = path.match(/^\/api\/friends\/requests\/(\d+)\/reject$/)) && method === "POST") {
      const u = requireUser(req, res);
      if (!u) return;
      return send(res, 200, rejectRequest(db, u.id, m[1]));
    }

    if (method === "GET" && path === "/api/chats") {
      const u = requireUser(req, res);
      if (!u) return;
      return send(res, 200, listChats(db, u.id));
    }

    if ((m = path.match(/^\/api\/chats\/(\d+)$/)) && method === "GET") {
      const u = requireUser(req, res);
      if (!u) return;
      return send(res, 200, getThread(db, u.id, m[1]));
    }

    if ((m = path.match(/^\/api\/chats\/(\d+)$/)) && method === "POST") {
      const u = requireUser(req, res);
      if (!u) return;
      const payload = await readBody(req);
      return send(res, 201, sendMessage(db, u.id, m[1], payload.body));
    }

    if ((m = path.match(/^\/api\/users\/(\d+)\/games$/)) && method === "GET") {
      const u = db.prepare("SELECT id FROM users WHERE id=?").get(Number(m[1]));
      if (!u) return send(res, 404, { detail: "Not found." });
      return send(res, 200, gameStats(db, u.id));
    }

    if ((m = path.match(/^\/api\/users\/(\d+)$/)) && method === "GET") {
      const u = db.prepare("SELECT * FROM users WHERE id=?").get(Number(m[1]));
      if (!u) return send(res, 404, { detail: "Not found." });
      const s = serializeUser(u);
      delete s.email;
      delete s.role;
      delete s.venue;
      delete s.allow_invites;
      const viewer = getUser(req);
      s.friendship = friendshipPayload(db, viewer?.id, u.id);
      return send(res, 200, s);
    }

    return send(res, 404, { detail: "Not found." });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error("[api]", err);
    return send(res, status, { detail: err.message || "Server error." });
  }
}

module.exports = { handleApi };
