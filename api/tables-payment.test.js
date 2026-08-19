#!/usr/bin/env node
/** Table status lifecycle and per-seat payment. */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { Readable } = require("stream");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tmg-tables-"));
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

function insertTable({ organizerId, venueId, bringOwn, minPlayers = 2, maxPlayers = 4, status }) {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() + 3);
  start.setHours(14, 0, 0, 0);
  const end = new Date(start);
  end.setHours(16, 0, 0, 0);
  const info = db
    .prepare(
      `INSERT INTO tables (organizer_id, venue_id, game_title, bring_own_game, game_language, game_language_other, venue_game_confirmed, starts_at, ends_at, min_players, max_players, status, seats_taken, created_at)
       VALUES (?, ?, 'Test Game', ?, 'en', '', ?, ?, ?, ?, ?, ?, 1, ?)`,
    )
    .run(
      organizerId,
      venueId,
      bringOwn ? 1 : 0,
      bringOwn ? 0 : 1,
      start.toISOString(),
      end.toISOString(),
      minPlayers,
      maxPlayers,
      status,
      now.toISOString(),
    );
  db.prepare(
    `INSERT INTO seats (table_id, user_id, is_organizer, status, paid) VALUES (?, ?, 1, 'reserved', ?)`,
  ).run(info.lastInsertRowid, organizerId, bringOwn ? 1 : 0);
  return info.lastInsertRowid;
}

(async () => {
  const demo = tokenFor("demo");
  const alice = tokenFor("alice");
  const bob = tokenFor("bob");
  const datehouse = tokenFor("datehouse");
  const venue = db.prepare("SELECT * FROM venues WHERE name='Date House Cafe'").get();

  const requestedId = insertTable({
    organizerId: demo.user.id,
    venueId: venue.id,
    bringOwn: false,
    status: "requested",
  });
  const before = await api("GET", `/api/tables/${requestedId}`, { token: demo.token });
  assert(before.statusCode === 200 && before.body.status === "requested", "host request is Requested");

  const guestTooSoon = await api("POST", `/api/tables/${requestedId}/seats`, { token: alice.token });
  assert(guestTooSoon.statusCode === 409, "cannot join before venue confirms");

  const confirmed = await api("POST", `/api/tables/${requestedId}/confirm`, {
    token: datehouse.token,
  });
  assert(confirmed.statusCode === 200 && confirmed.body.status === "available", "venue confirm is Available");

  const join = await api("POST", `/api/tables/${requestedId}/seats`, { token: alice.token });
  assert(join.statusCode === 201 && join.body.status === "reserved", "alice reserved");
  assert(join.body.paid === false, "venue-game seat starts unpaid");

  const afterMin = await api("GET", `/api/tables/${requestedId}`, { token: demo.token });
  assert(
    afterMin.body.status === "confirmed_unpaid",
    `min players -> Confirmed & unpaid (got ${afterMin.body.status})`,
  );

  const hostPay = await api("POST", `/api/tables/${requestedId}/seats/pay`, { token: demo.token });
  assert(hostPay.statusCode === 200 && hostPay.body.paid === true, "host pay recorded");
  const stillUnpaid = await api("GET", `/api/tables/${requestedId}`, { token: demo.token });
  assert(stillUnpaid.body.status === "confirmed_unpaid", "still unpaid until everyone pays");

  const alicePay = await api("POST", `/api/tables/${requestedId}/seats/pay`, { token: alice.token });
  assert(alicePay.statusCode === 200 && alicePay.body.paid === true, "alice pay recorded");
  const allPaid = await api("GET", `/api/tables/${requestedId}`, { token: demo.token });
  assert(
    allPaid.body.status === "confirmed_paid",
    `all paid -> Confirmed & paid (got ${allPaid.body.status})`,
  );

  const bobPay = await api("POST", `/api/tables/${requestedId}/seats/pay`, { token: bob.token });
  assert(bobPay.statusCode === 409, "cannot pay without a reserved seat");

  const ownGameId = insertTable({
    organizerId: bob.user.id,
    venueId: venue.id,
    bringOwn: true,
    status: "available",
  });
  const ownJoin = await api("POST", `/api/tables/${ownGameId}/seats`, { token: alice.token });
  assert(ownJoin.statusCode === 201 && ownJoin.body.paid === true, "bring-own seat treated as paid");
  const ownTable = await api("GET", `/api/tables/${ownGameId}`, { token: bob.token });
  assert(
    ownTable.body.status === "confirmed_paid",
    `bring-own min players -> Confirmed & paid (got ${ownTable.body.status})`,
  );
  const ownPay = await api("POST", `/api/tables/${ownGameId}/seats/pay`, { token: bob.token });
  assert(ownPay.statusCode === 409, "no payment required for bring-own");

  const list = await api("GET", "/api/tables?status=available", { token: demo.token });
  assert(list.statusCode === 200, "available filter 200");
  const ids = list.body.map((t) => t.id);
  assert(ids.includes(requestedId), "joinable filter includes confirmed_paid");
  assert(ids.includes(ownGameId), "joinable filter includes bring-own confirmed_paid");

  if (failed) {
    console.error(`${failed} failed`);
    process.exit(1);
  }
  console.log("all tables-payment tests passed");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
