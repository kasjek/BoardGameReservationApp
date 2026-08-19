#!/usr/bin/env node
/** Seat limits on venue games clamp tables; Patchwork stays 2–2 via inventory. */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { Readable } = require("stream");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tmg-patchwork-"));
process.env.DATA_DIR = dir;
process.env.SQLITE_PATH = path.join(dir, "app.sqlite3");
process.env.NODE_ENV = "development";

const { ensureDb, newToken } = require("./db");
const { applyGamePlayerLimits, capTablesToGameLimits, effectiveMaxPlayers } = require("./game-limits");
const { handleApi } = require("./handler");

const db = ensureDb();
let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  } else {
    console.log("ok ", msg);
  }
}

function mockReq(method, urlPath, { token, body } = {}) {
  const raw = body ? Buffer.from(JSON.stringify(body)) : Buffer.from("");
  const req = Readable.from([raw]);
  req.method = method;
  req.url = urlPath;
  req.headers = {};
  if (token) req.headers.authorization = `Token ${token}`;
  req.socket = { remoteAddress: "127.0.0.1" };
  return req;
}

function mockRes() {
  const res = {
    statusCode: 0,
    body: null,
    headers: {},
    writeHead(status, headers) {
      this.statusCode = status;
      this.headers = headers || {};
    },
    end(raw) {
      if (!raw) {
        this.body = null;
        return;
      }
      try {
        this.body = JSON.parse(raw);
      } catch {
        this.body = raw;
      }
    },
  };
  return res;
}

async function api(method, urlPath, opts = {}) {
  const req = mockReq(method, urlPath, opts);
  const res = mockRes();
  await handleApi(req, res);
  return res;
}

function tokenFor(username) {
  const user = db.prepare("SELECT * FROM users WHERE username=?").get(username);
  const token = newToken();
  db.prepare("INSERT INTO tokens (key, user_id) VALUES (?, ?)").run(token, user.id);
  return { user, token };
}

function insertTable({ organizerId, venueId, title, minPlayers, maxPlayers, status }) {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() + 4);
  start.setHours(14, 0, 0, 0);
  const end = new Date(start);
  end.setHours(16, 0, 0, 0);
  const info = db
    .prepare(
      `INSERT INTO tables (organizer_id, venue_id, game_title, bring_own_game, game_language, game_language_other, venue_game_confirmed, starts_at, ends_at, min_players, max_players, status, seats_taken, created_at)
       VALUES (?, ?, ?, 0, 'en', '', 1, ?, ?, ?, ?, ?, 1, ?)`,
    )
    .run(
      organizerId,
      venueId,
      title,
      start.toISOString(),
      end.toISOString(),
      minPlayers,
      maxPlayers,
      status,
      now.toISOString(),
    );
  db.prepare(
    `INSERT INTO seats (table_id, user_id, is_organizer, status, paid) VALUES (?, ?, 1, 'reserved', 0)`,
  ).run(info.lastInsertRowid, organizerId);
  return info.lastInsertRowid;
}

(async () => {
  const venue = db.prepare("SELECT * FROM venues WHERE name='Date House Cafe'").get();
  const clamped = applyGamePlayerLimits(db, {
    title: "Patchwork",
    minPlayers: 2,
    maxPlayers: 4,
    venueMin: 2,
    venueMax: 8,
    venueId: venue.id,
  });
  assert(clamped.min_players === 2 && clamped.max_players === 2, "Patchwork create payload clamped to 2");
  const other = applyGamePlayerLimits(db, {
    title: "Love Letter",
    minPlayers: 2,
    maxPlayers: 4,
    venueMin: 2,
    venueMax: 8,
    venueId: venue.id,
  });
  assert(other.min_players === 2 && other.max_players === 4, "ranged inventory games keep requested max");
  const unknown = applyGamePlayerLimits(db, {
    title: "Unknown Title",
    minPlayers: 2,
    maxPlayers: 4,
    venueMin: 2,
    venueMax: 8,
    venueId: venue.id,
  });
  assert(unknown.min_players === 2 && unknown.max_players === 4, "games not in inventory keep requested max");
  assert(
    effectiveMaxPlayers(db, { venue_id: venue.id, game_title: "Patchwork", max_players: 4 }) === 2,
    "effective max is 2 even if stored 4",
  );

  const demo = tokenFor("demo");
  const alice = tokenFor("alice");
  const bob = tokenFor("bob");
  const datehouse = tokenFor("datehouse");
  const avail = db.prepare("SELECT * FROM venue_availability WHERE venue_id=? LIMIT 1").get(venue.id);
  const [sh, sm] = avail.start_time.split(":").map(Number);
  const endHm = `${String(sh + 2).padStart(2, "0")}:${String(sm).padStart(2, "0")}`;
  const startsAt = `${avail.date}T${avail.start_time}:00.000Z`;
  const endsAt = `${avail.date}T${endHm}:00.000Z`;

  const created = await api("POST", "/api/tables", {
    token: demo.token,
    body: {
      venue: venue.id,
      game_title: "Patchwork",
      bring_own_game: false,
      game_language: "en",
      starts_at: startsAt,
      ends_at: endsAt,
      min_players: 2,
      max_players: 4,
    },
  });
  assert(created.statusCode === 201, `create Patchwork 201 (got ${created.statusCode})`);
  assert(created.body.max_players === 2, `created Patchwork max_players is 2 (got ${created.body.max_players})`);
  assert(created.body.min_players === 2, "created Patchwork min_players is 2");

  const confirmed = await api("POST", `/api/tables/${created.body.id}/confirm`, {
    token: datehouse.token,
  });
  assert(confirmed.statusCode === 200, "venue confirms Patchwork table");

  const second = await api("POST", `/api/tables/${created.body.id}/seats`, { token: alice.token });
  assert(second.statusCode === 201 && second.body.status === "reserved", "second player gets a reserved seat");

  const third = await api("POST", `/api/tables/${created.body.id}/seats`, { token: bob.token });
  assert(third.statusCode === 201 && third.body.status === "waitlisted", "third player is waitlisted");

  const after = await api("GET", `/api/tables/${created.body.id}`, { token: demo.token });
  assert(after.body.seats_taken === 2, `only 2 reserved seats (got ${after.body.seats_taken})`);
  assert(after.body.max_players === 2, "stored max_players stays 2");

  const leftoverId = insertTable({
    organizerId: demo.user.id,
    venueId: venue.id,
    title: "Patchwork",
    minPlayers: 2,
    maxPlayers: 4,
    status: "available",
  });
  const capped = capTablesToGameLimits(db);
  assert(capped >= 1, "capTablesToGameLimits updates leftover rows");
  const leftover = db.prepare("SELECT * FROM tables WHERE id=?").get(leftoverId);
  assert(leftover.max_players === 2, "existing Patchwork tables are capped to 2 seats");

  const unmigratedId = insertTable({
    organizerId: alice.user.id,
    venueId: venue.id,
    title: "Patchwork",
    minPlayers: 2,
    maxPlayers: 4,
    status: "available",
  });
  const joinUnmigrated = await api("POST", `/api/tables/${unmigratedId}/seats`, { token: bob.token });
  assert(joinUnmigrated.body.status === "reserved", "second seat on unmigrated Patchwork is reserved");
  const chester = tokenFor("chester");
  const waitUnmigrated = await api("POST", `/api/tables/${unmigratedId}/seats`, { token: chester.token });
  assert(waitUnmigrated.body.status === "waitlisted", "third seat on unmigrated Patchwork is waitlisted");

  if (failed) {
    console.error(`${failed} failed`);
    process.exit(1);
  }
  console.log("all patchwork-seats tests passed");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
