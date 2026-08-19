#!/usr/bin/env node
/** Favorite BoardGameGeek categories on the user's own profile (max 3). */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { Readable } = require("stream");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tmg-cats-"));
process.env.DATA_DIR = dir;
process.env.SQLITE_PATH = path.join(dir, "app.sqlite3");
process.env.NODE_ENV = "development";

const { ensureDb, newToken } = require("./db");
const { handleApi } = require("./handler");
const { listCategories, MAX_FAVORITE_CATEGORIES } = require("./bgg-categories");

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
  const cats = listCategories();
  assert(cats.length === 84, `84 BGG categories (got ${cats.length})`);
  assert(
    cats.some((c) => c.id === 1002 && c.name === "Card Game"),
    "includes Card Game",
  );
  assert(
    cats.every((c) => c.url.startsWith("https://boardgamegeek.com/boardgamecategory/")),
    "each category links to BGG",
  );

  const unauth = await api("GET", "/api/bgg/categories");
  assert(unauth.statusCode === 401, "categories list requires auth");

  const demo = tokenFor("demo");
  const listed = await api("GET", "/api/bgg/categories", { token: demo.token });
  assert(listed.statusCode === 200, "categories list 200");
  assert(listed.body.results.length === 84, "list returns all categories");

  const me0 = await api("GET", "/api/auth/me", { token: demo.token });
  assert(Array.isArray(me0.body.favorite_categories), "me includes favorite_categories");
  assert(me0.body.favorite_categories.length === 0, "starts empty");

  const tooMany = await api("PATCH", "/api/me/favorite-categories", {
    token: demo.token,
    body: { category_ids: [1002, 1010, 1030, 1021] },
  });
  assert(tooMany.statusCode === 400, "rejects more than 3");

  const unknown = await api("PATCH", "/api/me/favorite-categories", {
    token: demo.token,
    body: { category_ids: [999999] },
  });
  assert(unknown.statusCode === 400, "rejects unknown ids");

  const saved = await api("PATCH", "/api/me/favorite-categories", {
    token: demo.token,
    body: { category_ids: [1010, 1002, 1002, 1030] },
  });
  assert(saved.statusCode === 200, "saves favorites");
  assert(saved.body.favorite_categories.length === 3, "dedupes to 3");
  assert(
    saved.body.favorite_categories.map((c) => c.id).join(",") === "1010,1002,1030",
    "keeps first-seen order",
  );
  assert(saved.body.favorite_categories[0].name === "Fantasy", "hydrates Fantasy");
  assert(MAX_FAVORITE_CATEGORIES === 3, "cap is 3");

  const publicProfile = await api("GET", `/api/users/${demo.user.id}`);
  assert(publicProfile.statusCode === 200, "public profile 200");
  assert(publicProfile.body.email === undefined, "public profile omits email");
  assert(
    publicProfile.body.favorite_categories.map((c) => c.name).join(",") ===
      "Fantasy,Card Game,Party Game",
    "public profile shows favorite names",
  );

  const cleared = await api("PATCH", "/api/me/favorite-categories", {
    token: demo.token,
    body: { category_ids: [] },
  });
  assert(cleared.body.favorite_categories.length === 0, "can clear favorites");

  if (failed) {
    console.error(`\n${failed} failed`);
    process.exit(1);
  }
  console.log("\nall passed");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
