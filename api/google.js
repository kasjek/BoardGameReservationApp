/**
 * Google Identity Services ID-token verify + local USER provisioning.
 * Set GOOGLE_CLIENT_ID (OAuth web client) to enable /api/auth/google.
 */
const crypto = require("crypto");

class GoogleAuthError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function googleClientId() {
  return String(process.env.GOOGLE_CLIENT_ID || "").trim();
}

let jwksCache = { keys: null, exp: 0 };

async function googleJwks() {
  if (jwksCache.keys && Date.now() < jwksCache.exp) return jwksCache.keys;
  const res = await fetch("https://www.googleapis.com/oauth2/v3/certs", {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new GoogleAuthError("Google sign-in could not be verified.");
  const data = await res.json();
  const keys = data.keys || [];
  jwksCache = { keys, exp: Date.now() + 60 * 60 * 1000 };
  return keys;
}

function b64urlJson(part) {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
}

async function verifyGoogleIdToken(credential) {
  const clientId = googleClientId();
  if (!clientId) throw new GoogleAuthError("Google sign-in is not configured.", 503);
  if (!credential || typeof credential !== "string") {
    throw new GoogleAuthError("Google credential is required.");
  }
  const parts = credential.split(".");
  if (parts.length !== 3) throw new GoogleAuthError("Google sign-in could not be verified.");

  const [h, p, sig] = parts;
  let header;
  let payload;
  try {
    header = b64urlJson(h);
    payload = b64urlJson(p);
  } catch {
    throw new GoogleAuthError("Google sign-in could not be verified.");
  }

  const keys = await googleJwks();
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new GoogleAuthError("Google sign-in could not be verified.");

  const key = crypto.createPublicKey({ key: jwk, format: "jwk" });
  const ok = crypto.verify("RSA-SHA256", Buffer.from(`${h}.${p}`), key, Buffer.from(sig, "base64url"));
  if (!ok) throw new GoogleAuthError("Google sign-in could not be verified.");

  const issOk =
    payload.iss === "accounts.google.com" || payload.iss === "https://accounts.google.com";
  const aud = payload.aud;
  const audOk = aud === clientId || (Array.isArray(aud) && aud.includes(clientId));
  const expOk = typeof payload.exp === "number" && payload.exp * 1000 > Date.now() - 10_000;
  if (!issOk || !audOk || !expOk) {
    throw new GoogleAuthError("Google sign-in could not be verified.");
  }
  if (!payload.sub || !payload.email || !payload.email_verified) {
    throw new GoogleAuthError("Google did not provide a verified email.");
  }
  return payload;
}

function uniqueUsername(db, email, name) {
  const local = String(email || "").split("@")[0];
  let base = String(local || name || "user")
    .replace(/[^A-Za-z0-9._]/g, "")
    .slice(0, 24);
  if (!base) base = "user";
  if (/^\d/.test(base)) base = `u${base}`.slice(0, 24);
  let candidate = base;
  let n = 2;
  while (db.prepare("SELECT id FROM users WHERE username = ? COLLATE NOCASE").get(candidate)) {
    const suffix = String(n);
    candidate = `${base.slice(0, Math.max(1, 24 - suffix.length))}${suffix}`;
    n += 1;
    if (n > 10_000) throw new GoogleAuthError("Could not allocate a username.");
  }
  return candidate;
}

function userFromGoogle(db, info) {
  const sub = String(info.sub);
  const email = String(info.email || "").trim().toLowerCase();

  let row = db.prepare("SELECT * FROM users WHERE google_sub = ?").get(sub);
  if (row) {
    if (email && !row.email) {
      db.prepare("UPDATE users SET email = ? WHERE id = ?").run(email, row.id);
      row = db.prepare("SELECT * FROM users WHERE id = ?").get(row.id);
    }
    return { user: row, created: false };
  }

  if (email) {
    const byEmail = db
      .prepare("SELECT * FROM users WHERE lower(email) = lower(?) AND email != ''")
      .get(email);
    if (byEmail) {
      if (byEmail.google_sub && byEmail.google_sub !== sub) {
        throw new GoogleAuthError("This Google account cannot be linked.");
      }
      db.prepare("UPDATE users SET google_sub = ? WHERE id = ?").run(sub, byEmail.id);
      return { user: db.prepare("SELECT * FROM users WHERE id = ?").get(byEmail.id), created: false };
    }
  }

  const username = uniqueUsername(db, email, info.name);
  const infoIns = db
    .prepare(
      `INSERT INTO users (username, email, password_hash, role, avatar_seed, google_sub)
       VALUES (?, ?, '', 'USER', ?, ?)`,
    )
    .run(username, email, username, sub);
  return {
    user: db.prepare("SELECT * FROM users WHERE id = ?").get(infoIns.lastInsertRowid),
    created: true,
  };
}

module.exports = {
  GoogleAuthError,
  googleClientId,
  verifyGoogleIdToken,
  userFromGoogle,
  uniqueUsername,
};
