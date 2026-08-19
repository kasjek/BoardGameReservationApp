/** Private 1:1 chats (story 12 — private messages). */
const { publicPreview } = require("./friends");

const MAX_BODY = 2000;

function httpError(status, detail) {
  const err = new Error(detail);
  err.status = status;
  return err;
}

function userRow(db, id) {
  return db.prepare("SELECT * FROM users WHERE id=?").get(id);
}

function serializeMessage(row, meId) {
  return {
    id: row.id,
    sender_id: row.sender_id,
    recipient_id: row.recipient_id,
    body: row.body,
    created_at: row.created_at,
    mine: row.sender_id === meId,
  };
}

function otherId(row, meId) {
  return row.sender_id === meId ? row.recipient_id : row.sender_id;
}

function requireOther(db, meId, rawId) {
  const id = Number(rawId);
  if (!Number.isFinite(id) || id < 1) throw httpError(404, "User not found.");
  if (id === meId) throw httpError(400, "You cannot message yourself.");
  const other = userRow(db, id);
  if (!other) throw httpError(404, "User not found.");
  return other;
}

function listChats(db, meId) {
  const rows = db
    .prepare(
      `SELECT * FROM direct_messages
       WHERE sender_id=? OR recipient_id=?
       ORDER BY id DESC`,
    )
    .all(meId, meId);
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const oid = otherId(row, meId);
    if (seen.has(oid)) continue;
    seen.add(oid);
    const other = userRow(db, oid);
    if (!other) continue;
    out.push({
      user: publicPreview(db, other, meId),
      last_message: serializeMessage(row, meId),
    });
  }
  return out;
}

function getThread(db, meId, rawId) {
  const other = requireOther(db, meId, rawId);
  const messages = db
    .prepare(
      `SELECT * FROM direct_messages
       WHERE (sender_id=? AND recipient_id=?) OR (sender_id=? AND recipient_id=?)
       ORDER BY id ASC
       LIMIT 200`,
    )
    .all(meId, other.id, other.id, meId)
    .map((row) => serializeMessage(row, meId));
  return { user: publicPreview(db, other, meId), messages };
}

function sendMessage(db, meId, rawId, body) {
  const other = requireOther(db, meId, rawId);
  const text = String(body || "").trim();
  if (!text) throw httpError(400, "Message cannot be empty.");
  if (text.length > MAX_BODY) throw httpError(400, "Message is too long.");
  const info = db
    .prepare(
      `INSERT INTO direct_messages (sender_id, recipient_id, body, created_at)
       VALUES (?, ?, ?, ?)`,
    )
    .run(meId, other.id, text, new Date().toISOString());
  const row = db.prepare("SELECT * FROM direct_messages WHERE id=?").get(info.lastInsertRowid);
  return serializeMessage(row, meId);
}

module.exports = { listChats, getThread, sendMessage };
