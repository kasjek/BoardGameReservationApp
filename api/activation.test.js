#!/usr/bin/env node
/**
 * Email activation: inactive until the emailed link is used (mocked mail).
 */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { Readable } = require("stream");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tmg-act-"));
process.env.SQLITE_PATH = path.join(dir, "app.sqlite3");
process.env.NODE_ENV = "development";
process.env.EMAIL_HOST = "";
process.env.PUBLIC_APP_URL = "http://test.example";
delete process.env.FACEBOOK_APP_ID;
delete process.env.FACEBOOK_APP_SECRET;

const { ensureDb, hashPassword } = require("./db");
const {
  ACTIVATED_DETAIL,
  activateWithKey,
  emailConfigured,
  isActive,
  issueActivationToken,
  issueAndSendActivation,
  markEmailVerified,
} = require("./activation");
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

function mockReq(method, urlPath, body) {
  const payload = body === undefined ? "" : JSON.stringify(body);
  const req = Readable.from([Buffer.from(payload)]);
  req.method = method;
  req.url = urlPath;
  req.headers = { "content-type": "application/json" };
  req.socket = { remoteAddress: "127.0.0.1" };
  return req;
}

function mockRes() {
  const res = {
    statusCode: 0,
    body: null,
    writeHead(status) {
      this.statusCode = status;
    },
    end(raw) {
      this.body = raw ? JSON.parse(raw) : null;
    },
  };
  return res;
}

async function api(method, urlPath, body) {
  const req = mockReq(method, urlPath, body);
  const res = mockRes();
  await handleApi(req, res);
  return res;
}

(async () => {
  assert(emailConfigured() === true, "dev without SMTP is configured via console");

  const info = db
    .prepare(
      `INSERT INTO users (username, email, password_hash, role, avatar_seed, is_active)
       VALUES (?, ?, ?, 'USER', ?, 0)`,
    )
    .run("newplayer", "newplayer@example.com", hashPassword("GoodPass1!"), "newplayer");
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid);
  assert(isActive(user) === false, "new password user is inactive");

  const mailed = await issueAndSendActivation(db, user);
  assert(mailed.ok === true, "console mail succeeds in development");
  const row = db.prepare("SELECT * FROM email_activation_tokens WHERE user_id = ?").get(user.id);
  assert(Boolean(row && row.key), "stores activation key");

  const denied = await api("POST", "/api/auth/login", {
    username: "newplayer",
    password: "GoodPass1!",
  });
  assert(denied.statusCode === 403, "login blocked while inactive");
  assert(/activat/i.test(denied.body.detail), "login explains activation");

  const wrong = await api("POST", "/api/auth/login", {
    username: "newplayer",
    password: "NopePass1!",
  });
  assert(wrong.statusCode === 400, "wrong password is generic 400");

  const activated = await api("POST", "/api/auth/activate", { token: row.key });
  assert(activated.statusCode === 200, "activate succeeds");
  assert(activated.body.detail === ACTIVATED_DETAIL, "activate message");
  const fresh = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id);
  assert(isActive(fresh) === true, "user is active after click");
  assert(
    !db.prepare("SELECT key FROM email_activation_tokens WHERE user_id = ?").get(user.id),
    "token consumed",
  );

  const reuse = activateWithKey(db, row.key);
  assert(reuse.ok === false, "token cannot be reused");

  const logged = await api("POST", "/api/auth/login", {
    username: "newplayer",
    password: "GoodPass1!",
  });
  assert(logged.statusCode === 200 && logged.body.token, "login works after activation");

  const expiredUser = db
    .prepare(
      `INSERT INTO users (username, email, password_hash, role, avatar_seed, is_active)
       VALUES (?, ?, ?, 'USER', ?, 0)`,
    )
    .run("expirer", "exp@example.com", hashPassword("GoodPass1!"), "expirer");
  const expTok = issueActivationToken(db, expiredUser.lastInsertRowid);
  db.prepare("UPDATE email_activation_tokens SET expires_at = ? WHERE key = ?").run(
    new Date(Date.now() - 1000).toISOString(),
    expTok.key,
  );
  const expired = await api("GET", `/api/auth/activate?token=${expTok.key}`);
  assert(expired.statusCode === 400, "expired link rejected");

  const pending = db.prepare("SELECT * FROM users WHERE username = ?").get("expirer");
  const first = issueActivationToken(db, pending.id);
  const resent = await api("POST", "/api/auth/activate/resend", { email: "exp@example.com" });
  assert(resent.statusCode === 200, "resend is 200");
  const rotated = db.prepare("SELECT key FROM email_activation_tokens WHERE user_id = ?").get(pending.id);
  assert(rotated.key !== first.key, "resend rotates token");

  const ghost = await api("POST", "/api/auth/activate/resend", { email: "nobody@example.com" });
  assert(ghost.statusCode === 200, "unknown email is generic 200");

  pending.is_active = 0;
  markEmailVerified(db, pending);
  const social = db.prepare("SELECT * FROM users WHERE id = ?").get(pending.id);
  assert(isActive(social) === true, "social link marks email verified");

  if (failed) {
    console.error(`${failed} failed`);
    process.exit(1);
  }
  console.log("all ok");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
