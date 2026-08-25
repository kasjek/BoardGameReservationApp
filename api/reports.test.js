#!/usr/bin/env node
/** Abuse reports email the admin and store the filing. */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { Readable } = require("stream");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tmg-reports-"));
process.env.DATA_DIR = dir;
process.env.SQLITE_PATH = path.join(dir, "app.sqlite3");
process.env.NODE_ENV = "development";
delete process.env.SMTP_HOST;

const { ensureDb, newToken } = require("./db");
const { handleApi } = require("./handler");
const { drainOutbox, ABUSE_REPORT_TO } = require("./mail");

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
  drainOutbox();
  const demo = tokenFor("demo");
  const alice = tokenFor("alice");

  const unauth = await api("POST", "/api/reports", {
    body: { type: "abuse", subject_id: alice.user.id, message: "harassing me" },
  });
  assert(unauth.statusCode === 401, "reports require login");

  const blank = await api("POST", "/api/reports", {
    token: demo.token,
    body: { type: "abuse", subject_id: alice.user.id, message: "  " },
  });
  assert(blank.statusCode === 400, "empty issue 400");

  const self = await api("POST", "/api/reports", {
    token: demo.token,
    body: { type: "abuse", subject_id: demo.user.id, message: "myself" },
  });
  assert(self.statusCode === 400, "cannot report self");

  const filed = await api("POST", "/api/reports", {
    token: demo.token,
    body: {
      type: "abuse",
      subject_type: "user",
      subject_id: alice.user.id,
      message: "Racist insults in private chat",
      context: "private chat",
    },
  });
  assert(filed.statusCode === 201, `file 201 (got ${filed.statusCode})`);
  assert(filed.body.status === "open", "report is open");
  assert(filed.body.subject_id === alice.user.id, "accused id stored");

  const row = db.prepare("SELECT * FROM reports WHERE id=?").get(filed.body.id);
  assert(row.reporter_id === demo.user.id, "reporter stored");
  assert(row.message.includes("Racist insults"), "issue stored");

  const mail = drainOutbox();
  assert(mail.length === 1, `one admin email (got ${mail.length})`);
  assert(mail[0].to === ABUSE_REPORT_TO, `to ${ABUSE_REPORT_TO}`);
  assert(mail[0].to === "info@toomanygames.de", "default admin inbox");
  assert(mail[0].text.includes("demo"), "email names reporter");
  assert(mail[0].text.includes("alice"), "email names accused");
  assert(mail[0].text.includes("Racist insults"), "email includes issue");
  assert(mail[0].subject.includes("demo"), "subject names reporter");
  assert(mail[0].subject.includes("alice"), "subject names accused");

  if (failed) {
    console.error(`\n${failed} failed`);
    process.exit(1);
  }
  console.log("\nall passed");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
