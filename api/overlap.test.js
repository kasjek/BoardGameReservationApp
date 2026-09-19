#!/usr/bin/env node
/** A user cannot hold two reserved seats whose times overlap. */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { Readable } = require("stream");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tmg-overlap-"));
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

function slotOn(venueId, date, startHm, endHm) {
  return {
    starts_at: `${date}T${startHm}:00.000Z`,
    ends_at: `${date}T${endHm}:00.000Z`,
  };
}

(async () => {
  const demo = tokenFor("demo");
  const alice = tokenFor("alice");
  const datehouse = tokenFor("datehouse");
  const dateHouse = db.prepare("SELECT * FROM venues WHERE name='Date House Cafe'").get();
  const knorzVenue = db.prepare("SELECT * FROM venues WHERE name='Hotel Knorz'").get();
  const avail = db
    .prepare("SELECT * FROM venue_availability WHERE venue_id=? AND start_time<='14:00' AND end_time>='18:00' LIMIT 1")
    .get(dateHouse.id);
  const date = avail.date;
  const firstSlot = slotOn(dateHouse.id, date, "14:00", "16:00");
  const overlapSlot = slotOn(dateHouse.id, date, "15:00", "17:00");
  const laterSlot = slotOn(dateHouse.id, date, "17:00", "19:00");
  const otherVenueSlot = slotOn(knorzVenue.id, date, "14:30", "16:30");

  const first = await api("POST", "/api/tables", {
    token: demo.token,
    body: {
      venue: dateHouse.id,
      game_title: "Catan",
      bring_own_game: true,
      game_language: "en",
      starts_at: firstSlot.starts_at,
      ends_at: firstSlot.ends_at,
      min_players: 2,
      max_players: 4,
    },
  });
  assert(first.statusCode === 201, `first table 201 (got ${first.statusCode})`);

  const overlapCreate = await api("POST", "/api/tables", {
    token: demo.token,
    body: {
      venue: dateHouse.id,
      game_title: "Azul",
      bring_own_game: true,
      game_language: "en",
      starts_at: overlapSlot.starts_at,
      ends_at: overlapSlot.ends_at,
      min_players: 2,
      max_players: 4,
    },
  });
  assert(overlapCreate.statusCode === 409, `overlapping create 409 (got ${overlapCreate.statusCode})`);
  assert(
    String(overlapCreate.body.detail || "").toLowerCase().includes("overlap"),
    "create error mentions overlap",
  );

  const otherVenue = await api("POST", "/api/tables", {
    token: demo.token,
    body: {
      venue: knorzVenue.id,
      game_title: "Secret Hitler",
      bring_own_game: true,
      game_language: "en",
      starts_at: otherVenueSlot.starts_at,
      ends_at: otherVenueSlot.ends_at,
      min_players: 2,
      max_players: 4,
    },
  });
  assert(otherVenue.statusCode === 409, `other venue overlap 409 (got ${otherVenue.statusCode})`);

  const later = await api("POST", "/api/tables", {
    token: demo.token,
    body: {
      venue: dateHouse.id,
      game_title: "Love Letter",
      bring_own_game: true,
      game_language: "en",
      starts_at: laterSlot.starts_at,
      ends_at: laterSlot.ends_at,
      min_players: 2,
      max_players: 4,
    },
  });
  assert(later.statusCode === 201, `non-overlapping later table 201 (got ${later.statusCode})`);

  const aliceTable = await api("POST", "/api/tables", {
    token: alice.token,
    body: {
      venue: dateHouse.id,
      game_title: "Onitama",
      bring_own_game: true,
      game_language: "en",
      starts_at: firstSlot.starts_at,
      ends_at: firstSlot.ends_at,
      min_players: 2,
      max_players: 4,
    },
  });
  assert(aliceTable.statusCode === 201, "another user can take the same slot");

  const confirmed = await api("POST", `/api/tables/${first.body.id}/confirm`, {
    token: datehouse.token,
  });
  assert(confirmed.statusCode === 200 || confirmed.statusCode === 201, `confirm first (got ${confirmed.statusCode})`);

  const aliceJoin = await api("POST", `/api/tables/${first.body.id}/seats`, { token: alice.token });
  assert(aliceJoin.statusCode === 409, `alice cannot join overlapping hosted table (got ${aliceJoin.statusCode})`);

  if (failed) {
    console.error(`${failed} failed`);
    process.exit(1);
  }
  console.log("all overlap tests passed");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
