/**
 * Email activation after password registration.
 */
const crypto = require("crypto");
const { emailConfigured, publicAppUrl, sendMail } = require("./mail");

const ACTIVATION_DETAIL =
  "Account is not activated. Check your email and click the activation link.";
const REGISTERED_DETAIL = "Check your email to activate your account before logging in.";
const RESEND_DETAIL = "If that email needs activation, we sent a new link.";
const INVALID_LINK = "This activation link is invalid or has expired.";
const ACTIVATED_DETAIL = "Account activated. You can log in now.";

function activationHours() {
  const n = Number(process.env.ACTIVATION_TOKEN_HOURS || 48);
  return Number.isFinite(n) && n >= 1 ? n : 48;
}

function isActive(user) {
  if (!user) return false;
  if (user.is_active === undefined || user.is_active === null) return true;
  return Boolean(user.is_active);
}

function issueActivationToken(db, userId) {
  db.prepare("DELETE FROM email_activation_tokens WHERE user_id = ?").run(userId);
  const key = crypto.randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + activationHours() * 3600 * 1000).toISOString();
  db.prepare(
    "INSERT INTO email_activation_tokens (key, user_id, expires_at) VALUES (?, ?, ?)",
  ).run(key, userId, expires);
  return { key, user_id: userId, expires_at: expires };
}

function activationLink(key) {
  return `${publicAppUrl()}/activate?token=${key}`;
}

async function sendActivationEmail(user, token) {
  const link = activationLink(token.key);
  const hours = activationHours();
  const subject = "Activate your Too Many Games account";
  const text =
    `Hi ${user.username},\n\n` +
    `Thanks for signing up. Activate your account by opening this link:\n${link}\n\n` +
    `The link expires in ${hours} hours.\n` +
    `If you did not create this account, you can ignore this email.\n`;
  const html =
    `<p>Hi ${user.username},</p>` +
    `<p>Thanks for signing up. Activate your account by clicking the button below.</p>` +
    `<p><a href="${link}" style="display:inline-block;background:#7c3aed;color:#fff;` +
    `padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:700">` +
    `Activate account</a></p>` +
    `<p>Or paste this link into your browser:<br>${link}</p>` +
    `<p>The link expires in ${hours} hours. If you did not create this account, ignore this email.</p>`;
  return sendMail({ to: user.email, subject, text, html });
}

async function issueAndSendActivation(db, user) {
  if (!emailConfigured()) {
    return { ok: false, error: "Email delivery is not configured.", status: 503 };
  }
  const token = issueActivationToken(db, user.id);
  const sent = await sendActivationEmail(user, token);
  if (!sent.ok) return { ok: false, error: sent.error, status: 500, token };
  return { ok: true, token };
}

function activateWithKey(db, key) {
  const tokenKey = typeof key === "string" ? key.trim() : "";
  if (!tokenKey) {
    return { ok: false, error: INVALID_LINK, status: 400 };
  }
  const row = db
    .prepare("SELECT * FROM email_activation_tokens WHERE key = ?")
    .get(tokenKey);
  if (!row) {
    return { ok: false, error: INVALID_LINK, status: 400 };
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare("DELETE FROM email_activation_tokens WHERE key = ?").run(tokenKey);
    return { ok: false, error: INVALID_LINK, status: 400 };
  }
  db.prepare("UPDATE users SET is_active = 1 WHERE id = ?").run(row.user_id);
  db.prepare("DELETE FROM email_activation_tokens WHERE user_id = ?").run(row.user_id);
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(row.user_id);
  return { ok: true, user };
}

function markEmailVerified(db, user) {
  if (!user) return user;
  if (!isActive(user)) {
    db.prepare("UPDATE users SET is_active = 1 WHERE id = ?").run(user.id);
    user.is_active = 1;
  }
  db.prepare("DELETE FROM email_activation_tokens WHERE user_id = ?").run(user.id);
  return user;
}

module.exports = {
  ACTIVATED_DETAIL,
  ACTIVATION_DETAIL,
  INVALID_LINK,
  REGISTERED_DETAIL,
  RESEND_DETAIL,
  activateWithKey,
  activationHours,
  activationLink,
  emailConfigured,
  isActive,
  issueAndSendActivation,
  issueActivationToken,
  markEmailVerified,
  sendActivationEmail,
};
