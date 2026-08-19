#!/usr/bin/env node
/** Private 1:1 chats. */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { Readable } = require("stream");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tmg-chats-"));
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
  const alice = tokenFor("alice");

  const unauth = await api("GET", "/api/chats");
  assert(unauth.statusCode === 401, "chats require login");

  const empty = await api("GET", "/api/chats", { token: demo.token });
  assert(empty.statusCode === 200 && empty.body.length === 0, "empty inbox");

  const self = await api("POST", `/api/chats/${demo.user.id}`, {
    token: demo.token,
    body: { body: "hi me" },
  });
  assert(self.statusCode === 400, "cannot message self");

  const missing = await api("POST", "/api/chats/999999", {
    token: demo.token,
    body: { body: "hi" },
  });
  assert(missing.statusCode === 404, "unknown user 404");

  const blank = await api("POST", `/api/chats/${alice.user.id}`, {
    token: demo.token,
    body: { body: "   " },
  });
  assert(blank.statusCode === 400, "empty body 400");

  const sent = await api("POST", `/api/chats/${alice.user.id}`, {
    token: demo.token,
    body: { body: "See you at Isle of Cats?" },
  });
  assert(sent.statusCode === 201, `send 201 (got ${sent.statusCode})`);
  assert(sent.body.body === "See you at Isle of Cats?", "body stored");
  assert(sent.body.mine === true, "sender sees mine");
  assert(sent.body.email === undefined, "no email on message");

  const reply = await api("POST", `/api/chats/${demo.user.id}`, {
    token: alice.token,
    body: { body: "Yes — 11:00 at Katzentempel." },
  });
  assert(reply.statusCode === 201, "alice replies");

  const thread = await api("GET", `/api/chats/${alice.user.id}`, { token: demo.token });
  assert(thread.statusCode === 200, "thread 200");
  assert(thread.body.user.username === "alice", "thread other is alice");
  assert(thread.body.user.email === undefined, "thread user omits email");
  assert(thread.body.messages.length === 2, "two messages");
  assert(thread.body.messages[0].body.includes("Isle of Cats"), "first message");
  assert(thread.body.messages[1].mine === false, "alice reply is not mine for demo");

  const inbox = await api("GET", "/api/chats", { token: alice.token });
  assert(inbox.body.length === 1, "alice has one conversation");
  assert(inbox.body[0].user.username === "demo", "conversation with demo");
  assert(inbox.body[0].last_message.body.includes("Katzentempel"), "last message is reply");

  if (failed) {
    console.error(`\n${failed} failed`);
    process.exit(1);
  }
  console.log("\nall passed");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
