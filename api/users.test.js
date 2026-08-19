#!/usr/bin/env node
/** Public user profile: rating/avatar/login, game stats, games list. */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { Readable } = require("stream");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tmg-users-"));
process.env.DATA_DIR = dir;
process.env.SQLITE_PATH = path.join(dir, "app.sqlite3");
process.env.NODE_ENV = "development";

const { ensureDb } = require("./db");
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

function mockReq(method, urlPath) {
  const req = Readable.from([Buffer.from("")]);
  req.method = method;
  req.url = urlPath;
  req.headers = {};
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

async function api(method, urlPath) {
  const req = mockReq(method, urlPath);
  const res = mockRes();
  await handleApi(req, res);
  return res;
}

(async () => {
  const missing = await api("GET", "/api/users/999999");
  assert(missing.statusCode === 404, "unknown user 404");

  const alice = db.prepare("SELECT * FROM users WHERE username='alice'").get();
  const demo = db.prepare("SELECT * FROM users WHERE username='demo'").get();
  const profile = await api("GET", `/api/users/${alice.id}`);
  assert(profile.statusCode === 200, "public profile 200");
  assert(profile.body.username === "alice", "username is login");
  assert(profile.body.email === undefined, "email omitted");
  assert(typeof profile.body.avatar_seed === "string", "avatar_seed present");
  assert("rating_avg" in profile.body, "rating present");
  assert("late_cancel_marks_active" in profile.body, "late cancellations present");
  assert(profile.body.games_played === 1, `alice games_played 1 (got ${profile.body.games_played})`);
  assert(profile.body.different_games === 1, "alice different_games 1");

  const demoProfile = await api("GET", `/api/users/${demo.id}`);
  assert(demoProfile.body.games_played === 2, `demo games_played 2 (got ${demoProfile.body.games_played})`);
  assert(demoProfile.body.different_games === 2, "demo two different titles");

  const demoTable = db.prepare("SELECT id FROM tables WHERE organizer_id=? LIMIT 1").get(demo.id);
  db.prepare(
    `INSERT INTO seats (table_id, user_id, is_organizer, status, waitlist_position) VALUES (?, ?, 0, 'reserved', NULL)`,
  ).run(demoTable.id, alice.id);

  const after = await api("GET", `/api/users/${alice.id}`);
  assert(after.body.games_played === 2, `alice after join games_played 2 (got ${after.body.games_played})`);
  assert(after.body.different_games === 2, "alice two different games after join");

  const games = await api("GET", `/api/users/${alice.id}/games`);
  assert(games.statusCode === 200, "games list 200");
  assert(games.body.sessions.length === 2, "two sessions");
  assert(games.body.titles.length === 2, "two unique titles");
  const titles = games.body.titles.map((row) => row.title).sort();
  assert(titles.includes("The Isle of Cats"), "includes Isle of Cats");

  db.prepare(
    `INSERT INTO seats (table_id, user_id, is_organizer, status, waitlist_position)
     SELECT id, ?, 0, 'cancelled', NULL FROM tables WHERE organizer_id=? LIMIT 1`,
  ).run(alice.id, demo.id);
  const still = await api("GET", `/api/users/${alice.id}`);
  assert(still.body.games_played === 2, "cancelled seat does not add a played game");

  if (failed) {
    console.error(`\n${failed} failed`);
    process.exit(1);
  }
  console.log("\nall passed");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
