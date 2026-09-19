#!/usr/bin/env node
/** New tables must start at least 24 hours from now. */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { Readable } = require("stream");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tmg-lead-"));
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

(async () => {
  const alice = tokenFor("alice");
  const venue = db.prepare("SELECT * FROM venues WHERE name='Date House Cafe'").get();

  const tooSoonStart = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const tooSoonEnd = new Date(tooSoonStart.getTime() + 2 * 60 * 60 * 1000);
  const soon = await api("POST", "/api/tables", {
    token: alice.token,
    body: {
      venue: venue.id,
      game_title: "Catan",
      bring_own_game: true,
      game_language: "en",
      starts_at: tooSoonStart.toISOString(),
      ends_at: tooSoonEnd.toISOString(),
      min_players: 2,
      max_players: 4,
    },
  });
  assert(soon.statusCode === 400, `too-soon create 400 (got ${soon.statusCode})`);
  assert(String(soon.body.detail || "").includes("24"), "error mentions 24 hours");

  const minDate = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const avail = db
    .prepare(
      "SELECT * FROM venue_availability WHERE venue_id=? AND date>=? AND start_time<='14:00' AND end_time>='16:00' LIMIT 1",
    )
    .get(venue.id, minDate);
  const ok = await api("POST", "/api/tables", {
    token: alice.token,
    body: {
      venue: venue.id,
      game_title: "Catan",
      bring_own_game: true,
      game_language: "en",
      starts_at: `${avail.date}T14:00:00.000Z`,
      ends_at: `${avail.date}T16:00:00.000Z`,
      min_players: 2,
      max_players: 4,
    },
  });
  assert(ok.statusCode === 201, `24h+ create 201 (got ${ok.statusCode})`);

  if (failed) {
    console.error(`${failed} failed`);
    process.exit(1);
  }
  console.log("all lead-time tests passed");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
