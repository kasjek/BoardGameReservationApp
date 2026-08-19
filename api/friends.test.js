#!/usr/bin/env node
/** Search by login, friend requests, friends list. */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { Readable } = require("stream");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tmg-friends-"));
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
  const demo = tokenFor("demo");
  const alice = db.prepare("SELECT * FROM users WHERE username='alice'").get();

  const unauth = await api("GET", "/api/users?q=ali");
  assert(unauth.statusCode === 401, "search requires login");

  const search = await api("GET", "/api/users?q=ali", { token: demo.token });
  assert(search.statusCode === 200, "search 200");
  assert(search.body.some((u) => u.username === "alice"), "finds alice by login");
  assert(!search.body.some((u) => u.username === "demo"), "excludes self");
  assert(search.body.every((u) => u.email === undefined), "search omits email");

  const sent = await api("POST", "/api/friends/requests", {
    token: demo.token,
    body: { username: "alice" },
  });
  assert(sent.statusCode === 201, `send request 201 (got ${sent.statusCode})`);
  assert(sent.body.status === "pending", "pending");
  const requestId = sent.body.id;

  const dup = await api("POST", "/api/friends/requests", {
    token: demo.token,
    body: { username: "alice" },
  });
  assert(dup.statusCode === 409, "duplicate request 409");

  const aliceTok = tokenFor("alice");
  const incoming = await api("GET", "/api/friends/requests", { token: aliceTok.token });
  assert(incoming.body.incoming.length === 1, "alice sees incoming request");
  assert(incoming.body.incoming[0].user.username === "demo", "incoming from demo");

  const accepted = await api("POST", `/api/friends/requests/${requestId}/accept`, {
    token: aliceTok.token,
  });
  assert(accepted.statusCode === 200, "accept 200");
  assert(accepted.body.status === "accepted", "now accepted");

  const demoFriends = await api("GET", "/api/friends", { token: demo.token });
  assert(demoFriends.body.some((u) => u.username === "alice"), "demo lists alice as friend");
  const aliceFriends = await api("GET", "/api/friends", { token: aliceTok.token });
  assert(aliceFriends.body.some((u) => u.username === "demo"), "alice lists demo as friend");

  const profile = await api("GET", `/api/users/${alice.id}`, { token: demo.token });
  assert(profile.body.friendship.status === "friends", "public profile shows friends status");
  assert(profile.body.email === undefined, "profile still omits email");

  const self = await api("POST", "/api/friends/requests", {
    token: demo.token,
    body: { username: "demo" },
  });
  assert(self.statusCode === 400, "cannot add self");

  const bobTok = tokenFor("bob");
  await api("POST", "/api/friends/requests", {
    token: bobTok.token,
    body: { username: "demo" },
  });
  const reciprocal = await api("POST", "/api/friends/requests", {
    token: demo.token,
    body: { username: "bob" },
  });
  assert(reciprocal.body.status === "accepted", "adding someone who already requested you accepts");

  if (failed) {
    console.error(`\n${failed} failed`);
    process.exit(1);
  }
  console.log("\nall passed");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
