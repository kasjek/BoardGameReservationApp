#!/usr/bin/env node
/** Browse filters: venueId and BGG game type. */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { Readable } = require("stream");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tmg-table-filters-"));
process.env.DATA_DIR = dir;
process.env.SQLITE_PATH = path.join(dir, "app.sqlite3");
process.env.NODE_ENV = "development";

const { ensureDb, newToken } = require("./db");
const { handleApi } = require("./handler");
const { parseThingTypes } = require("./bgg");

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

function insertTable({ organizerId, venueId, title, types, status = "available" }) {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() + 3);
  start.setHours(14, 0, 0, 0);
  const end = new Date(start);
  end.setHours(16, 0, 0, 0);
  const info = db
    .prepare(
      `INSERT INTO tables (organizer_id, venue_id, game_title, bring_own_game, game_language, venue_game_confirmed, starts_at, ends_at, min_players, max_players, status, seats_taken, created_at, game_types)
       VALUES (?, ?, ?, 0, 'en', 1, ?, ?, 2, 4, ?, 1, ?, ?)`,
    )
    .run(
      organizerId,
      venueId,
      title,
      start.toISOString(),
      end.toISOString(),
      status,
      now.toISOString(),
      JSON.stringify(types),
    );
  db.prepare(`INSERT INTO seats (table_id, user_id, is_organizer, status, paid) VALUES (?, ?, 1, 'reserved', 0)`).run(
    info.lastInsertRowid,
    organizerId,
  );
  return info.lastInsertRowid;
}

(async () => {
  const xml = `
<items><item type="boardgame" id="13">
  <name type="primary" value="Catan"/>
  <statistics><ratings><ranks>
    <rank type="subtype" id="1" name="boardgame" friendlyname="Board Game Rank" value="401"/>
    <rank type="family" id="5496" name="thematic" friendlyname="Thematic Rank" value="Not Ranked"/>
    <rank type="family" id="5497" name="strategygames" friendlyname="Strategy Game Rank" value="401"/>
    <rank type="family" name="familygames" type="family" value="44"/>
    <rank type="family" name="partygames" value="Not Ranked"/>
  </ranks></ratings></statistics>
</item></items>`;
  assert(
    JSON.stringify(parseThingTypes(xml)) === JSON.stringify(["strategy", "family"]),
    "parseThingTypes Catan -> strategy, family",
  );

  const demo = tokenFor("demo");
  const dateHouse = db.prepare("SELECT * FROM venues WHERE name='Date House Cafe'").get();
  const katzen = db.prepare("SELECT * FROM venues WHERE name='Katzentempel'").get();

  const catanId = insertTable({
    organizerId: demo.user.id,
    venueId: dateHouse.id,
    title: "Catan",
    types: ["strategy", "family"],
  });
  const secretId = insertTable({
    organizerId: demo.user.id,
    venueId: katzen.id,
    title: "Secret Hitler",
    types: ["party"],
  });
  const azulId = insertTable({
    organizerId: demo.user.id,
    venueId: dateHouse.id,
    title: "Azul",
    types: ["abstract", "family"],
  });

  const byVenue = await api("GET", `/api/tables?status=available&venueId=${dateHouse.id}`, {
    token: demo.token,
  });
  assert(byVenue.statusCode === 200, "venue filter 200");
  const venueIds = new Set(byVenue.body.map((t) => t.id));
  assert(venueIds.has(catanId) && venueIds.has(azulId) && !venueIds.has(secretId), "venue filter keeps Date House tables");

  const byType = await api("GET", "/api/tables?status=available&type=party", { token: demo.token });
  assert(byType.statusCode === 200, "type filter 200");
  assert(
    byType.body.some((t) => t.id === secretId) && !byType.body.some((t) => t.id === catanId),
    "type=party returns Secret Hitler not Catan",
  );
  assert(byType.body.every((t) => (t.game_types || []).includes("party")), "type filter rows include party");

  const both = await api(
    "GET",
    `/api/tables?status=available&venueId=${dateHouse.id}&type=family`,
    { token: demo.token },
  );
  const bothIds = new Set(both.body.map((t) => t.id));
  assert(bothIds.has(catanId) && bothIds.has(azulId) && !bothIds.has(secretId), "venue+type=family");

  const listed = await api("GET", "/api/tables?status=available", { token: demo.token });
  const catan = listed.body.find((t) => t.id === catanId);
  assert(
    JSON.stringify(catan?.game_types) === JSON.stringify(["strategy", "family"]),
    "list payload includes game_types",
  );

  const types = await api("GET", "/api/bgg/types", { token: demo.token });
  assert(types.statusCode === 200 && types.body.some((row) => row.id === "strategy"), "GET /api/bgg/types");

  if (failed) {
    console.error(`${failed} failed`);
    process.exit(1);
  }
  console.log("all passed");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
