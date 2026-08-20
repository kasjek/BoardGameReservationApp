#!/usr/bin/env node
/** Reviews are allowed only after a table ends, and only for people who played. */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { Readable } = require("stream");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tmg-reviews-"));
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

function insertTable({ organizerId, venueId, guestId, endsAt, status = "available" }) {
  const end = new Date(endsAt);
  const start = new Date(end.getTime() - 2 * 60 * 60 * 1000);
  const info = db
    .prepare(
      `INSERT INTO tables (organizer_id, venue_id, game_title, bring_own_game, game_language, game_language_other, venue_game_confirmed, starts_at, ends_at, min_players, max_players, status, seats_taken, created_at)
       VALUES (?, ?, 'Catan', 1, 'en', '', 1, ?, ?, 2, 4, ?, 2, ?)`,
    )
    .run(organizerId, venueId, start.toISOString(), end.toISOString(), status, new Date().toISOString());
  const tableId = info.lastInsertRowid;
  db.prepare(
    `INSERT INTO seats (table_id, user_id, is_organizer, status, paid) VALUES (?, ?, 1, 'reserved', 1)`,
  ).run(tableId, organizerId);
  if (guestId) {
    db.prepare(
      `INSERT INTO seats (table_id, user_id, is_organizer, status, paid) VALUES (?, ?, 0, 'reserved', 1)`,
    ).run(tableId, guestId);
  }
  return tableId;
}

(async () => {
  const demo = tokenFor("demo");
  const alice = tokenFor("alice");
  const bob = tokenFor("bob");
  const venue = db.prepare("SELECT * FROM venues WHERE name='Date House Cafe'").get();

  const pastId = insertTable({
    organizerId: demo.user.id,
    venueId: venue.id,
    guestId: alice.user.id,
    endsAt: new Date(Date.now() - 60 * 60 * 1000),
  });
  const futureId = insertTable({
    organizerId: demo.user.id,
    venueId: venue.id,
    guestId: alice.user.id,
    endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });
  const cancelledId = insertTable({
    organizerId: demo.user.id,
    venueId: venue.id,
    guestId: alice.user.id,
    endsAt: new Date(Date.now() - 60 * 60 * 1000),
    status: "cancelled",
  });

  const venueReview = await api("POST", "/api/reviews", {
    token: demo.token,
    body: { table: pastId, target_type: "venue", rating: 5, body: "Nice cafe" },
  });
  assert(venueReview.statusCode === 201, `venue review 201 (got ${venueReview.statusCode})`);
  assert(venueReview.body.rating === 5, "venue review stores rating");
  assert(venueReview.body.target_venue === venue.id, "venue review targets the table's venue");

  const userReview = await api("POST", "/api/reviews", {
    token: demo.token,
    body: { table: pastId, target_type: "user", target_user: alice.user.id, rating: 4 },
  });
  assert(userReview.statusCode === 201, `user review 201 (got ${userReview.statusCode})`);
  assert(userReview.body.target_user === alice.user.id, "user review targets the other player");

  const listedUser = await api("GET", `/api/users/${alice.user.id}/reviews`);
  assert(listedUser.statusCode === 200, "GET user reviews 200");
  assert(listedUser.body.length === 1 && listedUser.body[0].rating === 4, "alice has one 4-star review");

  const listedTable = await api("GET", `/api/tables/${pastId}/reviews`);
  assert(listedTable.statusCode === 200 && listedTable.body.length === 2, "table reviews include venue and player");

  const listedVenue = await api("GET", `/api/venues/${venue.id}/reviews`);
  assert(
    listedVenue.body.some((row) => row.table === pastId && row.rating === 5),
    "venue list includes the new review",
  );

  const profile = await api("GET", `/api/users/${alice.user.id}`, { token: demo.token });
  assert(profile.body.rating_avg === 4, `alice rating_avg is 4 (got ${profile.body.rating_avg})`);

  const dupVenue = await api("POST", "/api/reviews", {
    token: demo.token,
    body: { table: pastId, target_type: "venue", rating: 3 },
  });
  assert(dupVenue.statusCode === 400, "duplicate venue review is 400");

  const selfReview = await api("POST", "/api/reviews", {
    token: demo.token,
    body: { table: pastId, target_type: "user", target_user: demo.user.id, rating: 5 },
  });
  assert(selfReview.statusCode === 400, "self review is 400");

  const stranger = await api("POST", "/api/reviews", {
    token: demo.token,
    body: { table: pastId, target_type: "user", target_user: bob.user.id, rating: 1 },
  });
  assert(stranger.statusCode === 400, "cannot review a player who was not at the table");

  const outsider = await api("POST", "/api/reviews", {
    token: bob.token,
    body: { table: pastId, target_type: "venue", rating: 1 },
  });
  assert(outsider.statusCode === 400, "non-attendee cannot review");

  const tooSoon = await api("POST", "/api/reviews", {
    token: demo.token,
    body: { table: futureId, target_type: "venue", rating: 5 },
  });
  assert(tooSoon.statusCode === 400, "cannot review before the event ends");

  const cancelled = await api("POST", "/api/reviews", {
    token: demo.token,
    body: { table: cancelledId, target_type: "venue", rating: 5 },
  });
  assert(cancelled.statusCode === 400, "cannot review a cancelled table");

  const badRating = await api("POST", "/api/reviews", {
    token: alice.token,
    body: { table: pastId, target_type: "user", target_user: demo.user.id, rating: 9 },
  });
  assert(badRating.statusCode === 400, "rating 9 is 400");

  const aliceRatesDemo = await api("POST", "/api/reviews", {
    token: alice.token,
    body: { table: pastId, target_type: "user", target_user: demo.user.id, rating: 5 },
  });
  assert(aliceRatesDemo.statusCode === 201, "guest can rate the host after playing");

  const unauth = await api("POST", "/api/reviews", {
    body: { table: pastId, target_type: "venue", rating: 5 },
  });
  assert(unauth.statusCode === 401 || unauth.statusCode === 403, "review requires auth");

  if (failed) {
    console.error(`${failed} failed`);
    process.exit(1);
  }
  console.log("all reviews tests passed");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
