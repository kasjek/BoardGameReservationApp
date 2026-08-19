#!/usr/bin/env node
/**
 * Facebook Login token verify + user provisioning (mocked Graph API).
 */
const fs = require("fs");
const path = require("path");
const os = require("os");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tmg-fb-"));
process.env.SQLITE_PATH = path.join(dir, "app.sqlite3");
process.env.FACEBOOK_APP_ID = "app-123";
process.env.FACEBOOK_APP_SECRET = "secret-xyz";

const { ensureDb, serializeUser } = require("./db");
const {
  facebookPublicConfig,
  uniqueUsername,
  verifyFacebookAccessToken,
  userFromFacebook,
} = require("./facebook");

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

(async () => {
  const cfg = facebookPublicConfig();
  assert(cfg.facebook_enabled === true, "config enabled with env keys");
  assert(cfg.facebook_app_id === "app-123", "public app id");
  assert(uniqueUsername(db, "ada.lovelace@example.com", "Ada") === "ada.lovelace", "username from email");

  const missing = await verifyFacebookAccessToken("");
  assert(missing.ok === false && missing.status === 400, "empty token rejected");

  const fakeFetch = async (url) => {
    if (String(url).includes("debug_token")) {
      return {
        json: async () => ({
          data: { app_id: "app-123", is_valid: true, user_id: "fb-99" },
        }),
      };
    }
    if (String(url).includes("/me?")) {
      return {
        json: async () => ({ id: "fb-99", name: "Pat Facebook", email: "pat.fb@example.com" }),
      };
    }
    throw new Error(url);
  };

  const good = await verifyFacebookAccessToken("user-token", { fetch: fakeFetch });
  assert(good.ok === true && good.info.id === "fb-99", "valid token returns profile");
  assert(good.info.email === "pat.fb@example.com", "email from Graph");

  const wrongApp = async (url) => {
    if (String(url).includes("debug_token")) {
      return { json: async () => ({ data: { app_id: "other", is_valid: true, user_id: "x" } }) };
    }
    return { json: async () => ({}) };
  };
  const badApp = await verifyFacebookAccessToken("tok", { fetch: wrongApp });
  assert(badApp.ok === false, "token for another app is rejected");

  const noEmailFetch = async (url) => {
    if (String(url).includes("debug_token")) {
      return { json: async () => ({ data: { app_id: "app-123", is_valid: true, user_id: "fb-99" } }) };
    }
    return { json: async () => ({ id: "fb-99", name: "Pat Facebook" }) };
  };
  const noEmail = await verifyFacebookAccessToken("tok", { fetch: noEmailFetch });
  assert(noEmail.ok === false && /email/i.test(noEmail.error), "email is required");

  const first = userFromFacebook(db, good.info);
  assert(first.created === true, "creates USER");
  assert(first.user.facebook_id === "fb-99", "stores facebook_id");
  assert(!serializeUser(first.user).has_usable_password, "no password");
  assert(
    uniqueUsername(db, "pat.fb@example.com", "Pat") === "pat.fb2",
    "username suffix when taken",
  );

  const again = userFromFacebook(db, good.info);
  assert(again.created === false, "second login is not a new user");
  assert(again.user.id === first.user.id, "same user id");

  db.prepare(
    "INSERT INTO users (username, email, password_hash, role, avatar_seed) VALUES (?, ?, ?, 'USER', ?)",
  ).run("already", "link.fb@example.com", "hash", "already");
  const linked = userFromFacebook(db, {
    id: "fb-link",
    email: "link.fb@example.com",
    name: "Link",
  });
  assert(linked.created === false, "links existing email");
  assert(linked.user.username === "already", "keeps username");

  process.env.FACEBOOK_APP_ID = "";
  process.env.FACEBOOK_APP_SECRET = "";
  const off = facebookPublicConfig();
  assert(off.facebook_enabled === false, "hidden without keys");
  const closed = await verifyFacebookAccessToken("x");
  assert(closed.status === 503, "unconfigured is 503");

  if (failed) {
    console.error(`${failed} failed`);
    process.exit(1);
  }
  console.log("all ok");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
