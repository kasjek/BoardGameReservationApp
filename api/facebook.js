/**
 * Facebook Login: verify a user access token against this app, then load profile.
 */
const GRAPH_BASE = "https://graph.facebook.com";

function facebookAppId() {
  return (process.env.FACEBOOK_APP_ID || "").trim();
}

function facebookAppSecret() {
  return (process.env.FACEBOOK_APP_SECRET || "").trim();
}

function facebookConfigured() {
  return Boolean(facebookAppId() && facebookAppSecret());
}

function facebookPublicConfig() {
  const enabled = facebookConfigured();
  return {
    facebook_enabled: enabled,
    facebook_app_id: enabled ? facebookAppId() : null,
  };
}

/**
 * @param {string} accessToken
 * @param {{ fetch?: typeof fetch }} [deps]
 * @returns {Promise<{ ok: true, info: { id: string, email: string, name: string } } | { ok: false, error: string, status: number }>}
 */
async function verifyFacebookAccessToken(accessToken, deps = {}) {
  if (!facebookConfigured()) {
    return { ok: false, error: "Facebook sign-in is not configured.", status: 503 };
  }
  const token = typeof accessToken === "string" ? accessToken.trim() : "";
  if (!token) {
    return { ok: false, error: "Facebook access token is required.", status: 400 };
  }
  const doFetch = deps.fetch || fetch;
  const appId = facebookAppId();
  const appToken = `${appId}|${facebookAppSecret()}`;
  try {
    const debugUrl = `${GRAPH_BASE}/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(appToken)}`;
    const debugResp = await doFetch(debugUrl);
    const debugBody = await debugResp.json();
    const data = debugBody.data || {};
    if (!data.is_valid || String(data.app_id || "") !== appId) {
      return { ok: false, error: "Facebook sign-in could not be verified.", status: 400 };
    }
    const userId = String(data.user_id || "");
    if (!userId) {
      return { ok: false, error: "Facebook sign-in could not be verified.", status: 400 };
    }

    const meUrl = `${GRAPH_BASE}/me?fields=id,name,email&access_token=${encodeURIComponent(token)}`;
    const meResp = await doFetch(meUrl);
    const me = await meResp.json();
    const id = String(me.id || userId);
    const email = String(me.email || "").trim().toLowerCase();
    if (!email) {
      return { ok: false, error: "Facebook did not provide an email.", status: 400 };
    }
    return { ok: true, info: { id, email, name: me.name || "" } };
  } catch {
    return { ok: false, error: "Facebook sign-in could not be verified.", status: 400 };
  }
}

function uniqueUsername(db, email, name) {
  const local = (email || "").split("@", 1)[0];
  let raw = local || name || "user";
  let cleaned = String(raw).replace(/[^A-Za-z0-9._]/g, "").slice(0, 24);
  if (!cleaned) cleaned = "user";
  if (/^\d/.test(cleaned)) cleaned = `u${cleaned}`.slice(0, 24);
  let candidate = cleaned;
  let n = 2;
  while (db.prepare("SELECT id FROM users WHERE username = ? COLLATE NOCASE").get(candidate)) {
    const suffix = String(n);
    candidate = `${cleaned.slice(0, Math.max(1, 24 - suffix.length))}${suffix}`;
    n += 1;
    if (n > 10_000) throw new Error("Could not allocate a username.");
  }
  return candidate;
}

/**
 * Find or create a USER from a verified Facebook profile.
 * @returns {{ user: object, created: boolean }}
 */
function userFromFacebook(db, info) {
  const fbId = String(info.id);
  const email = String(info.email || "").trim().toLowerCase();
  const existing = db.prepare("SELECT * FROM users WHERE facebook_id = ?").get(fbId);
  if (existing) {
    if (email && !existing.email) {
      db.prepare("UPDATE users SET email = ? WHERE id = ?").run(email, existing.id);
      existing.email = email;
    }
    return { user: existing, created: false };
  }
  if (email) {
    const byEmail = db.prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE").get(email);
    if (byEmail) {
      if (byEmail.facebook_id && byEmail.facebook_id !== fbId) {
        throw Object.assign(new Error("This Facebook account cannot be linked."), { status: 400 });
      }
      db.prepare("UPDATE users SET facebook_id = ? WHERE id = ?").run(fbId, byEmail.id);
      byEmail.facebook_id = fbId;
      return { user: byEmail, created: false };
    }
  }
  const username = uniqueUsername(db, email, info.name);
  const infoRow = db
    .prepare(
      `INSERT INTO users (username, email, password_hash, role, avatar_seed, facebook_id)
       VALUES (?, ?, '', 'USER', ?, ?)`,
    )
    .run(username, email, username, fbId);
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(infoRow.lastInsertRowid);
  return { user, created: true };
}

module.exports = {
  facebookPublicConfig,
  facebookConfigured,
  verifyFacebookAccessToken,
  userFromFacebook,
  uniqueUsername,
};
