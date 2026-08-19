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
} = require("./db");
const { resolveCoverUrl, resolveThing, liveSearch } = require("./bgg");
const { captchaPublicConfig, verifyCaptcha } = require("./captcha");
const { facebookPublicConfig, userFromFacebook, verifyFacebookAccessToken } = require("./facebook");
const {
  ACTIVATED_DETAIL,
  ACTIVATION_DETAIL,
  REGISTERED_DETAIL,
  RESEND_DETAIL,
  activateWithKey,
  emailConfigured,
  isActive,
  issueAndSendActivation,
  markEmailVerified,
} = require("./activation");
const {
  applyClosures,
  defaultWeeklyHours,
  setWeeklyHours,
  syncAvailabilityFromHours,
  horizonDaysFor,
} = require("./hours");
const { readPicture, savePicture } = require("./pictures");

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

function sendFile(res, status, buffer, contentType) {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Content-Length": buffer.length,
    "Cache-Control": "public, max-age=3600",
  });
  res.end(buffer);
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
    if (method === "GET" && path === "/api/auth/captcha/config") {
      return send(res, 200, captchaPublicConfig());
    }

    if (method === "POST" && path === "/api/auth/register") {
      const body = await readBody(req);
      const fwd = req.headers["x-forwarded-for"];
      const ip =
        (Array.isArray(fwd) ? fwd[0] : fwd)?.split(",")[0]?.trim() || req.socket?.remoteAddress;
      const captcha = await verifyCaptcha(body.captcha_token, ip);
      if (!captcha.ok) return send(res, 400, { captcha_token: [captcha.error] });
      const { username, email = "", password } = body;
      if (!username || !password) return send(res, 400, { detail: "username and password required." });
      const emailNorm = String(email || "").trim().toLowerCase();
      if (!emailNorm || !emailNorm.includes("@")) {
        return send(res, 400, { email: ["Email is required."] });
      }
      const pwErr = validPassword(password);
      if (pwErr) return send(res, 400, { password: [pwErr] });
      if (db.prepare("SELECT id FROM users WHERE username=?").get(username)) {
        return send(res, 400, { username: ["A user with that username already exists."] });
      }
      if (db.prepare("SELECT id FROM users WHERE email = ? COLLATE NOCASE").get(emailNorm)) {
        return send(res, 400, { email: ["A user with that email already exists."] });
      }
      if (!emailConfigured()) {
        return send(res, 503, { detail: "Email delivery is not configured." });
      }
      const info = db
        .prepare(
          `INSERT INTO users (username, email, password_hash, role, avatar_seed, is_active) VALUES (?, ?, ?, 'USER', ?, 0)`,
        )
        .run(username, emailNorm, hashPassword(password), username);
      const user = db.prepare("SELECT * FROM users WHERE id=?").get(info.lastInsertRowid);
      const mailed = await issueAndSendActivation(db, user);
      if (!mailed.ok) {
        return send(res, mailed.status || 500, { detail: mailed.error });
      }
      return send(res, 201, { detail: REGISTERED_DETAIL, email: emailNorm });
    }

    if (method === "POST" && path === "/api/auth/login") {
      const body = await readBody(req);
      const user = db.prepare("SELECT * FROM users WHERE username=?").get(body.username || "");
      if (!user || !checkPassword(body.password || "", user.password_hash)) {
        return send(res, 400, { non_field_errors: ["Unable to log in with provided credentials."] });
      }
      if (!isActive(user)) {
        return send(res, 403, { detail: ACTIVATION_DETAIL });
      }
      db.prepare("DELETE FROM tokens WHERE user_id=?").run(user.id);
      const token = newToken();
      db.prepare("INSERT INTO tokens (key, user_id) VALUES (?, ?)").run(token, user.id);
      return send(res, 200, { token });
    }

    if (method === "GET" && path === "/api/auth/activate") {
      const result = activateWithKey(db, url.searchParams.get("token") || "");
      if (!result.ok) return send(res, result.status, { detail: result.error });
      return send(res, 200, { detail: ACTIVATED_DETAIL });
    }

    if (method === "POST" && path === "/api/auth/activate") {
      const body = await readBody(req);
      const result = activateWithKey(db, body.token || url.searchParams.get("token") || "");
      if (!result.ok) return send(res, result.status, { detail: result.error });
      return send(res, 200, { detail: ACTIVATED_DETAIL });
    }

    if (method === "POST" && path === "/api/auth/activate/resend") {
      if (!emailConfigured()) {
        return send(res, 503, { detail: "Email delivery is not configured." });
      }
      const body = await readBody(req);
      const emailNorm = String(body.email || "").trim().toLowerCase();
      const pending = db
        .prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE AND is_active = 0")
        .get(emailNorm);
      if (pending && pending.email) {
        await issueAndSendActivation(db, pending);
      }
      return send(res, 200, { detail: RESEND_DETAIL });
    }

    if (method === "GET" && path === "/api/auth/facebook/config") {
      return send(res, 200, facebookPublicConfig());
    }

    if (method === "POST" && path === "/api/auth/facebook") {
      const body = await readBody(req);
      const verified = await verifyFacebookAccessToken(body.access_token || body.token);
      if (!verified.ok) return send(res, verified.status, { detail: verified.error });
      let created = false;
      let user;
      try {
        const result = userFromFacebook(db, verified.info);
        user = result.user;
        created = result.created;
      } catch (err) {
        return send(res, err.status || 400, { detail: err.message });
      }
      db.prepare("DELETE FROM tokens WHERE user_id=?").run(user.id);
      const token = newToken();
      db.prepare("INSERT INTO tokens (key, user_id) VALUES (?, ?)").run(token, user.id);
      return send(res, created ? 201 : 200, { token, user: serializeUser(user) });
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

    if (method === "POST" && path === "/api/me/password") {
      const u = requireUser(req, res);
      if (!u) return;
      if (!u.password_hash) {
        return send(res, 400, { detail: "This account uses social sign-in and has no password yet." });
      }
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
      const name = String(body.name || "").trim();
      const location = String(body.location || "").trim();
      if (!name) return send(res, 400, { name: ["This field is required."] });
      const description = String(body.description || "");
      if (description.length > 100) {
        return send(res, 400, { description: ["Ensure this field has no more than 100 characters."] });
      }
      const minSpend = String(body.min_spend || "").trim();
      if (minSpend.length > 80) {
        return send(res, 400, { min_spend: ["Ensure this field has no more than 80 characters."] });
      }
      const horizon = body.booking_horizon_weeks == null ? 12 : Number(body.booking_horizon_weeks);
      if (!Number.isInteger(horizon) || horizon < 1 || horizon > 52) {
        return send(res, 400, { booking_horizon_weeks: ["Booking horizon must be between 1 and 52 weeks."] });
      }
      const minMin = body.min_reservation_minutes ?? 60;
      const maxMin = body.max_reservation_minutes ?? 180;
      if (Number(minMin) < 30) {
        return send(res, 400, { min_reservation_minutes: ["Minimum reservation time must be at least 30 minutes."] });
      }
      if (Number(maxMin) < Number(minMin)) {
        return send(res, 400, {
          max_reservation_minutes: [
            "Maximum duration must be greater than or equal to the minimum reservation time.",
          ],
        });
      }
      const info = db
        .prepare(
          `INSERT INTO venues (name, description, location, min_players, max_players, min_reservation_minutes, max_reservation_minutes, min_spend, booking_horizon_weeks)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          name,
          description,
          location,
          body.min_players ?? 2,
          body.max_players ?? 8,
          minMin,
          maxMin,
          minSpend,
          horizon,
        );
      const venueId = Number(info.lastInsertRowid);
      if (body.picture_data) {
        try {
          const ext = savePicture(venueId, body.picture_data);
          db.prepare("UPDATE venues SET picture_ext=? WHERE id=?").run(ext, venueId);
        } catch (err) {
          db.prepare("DELETE FROM venues WHERE id=?").run(venueId);
          return send(res, err.status || 400, { picture_data: [err.message] });
        }
      }
      try {
        const hours = Array.isArray(body.weekly_hours) ? body.weekly_hours : defaultWeeklyHours();
        setWeeklyHours(db, venueId, hours);
        if (Array.isArray(body.closures) && body.closures.length) {
          applyClosures(db, venueId, body.closures);
          const venue = db.prepare("SELECT * FROM venues WHERE id=?").get(venueId);
          syncAvailabilityFromHours(db, venueId, horizonDaysFor(venue));
        }
      } catch (err) {
        db.prepare("DELETE FROM venues WHERE id=?").run(venueId);
        return send(res, err.status || 400, { weekly_hours: [err.message] });
      }
      return send(res, 201, serializeVenue(db.prepare("SELECT * FROM venues WHERE id=?").get(venueId)));
    }

    let m;
    if ((m = path.match(/^\/api\/venues\/(\d+)\/picture$/)) && method === "GET") {
      const id = Number(m[1]);
      const venue = db.prepare("SELECT * FROM venues WHERE id=?").get(id);
      if (!venue) return send(res, 404, { detail: "Not found." });
      const pic = readPicture(id, venue.picture_ext);
      if (!pic) return send(res, 404, { detail: "No picture." });
      return sendFile(res, 200, pic.buffer, pic.contentType);
    }

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
            max_reservation_minutes=COALESCE(?, max_reservation_minutes),
            min_spend=COALESCE(?, min_spend),
            booking_horizon_weeks=COALESCE(?, booking_horizon_weeks)
           WHERE id=?`,
        ).run(
          body.name ?? null,
          body.description ?? null,
          body.location ?? null,
          body.min_players ?? null,
          body.max_players ?? null,
          body.min_reservation_minutes ?? null,
          body.max_reservation_minutes ?? null,
          body.min_spend ?? null,
          body.booking_horizon_weeks ?? null,
          id,
        );
        if (body.picture_data) {
          try {
            const ext = savePicture(id, body.picture_data);
            db.prepare("UPDATE venues SET picture_ext=? WHERE id=?").run(ext, id);
          } catch (err) {
            return send(res, err.status || 400, { picture_data: [err.message] });
          }
        }
        if (body.booking_horizon_weeks != null) {
          const updated = db.prepare("SELECT * FROM venues WHERE id=?").get(id);
          syncAvailabilityFromHours(db, id, horizonDaysFor(updated));
        }
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
        try {
          const saved = setWeeklyHours(db, id, rows);
          return send(res, 200, saved);
        } catch (err) {
          return send(res, err.status || 400, { detail: err.message });
        }
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
        const venue = db.prepare("SELECT * FROM venues WHERE id=?").get(id);
        syncAvailabilityFromHours(db, id, horizonDaysFor(venue));
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
      const venue = db.prepare("SELECT * FROM venues WHERE id=?").get(venueId);
      if (venue) syncAvailabilityFromHours(db, venueId, horizonDaysFor(venue));
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
        if (status === "available") {
          sql += " AND status IN ('waiting_for_players','confirmed')";
        } else if (status) {
          sql += " AND status=?";
          params.push(status);
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
             VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 'waiting_for_venue_confirmation', 1, ?)`,
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
        db.prepare(
          `INSERT INTO seats (table_id, user_id, is_organizer, status) VALUES (?, ?, 1, 'reserved')`,
        ).run(info.lastInsertRowid, u.id);
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
      if (table.status !== "waiting_for_venue_confirmation") {
        return send(res, 409, { detail: "Table is not awaiting confirmation." });
      }
      db.prepare(
        `UPDATE tables SET status='waiting_for_players', venue_game_confirmed=? WHERE id=?`,
      ).run(table.bring_own_game ? 0 : 1, table.id);
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
        if (!["waiting_for_players", "confirmed"].includes(table.status)) {
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
        const info = db
          .prepare(
            `INSERT INTO seats (table_id, user_id, is_organizer, status, waitlist_position) VALUES (?, ?, 0, ?, ?)`,
          )
          .run(tableId, u.id, status, waitlist_position);
        if (status === "reserved") {
          const taken = reserved + 1;
          db.prepare("UPDATE tables SET seats_taken=? WHERE id=?").run(taken, tableId);
          if (taken >= table.min_players && table.status === "waiting_for_players") {
            db.prepare("UPDATE tables SET status='confirmed' WHERE id=?").run(tableId);
          }
        }
        return send(res, 201, serializeSeat(db.prepare("SELECT * FROM seats WHERE id=?").get(info.lastInsertRowid)));
      }
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
          db.prepare(
            `UPDATE seats SET status='reserved', waitlist_position=NULL WHERE id=?`,
          ).run(next.id);
          db.prepare("UPDATE tables SET seats_taken=? WHERE id=?").run(taken + 1, tableId);
        }
        const table = db.prepare("SELECT * FROM tables WHERE id=?").get(tableId);
        const reserved = db
          .prepare(`SELECT COUNT(*) AS c FROM seats WHERE table_id=? AND status='reserved'`)
          .get(tableId).c;
        if (table.status === "confirmed" && reserved < table.min_players) {
          db.prepare("UPDATE tables SET status='waiting_for_players' WHERE id=?").run(tableId);
        }
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

    if ((m = path.match(/^\/api\/users\/(\d+)$/)) && method === "GET") {
      const u = db.prepare("SELECT * FROM users WHERE id=?").get(Number(m[1]));
      if (!u) return send(res, 404, { detail: "Not found." });
      const s = serializeUser(u);
      delete s.email;
      delete s.role;
      delete s.venue;
      delete s.allow_invites;
      return send(res, 200, s);
    }

    return send(res, 404, { detail: "Not found." });
  } catch (err) {
    console.error("[api]", err);
    const status = err.status || 500;
    return send(res, status, { detail: err.message || "Server error." });
  }
}

module.exports = { handleApi };
