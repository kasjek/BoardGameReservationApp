#!/usr/bin/env node
/** Admin/manager can set min/max seats when adding a venue game. */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { Readable } = require("stream");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tmg-venue-games-"));
process.env.DATA_DIR = dir;
process.env.SQLITE_PATH = path.join(dir, "app.sqlite3");
process.env.NODE_ENV = "development";

const { ensureDb, newToken } = require("./db");
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

function slotFor(venueId) {
  const avail = db.prepare("SELECT * FROM venue_availability WHERE venue_id=? LIMIT 1").get(venueId);
  const [sh, sm] = avail.start_time.split(":").map(Number);
  const endHm = `${String(sh + 2).padStart(2, "0")}:${String(sm).padStart(2, "0")}`;
  return {
    starts_at: `${avail.date}T${avail.start_time}:00.000Z`,
    ends_at: `${avail.date}T${endHm}:00.000Z`,
  };
}

(async () => {
  const admin = tokenFor("admin");
  const demo = tokenFor("demo");
  const alice = tokenFor("alice");
  const venue = db.prepare("SELECT * FROM venues WHERE name='Date House Cafe'").get();

  const listed = await api("GET", `/api/venues/${venue.id}/games`);
  const patchwork = listed.body.find((row) => /patchwork/i.test(row.title));
  assert(patchwork.min_players === 2 && patchwork.max_players === 2, "seeded Patchwork is 2–2 seats");

  const added = await api("POST", `/api/venues/${venue.id}/games`, {
    token: admin.token,
    body: { title: "Azul", bgg_id: 230802, min_players: 2, max_players: 4 },
  });
  assert(added.statusCode === 201, `admin add game 201 (got ${added.statusCode})`);
  assert(added.body.min_players === 2 && added.body.max_players === 4, "stored seat limits from add");

  const patched = await api("PATCH", `/api/venues/${venue.id}/games/${added.body.id}`, {
    token: admin.token,
    body: { min_players: 3, max_players: 4 },
  });
  assert(patched.statusCode === 200, `patch seats 200 (got ${patched.statusCode})`);
  assert(patched.body.min_players === 3 && patched.body.max_players === 4, "patched seat limits");
  assert(patched.body.title === "Azul", "patch response keeps the game title");

  const invalid = await api("PATCH", `/api/venues/${venue.id}/games/${added.body.id}`, {
    token: admin.token,
    body: { min_players: 5, max_players: 2 },
  });
  assert(invalid.statusCode === 400, `min > max is 400 (got ${invalid.statusCode})`);

  const forbidden = await api("POST", `/api/venues/${venue.id}/games`, {
    token: demo.token,
    body: { title: "Wingspan", min_players: 1, max_players: 5 },
  });
  assert(forbidden.statusCode === 403, "regular user cannot add venue games");

  const slot = slotFor(venue.id);
  const azulTable = await api("POST", "/api/tables", {
    token: demo.token,
    body: {
      venue: venue.id,
      game_title: "Azul",
      bring_own_game: false,
      game_language: "en",
      starts_at: slot.starts_at,
      ends_at: slot.ends_at,
      min_players: 2,
      max_players: 8,
    },
  });
  assert(azulTable.statusCode === 201, `Azul table 201 (got ${azulTable.statusCode})`);
  assert(azulTable.body.min_players === 3, `Azul min clamped to 3 (got ${azulTable.body.min_players})`);
  assert(azulTable.body.max_players === 4, `Azul max clamped to 4 (got ${azulTable.body.max_players})`);

  const loveLetter = await api("POST", "/api/tables", {
    token: alice.token,
    body: {
      venue: venue.id,
      game_title: "Love Letter",
      bring_own_game: false,
      game_language: "en",
      starts_at: slot.starts_at,
      ends_at: slot.ends_at,
      min_players: 2,
      max_players: 4,
    },
  });
  assert(loveLetter.statusCode === 201, `Love Letter table 201 (got ${loveLetter.statusCode})`);
  assert(
    loveLetter.body.min_players === 2 && loveLetter.body.max_players === 4,
    "2–8 inventory game keeps host's requested 2–4",
  );

  if (failed) {
    console.error(`${failed} failed`);
    process.exit(1);
  }
  console.log("all venue-games tests passed");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
