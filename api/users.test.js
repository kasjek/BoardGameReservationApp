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

  function playedCount(userId) {
    return db
      .prepare(
        `SELECT COUNT(*) AS c
         FROM seats s JOIN tables t ON t.id = s.table_id
         WHERE s.user_id=? AND s.status='reserved' AND t.status != 'cancelled'`,
      )
      .get(userId).c;
  }
  function differentCount(userId) {
    return db
      .prepare(
        `SELECT COUNT(DISTINCT lower(t.game_title)) AS c
         FROM seats s JOIN tables t ON t.id = s.table_id
         WHERE s.user_id=? AND s.status='reserved' AND t.status != 'cancelled'`,
      )
      .get(userId).c;
  }

  const alice = db.prepare("SELECT * FROM users WHERE username='alice'").get();
  const demo = db.prepare("SELECT * FROM users WHERE username='demo'").get();
  const alicePlayed = playedCount(alice.id);
  const aliceDifferent = differentCount(alice.id);
  const demoPlayed = playedCount(demo.id);
  const demoDifferent = differentCount(demo.id);
  const profile = await api("GET", `/api/users/${alice.id}`);
  assert(profile.statusCode === 200, "public profile 200");
  assert(profile.body.username === "alice", "username is login");
  assert(profile.body.email === undefined, "email omitted");
  assert(typeof profile.body.avatar_seed === "string", "avatar_seed present");
  assert("rating_avg" in profile.body, "rating present");
  assert("late_cancel_marks_active" in profile.body, "late cancellations present");
  assert(
    profile.body.games_played === alicePlayed,
    `alice games_played ${alicePlayed} (got ${profile.body.games_played})`,
  );
  assert(
    profile.body.different_games === aliceDifferent,
    `alice different_games ${aliceDifferent} (got ${profile.body.different_games})`,
  );

  const demoProfile = await api("GET", `/api/users/${demo.id}`);
  assert(
    demoProfile.body.games_played === demoPlayed,
    `demo games_played ${demoPlayed} (got ${demoProfile.body.games_played})`,
  );
  assert(
    demoProfile.body.different_games === demoDifferent,
    `demo different_games ${demoDifferent} (got ${demoProfile.body.different_games})`,
  );

  const demoTable = db
    .prepare(
      `SELECT t.id, t.game_title FROM tables t
       WHERE t.organizer_id=? AND t.status != 'cancelled'
         AND t.id NOT IN (SELECT table_id FROM seats WHERE user_id=?)
       LIMIT 1`,
    )
    .get(demo.id, alice.id);
  db.prepare(
    `INSERT INTO seats (table_id, user_id, is_organizer, status, waitlist_position) VALUES (?, ?, 0, 'reserved', NULL)`,
  ).run(demoTable.id, alice.id);
  const joinedNewTitle = !db
    .prepare(
      `SELECT 1 FROM seats s JOIN tables t ON t.id = s.table_id
       WHERE s.user_id=? AND s.status='reserved' AND t.status != 'cancelled'
         AND t.id != ? AND lower(t.game_title)=lower(?)`,
    )
    .get(alice.id, demoTable.id, demoTable.game_title);

  const after = await api("GET", `/api/users/${alice.id}`);
  assert(
    after.body.games_played === alicePlayed + 1,
    `alice after join games_played ${alicePlayed + 1} (got ${after.body.games_played})`,
  );
  assert(
    after.body.different_games === aliceDifferent + (joinedNewTitle ? 1 : 0),
    `alice different games after join (got ${after.body.different_games})`,
  );

  const games = await api("GET", `/api/users/${alice.id}/games`);
  assert(games.statusCode === 200, "games list 200");
  assert(games.body.sessions.length === alicePlayed + 1, "sessions include the new join");
  assert(
    games.body.titles.length === aliceDifferent + (joinedNewTitle ? 1 : 0),
    "unique titles after join",
  );
  const titles = games.body.titles.map((row) => row.title).sort();
  assert(titles.includes("The Isle of Cats"), "includes Isle of Cats");

  const cancelTable = db
    .prepare(
      `SELECT t.id FROM tables t
       WHERE t.organizer_id=? AND t.status != 'cancelled'
         AND t.id NOT IN (SELECT table_id FROM seats WHERE user_id=?)
       LIMIT 1`,
    )
    .get(demo.id, alice.id);
  db.prepare(
    `INSERT INTO seats (table_id, user_id, is_organizer, status, waitlist_position)
     VALUES (?, ?, 0, 'cancelled', NULL)`,
  ).run(cancelTable.id, alice.id);
  const still = await api("GET", `/api/users/${alice.id}`);
  assert(still.body.games_played === alicePlayed + 1, "cancelled seat does not add a played game");

  if (failed) {
    console.error(`\n${failed} failed`);
    process.exit(1);
  }
  console.log("\nall passed");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
