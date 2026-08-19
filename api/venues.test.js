#!/usr/bin/env node
/**
 * ADMIN venue create: short description, min spend, horizon, picture, weekly hours.
 */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { Readable } = require("stream");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tmg-venues-"));
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

function mockReq(method, urlPath, body, token) {
  const payload = body === undefined ? "" : JSON.stringify(body);
  const req = Readable.from([Buffer.from(payload)]);
  req.method = method;
  req.url = urlPath;
  req.headers = { "content-type": "application/json" };
  if (token) req.headers.authorization = `Token ${token}`;
  req.socket = { remoteAddress: "127.0.0.1" };
  return req;
}

function mockRes() {
  const res = {
    statusCode: 0,
    body: null,
    raw: null,
    headers: {},
    writeHead(status, headers) {
      this.statusCode = status;
      this.headers = headers || {};
    },
    end(raw) {
      this.raw = raw;
      if (Buffer.isBuffer(raw)) {
        this.body = raw;
        return;
      }
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

async function api(method, urlPath, body, token) {
  const req = mockReq(method, urlPath, body, token);
  const res = mockRes();
  await handleApi(req, res);
  return res;
}

const PNG_1X1 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

(async () => {
  const admin = db.prepare("SELECT * FROM users WHERE username='admin'").get();
  const token = newToken();
  db.prepare("INSERT INTO tokens (key, user_id) VALUES (?, ?)").run(token, admin.id);

  const demo = db.prepare("SELECT * FROM users WHERE username='demo'").get();
  const userToken = newToken();
  db.prepare("INSERT INTO tokens (key, user_id) VALUES (?, ?)").run(userToken, demo.id);

  const forbidden = await api("POST", "/api/venues", { name: "Nope", location: "Berlin" }, userToken);
  assert(forbidden.statusCode === 403, "regular user cannot create venue");

  const tooLong = await api(
    "POST",
    "/api/venues",
    { name: "Wordy", location: "Berlin", description: "x".repeat(101) },
    token,
  );
  assert(tooLong.statusCode === 400 && tooLong.body.description, "description over 100 is rejected");

  const badHorizon = await api(
    "POST",
    "/api/venues",
    { name: "Far", location: "Berlin", booking_horizon_weeks: 53 },
    token,
  );
  assert(badHorizon.statusCode === 400 && badHorizon.body.booking_horizon_weeks, "horizon 53 rejected");

  const hours = Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    is_closed: false,
    start_time: "11:00:00",
    end_time: "18:00:00",
  }));
  const created = await api(
    "POST",
    "/api/venues",
    {
      name: "Photo Cafe",
      location: "Teststrasse 1, Nürnberg",
      description: "Cozy cafe with plenty of tables.",
      min_spend: "€10 per person",
      min_reservation_minutes: 60,
      max_reservation_minutes: 120,
      booking_horizon_weeks: 2,
      weekly_hours: hours,
      picture_data: PNG_1X1,
    },
    token,
  );
  assert(created.statusCode === 201, `create venue 201 (got ${created.statusCode} ${JSON.stringify(created.body)})`);
  assert(created.body.name === "Photo Cafe", "create returns name");
  assert(created.body.description === "Cozy cafe with plenty of tables.", "short description stored");
  assert(created.body.min_spend === "€10 per person", "min spend stored");
  assert(created.body.booking_horizon_weeks === 2, "horizon weeks stored");
  assert(created.body.min_reservation_minutes === 60, "min reservation stored");
  assert(created.body.max_reservation_minutes === 120, "max duration stored");
  assert(
    created.body.picture_url === `/api/venues/${created.body.id}/picture`,
    "picture_url points at picture endpoint",
  );

  const avail = await api("GET", `/api/venues/${created.body.id}/availability`);
  assert(avail.statusCode === 200, "availability 200");
  assert(avail.body.length === 14, `2-week horizon yields 14 open days (got ${avail.body.length})`);
  assert(avail.body[0].start_time === "11:00:00", "availability uses posted weekly hours");

  const pic = await api("GET", `/api/venues/${created.body.id}/picture`);
  assert(pic.statusCode === 200, "picture 200");
  assert(pic.headers["Content-Type"] === "image/png", "picture content-type png");
  assert(Buffer.isBuffer(pic.body) && pic.body[0] === 0x89 && pic.body[1] === 0x50, "picture is PNG bytes");

  const listed = await api("GET", "/api/venues");
  const row = listed.body.find((v) => v.id === created.body.id);
  assert(row && row.picture_url && row.min_spend === "€10 per person", "list includes new venue fields");

  const knorz = db.prepare("SELECT * FROM venues WHERE name='Hotel Knorz'").get();
  const photoId = created.body.id;

  const added = await api(
    "POST",
    `/api/venues/${photoId}/games`,
    { bgg_id: 13, title: "Catan" },
    token,
  );
  assert(
    added.statusCode === 201 && added.body.title === "Catan",
    `admin adds game to any venue (got ${added.statusCode} ${JSON.stringify(added.body)})`,
  );

  const games = await api("GET", `/api/venues/${photoId}/games`);
  assert(games.body.some((g) => g.bgg_id === 13), "new venue lists added game");

  const dup = await api(
    "POST",
    `/api/venues/${photoId}/games`,
    { bgg_id: 13, title: "Catan" },
    token,
  );
  assert(dup.statusCode === 400, "duplicate game rejected");

  const removed = await api("DELETE", `/api/venues/${photoId}/games/${added.body.id}`, undefined, token);
  assert(removed.statusCode === 204, "admin removes game from any venue");
  const after = await api("GET", `/api/venues/${photoId}/games`);
  assert(!after.body.some((g) => g.bgg_id === 13), "removed game gone from list");

  const readd = await api(
    "POST",
    `/api/venues/${photoId}/games`,
    { bgg_id: 13, title: "Catan" },
    token,
  );
  assert(readd.statusCode === 201, "re-add after remove works");

  const datehouseUser = db.prepare("SELECT * FROM users WHERE username='datehouse'").get();
  const venueToken = newToken();
  db.prepare("INSERT INTO tokens (key, user_id) VALUES (?, ?)").run(venueToken, datehouseUser.id);
  const cross = await api(
    "POST",
    `/api/venues/${knorz.id}/games`,
    { bgg_id: 13, title: "Catan" },
    venueToken,
  );
  assert(cross.statusCode === 403, "venue user cannot add games to another venue");

  const knorzCatan = db
    .prepare("SELECT * FROM venue_games WHERE venue_id=? AND title='Catan'")
    .get(knorz.id);
  const crossDel = await api(
    "DELETE",
    `/api/venues/${knorz.id}/games/${knorzCatan.id}`,
    undefined,
    venueToken,
  );
  assert(crossDel.statusCode === 403, "venue user cannot remove games from another venue");

  const adminDel = await api(
    "DELETE",
    `/api/venues/${knorz.id}/games/${knorzCatan.id}`,
    undefined,
    token,
  );
  assert(adminDel.statusCode === 204, "admin removes a game from Hotel Knorz");

  const withGames = await api(
    "POST",
    "/api/venues",
    {
      name: "Shelf Cafe",
      location: "Berlin",
      games: [{ bgg_id: 13, title: "Catan" }],
    },
    token,
  );
  assert(withGames.statusCode === 201, `create venue with games (got ${withGames.statusCode})`);
  const shelfGames = await api("GET", `/api/venues/${withGames.body.id}/games`);
  assert(
    shelfGames.body.some((g) => g.title === "Catan"),
    "created venue includes posted games",
  );

  if (failed) {
    console.error(`\n${failed} failed`);
    process.exit(1);
  }
  console.log("\nall passed");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
