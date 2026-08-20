#!/usr/bin/env node
/** XP cosmetics: unique-game unlocks, equip/unequip, persist across dice roll. */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { Readable } = require("stream");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tmg-cosmetics-"));
process.env.DATA_DIR = dir;
process.env.SQLITE_PATH = path.join(dir, "app.sqlite3");
process.env.NODE_ENV = "development";

const { earnedUnlockIds, GAMES_PER_UNLOCK, COSMETIC_CATALOG } = require("./cosmetics");
const { ensureDb, hashPassword, newToken } = require("./db");
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
  const raw = body !== undefined ? Buffer.from(JSON.stringify(body)) : Buffer.from("");
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

function tokenFor(userId) {
  const token = newToken();
  db.prepare("INSERT INTO tokens (key, user_id) VALUES (?, ?)").run(token, userId);
  return token;
}

function addPlayedTitles(userId, titles) {
  const venue = db.prepare("SELECT id FROM venues LIMIT 1").get();
  const insertTable = db.prepare(
    `INSERT INTO tables (organizer_id, venue_id, game_title, bring_own_game, game_language, venue_game_confirmed, starts_at, ends_at, min_players, max_players, status, seats_taken, created_at)
     VALUES (?, ?, ?, 0, 'en', 1, ?, ?, 2, 4, 'confirmed_paid', 1, ?)`,
  );
  const insertSeat = db.prepare(
    `INSERT INTO seats (table_id, user_id, is_organizer, status, waitlist_position, paid) VALUES (?, ?, 1, 'reserved', NULL, 1)`,
  );
  const created = new Date().toISOString();
  titles.forEach((title, i) => {
    const start = new Date(Date.now() - (i + 3) * 86400000);
    const end = new Date(start.getTime() + 2 * 3600000);
    const tid = insertTable.run(
      userId,
      venue.id,
      title,
      start.toISOString(),
      end.toISOString(),
      created,
    ).lastInsertRowid;
    insertSeat.run(tid, userId);
  });
}

assert(earnedUnlockIds(0).length === 0, "0 games → no unlocks");
assert(earnedUnlockIds(9).length === 0, "9 games → no unlocks");
assert(earnedUnlockIds(10).join(",") === "bg-lilac", "10 games → first item");
assert(earnedUnlockIds(20).length === 2, "20 games → two items");
assert(earnedUnlockIds(100).length === COSMETIC_CATALOG.length, "100 games → full catalog");
assert(GAMES_PER_UNLOCK === 10, "unlock every 10 unique games");

(async () => {
  const info = db
    .prepare(
      `INSERT INTO users (username, email, password_hash, role, avatar_seed) VALUES (?, ?, ?, 'USER', ?)`,
    )
    .run("cosmo", "cosmo@example.com", hashPassword("Passw0rd!"), "cosmo");
  const userId = info.lastInsertRowid;
  const token = tokenFor(userId);

  const before = await api("GET", "/api/auth/me", { token });
  assert(before.statusCode === 200, "me 200");
  assert(Array.isArray(before.body.avatar_unlocks) && before.body.avatar_unlocks.length === 0, "no unlocks yet");
  assert(before.body.avatar_equipped.hat === null, "nothing equipped");

  addPlayedTitles(userId, ["Azul", "Catan", "Carcassonne", "Wingspan", "Splendor", "Root", "Dixit", "Scout", "Heat"]);
  const nine = await api("GET", "/api/auth/me", { token });
  assert(nine.body.different_games === 9, `9 unique games (got ${nine.body.different_games})`);
  assert(nine.body.avatar_unlocks.length === 0, "still locked at 9");

  addPlayedTitles(userId, ["Pandemic"]);
  const ten = await api("GET", "/api/auth/me", { token });
  assert(ten.body.different_games === 10, "10 unique games");
  assert(ten.body.avatar_unlocks[0] === "bg-lilac", "unlocks lilac background");

  const locked = await api("PATCH", "/api/me/avatar/cosmetics", {
    token,
    body: { slot: "hat", item_id: "hat-party" },
  });
  assert(locked.statusCode === 403, `locked item 403 (got ${locked.statusCode})`);

  const badSlot = await api("PATCH", "/api/me/avatar/cosmetics", {
    token,
    body: { slot: "hat", item_id: "bg-lilac" },
  });
  assert(badSlot.statusCode === 400, "wrong slot 400");

  const equipped = await api("PATCH", "/api/me/avatar/cosmetics", {
    token,
    body: { slot: "background", item_id: "bg-lilac" },
  });
  assert(equipped.statusCode === 200, "equip 200");
  assert(equipped.body.avatar_equipped.background === "bg-lilac", "background equipped");

  const catalog = await api("GET", "/api/avatar/cosmetics", { token });
  assert(catalog.statusCode === 200, "catalog 200");
  const lilac = catalog.body.items.find((item) => item.id === "bg-lilac");
  const party = catalog.body.items.find((item) => item.id === "hat-party");
  assert(lilac.unlocked && lilac.equipped, "catalog shows unlocked+equipped");
  assert(!party.unlocked && party.xp_required === 20, "locked hat lists xp_required 20");

  const seedBefore = equipped.body.avatar_seed;
  const rolled = await api("POST", "/api/me/avatar/roll", { token });
  assert(rolled.statusCode === 200, "roll 200");
  assert(rolled.body.avatar_seed !== seedBefore, "dice roll changes seed");
  assert(rolled.body.avatar_unlocks[0] === "bg-lilac", "roll keeps unlocks");
  assert(rolled.body.avatar_equipped.background === "bg-lilac", "roll keeps equipped cosmetics");

  const publicProfile = await api("GET", `/api/users/${userId}`);
  assert(publicProfile.body.avatar_equipped.background === "bg-lilac", "public profile shows equipped");
  assert(publicProfile.body.avatar_unlocks === undefined, "unlocks stay private");

  const seats = db.prepare("SELECT id FROM seats WHERE user_id=?").all(userId);
  for (const seat of seats) {
    db.prepare("UPDATE seats SET status='cancelled' WHERE id=?").run(seat.id);
  }
  const afterCancel = await api("GET", "/api/auth/me", { token });
  assert(afterCancel.body.different_games === 0, "cancelled seats drop XP");
  assert(afterCancel.body.avatar_unlocks.includes("bg-lilac"), "unlocks are never revoked");
  assert(afterCancel.body.avatar_equipped.background === "bg-lilac", "equipped remains after XP drop");

  const unequip = await api("PATCH", "/api/me/avatar/cosmetics", {
    token,
    body: { slot: "background", item_id: null },
  });
  assert(unequip.body.avatar_equipped.background === null, "unequip clears slot");

  if (failed) {
    console.error(`\n${failed} failed`);
    process.exit(1);
  }
  console.log("\nall passed");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
