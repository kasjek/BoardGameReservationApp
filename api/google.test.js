#!/usr/bin/env node
/**
 * Smoke tests for Google user provisioning (no live Google token).
 */
const fs = require("fs");
const path = require("path");
const os = require("os");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tmg-google-"));
process.env.SQLITE_PATH = path.join(dir, "app.sqlite3");
delete process.env.GOOGLE_CLIENT_ID;

const { ensureDb, serializeUser } = require("./db");
const { googleClientId, userFromGoogle, uniqueUsername } = require("./google");

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

assert(!googleClientId(), "config empty without GOOGLE_CLIENT_ID");

const first = userFromGoogle(db, {
  sub: "gid-1",
  email: "pat.google@example.com",
  email_verified: true,
  name: "Pat Google",
});
assert(first.created === true, "creates new USER");
assert(first.user.username === "pat.google", `username is email local (${first.user.username})`);
assert(first.user.role === "USER", "role USER");
assert(!first.user.password_hash, "no usable password");
assert(serializeUser(first.user).has_usable_password === false, "serializer flag");

const again = userFromGoogle(db, {
  sub: "gid-1",
  email: "pat.google@example.com",
  email_verified: true,
});
assert(again.created === false, "same sub does not duplicate");
assert(again.user.id === first.user.id, "same user id");

db.prepare(
  `INSERT INTO users (username, email, password_hash, role, avatar_seed) VALUES ('already', 'same@example.com', 'hash', 'USER', 'already')`,
).run();
const linked = userFromGoogle(db, {
  sub: "gid-2",
  email: "same@example.com",
  email_verified: true,
});
assert(linked.created === false, "links existing email");
assert(linked.user.username === "already", "keeps existing username");
assert(linked.user.google_sub === "gid-2", "stores google_sub");

const u2 = uniqueUsername(db, "pat.google@example.com");
assert(u2 !== "pat.google", `unique username when taken (${u2})`);

process.exit(failed ? 1 : 0);
