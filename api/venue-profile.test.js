#!/usr/bin/env node
/** Admin can create a venue with description, photo, and games in one request. */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { Readable } = require("stream");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tmg-venue-profile-"));
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

const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

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
    raw: null,
    headers: {},
    writeHead(status, headers) {
      this.statusCode = status;
      this.headers = headers || {};
    },
    end(raw) {
      this.raw = raw;
      if (!raw) {
        this.body = null;
        return;
      }
      if (Buffer.isBuffer(raw) && this.headers["Content-Type"] && !String(this.headers["Content-Type"]).includes("json")) {
        this.body = raw;
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
  const admin = tokenFor("admin");
  const demo = tokenFor("demo");

  const created = await api("POST", "/api/venues", {
    token: admin.token,
    body: {
      name: "Pixel Cafe",
      location: "Test Street 1",
      description: "A tiny test cafe.",
      photo: TINY_PNG,
      games: [{ title: "Azul", bgg_id: 230802, min_players: 2, max_players: 4 }],
      weekly_hours: [{ weekday: 0, is_closed: false, start_time: "10:00:00", end_time: "20:00:00" }],
    },
  });
  assert(created.statusCode === 201, `admin create venue 201 (got ${created.statusCode})`);
  assert(created.body.description === "A tiny test cafe.", "stores description on create");
  assert(typeof created.body.photo_url === "string" && created.body.photo_url.includes("/photo"), "returns photo_url");
  const venueId = created.body.id;

  const games = await api("GET", `/api/venues/${venueId}/games`);
  assert(games.statusCode === 200, "lists games for new venue");
  assert(games.body.some((g) => g.title === "Azul" && g.min_players === 2 && g.max_players === 4), "create payload added Azul");

  const hours = await api("GET", `/api/venues/${venueId}/hours`);
  assert(hours.body.some((h) => h.weekday === 0 && h.start_time === "10:00:00"), "stores weekly hours on create");

  const photo = await api("GET", `/api/venues/${venueId}/photo`);
  assert(photo.statusCode === 200, `GET photo 200 (got ${photo.statusCode})`);
  assert(String(photo.headers["Content-Type"] || "").startsWith("image/"), "photo content-type is an image");
  assert(Buffer.isBuffer(photo.body) && photo.body.length > 10, "photo body is image bytes");

  const forbidden = await api("POST", "/api/venues", {
    token: demo.token,
    body: { name: "Nope", description: "nope" },
  });
  assert(forbidden.statusCode === 403, "regular user cannot create a venue");

  const patched = await api("PATCH", `/api/venues/${venueId}`, {
    token: admin.token,
    body: { description: "Updated blurb." },
  });
  assert(patched.statusCode === 200, "admin can patch description");
  assert(patched.body.description === "Updated blurb.", "description updated");
  assert(patched.body.photo_url, "photo_url still present after description patch");

  const userPatch = await api("PATCH", `/api/venues/${venueId}`, {
    token: demo.token,
    body: { description: "hacked" },
  });
  assert(userPatch.statusCode === 403, "regular user cannot patch venue");

  if (failed) {
    console.error(`${failed} failed`);
    process.exit(1);
  }
  console.log("all venue-profile tests passed");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
