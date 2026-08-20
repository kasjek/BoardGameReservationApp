/** Friend search + requests (stories 14, 27). */
const { serializeUser } = require("./db");

function httpError(status, detail) {
  const err = new Error(detail);
  err.status = status;
  return err;
}

function findPair(db, a, b) {
  return db
    .prepare(
      `SELECT * FROM friendships
       WHERE (requester_id=? AND addressee_id=?)
          OR (requester_id=? AND addressee_id=?)`,
    )
    .get(a, b, b, a);
}

function friendshipPayload(db, viewerId, otherId) {
  if (!viewerId) return null;
  if (viewerId === otherId) return { status: "self", request_id: null };
  const row = findPair(db, viewerId, otherId);
  if (!row || row.status === "rejected") return { status: "none", request_id: row ? row.id : null };
  if (row.status === "accepted") return { status: "friends", request_id: row.id };
  if (row.requester_id === viewerId) return { status: "outgoing", request_id: row.id };
  return { status: "incoming", request_id: row.id };
}

function publicPreview(db, row, viewerId) {
  const s = serializeUser(row);
  return {
    id: s.id,
    username: s.username,
    avatar_seed: s.avatar_seed,
    avatar_equipped: s.avatar_equipped,
    rating_avg: s.rating_avg,
    friendship: friendshipPayload(db, viewerId, row.id),
  };
}

function otherUserId(row, meId) {
  return row.requester_id === meId ? row.addressee_id : row.requester_id;
}

function userRow(db, id) {
  return db.prepare("SELECT * FROM users WHERE id=?").get(id);
}

function searchUsers(db, viewerId, q) {
  const query = String(q || "").trim();
  if (!query) throw httpError(400, "q is required.");
  const rows = db
    .prepare(
      `SELECT * FROM users
       WHERE id != ? AND username LIKE ? COLLATE NOCASE
       ORDER BY CASE WHEN lower(username)=lower(?) THEN 0 ELSE 1 END, username
       LIMIT 20`,
    )
    .all(viewerId, `%${query}%`, query);
  return rows.map((row) => publicPreview(db, row, viewerId));
}

function listFriends(db, viewerId) {
  const rows = db
    .prepare(
      `SELECT * FROM friendships
       WHERE status='accepted' AND (requester_id=? OR addressee_id=?)
       ORDER BY id DESC`,
    )
    .all(viewerId, viewerId);
  return rows.map((row) => publicPreview(db, userRow(db, otherUserId(row, viewerId)), viewerId));
}

function listRequests(db, viewerId) {
  const incoming = db
    .prepare(
      `SELECT * FROM friendships WHERE addressee_id=? AND status='pending' ORDER BY id DESC`,
    )
    .all(viewerId)
    .map((row) => ({
      id: row.id,
      user: publicPreview(db, userRow(db, row.requester_id), viewerId),
    }));
  const outgoing = db
    .prepare(
      `SELECT * FROM friendships WHERE requester_id=? AND status='pending' ORDER BY id DESC`,
    )
    .all(viewerId)
    .map((row) => ({
      id: row.id,
      user: publicPreview(db, userRow(db, row.addressee_id), viewerId),
    }));
  return { incoming, outgoing };
}

function serializeRequest(db, row, viewerId) {
  return {
    id: row.id,
    status: row.status,
    requester_id: row.requester_id,
    addressee_id: row.addressee_id,
    user: publicPreview(db, userRow(db, otherUserId(row, viewerId)), viewerId),
  };
}

function sendRequest(db, viewerId, { username, user_id }) {
  let other;
  if (user_id != null && user_id !== "") {
    other = userRow(db, Number(user_id));
  } else if (username) {
    other = db
      .prepare("SELECT * FROM users WHERE username=? COLLATE NOCASE")
      .get(String(username).trim());
  }
  if (!other) throw httpError(404, "User not found.");
  if (other.id === viewerId) throw httpError(400, "You cannot add yourself.");

  const existing = findPair(db, viewerId, other.id);
  if (!existing) {
    const info = db
      .prepare(
        `INSERT INTO friendships (requester_id, addressee_id, status, created_at)
         VALUES (?, ?, 'pending', ?)`,
      )
      .run(viewerId, other.id, new Date().toISOString());
    const row = db.prepare("SELECT * FROM friendships WHERE id=?").get(info.lastInsertRowid);
    return serializeRequest(db, row, viewerId);
  }
  if (existing.status === "accepted") throw httpError(409, "You are already friends.");
  if (existing.status === "pending" && existing.requester_id === viewerId) {
    throw httpError(409, "Friend request already sent.");
  }
  if (existing.status === "pending" && existing.addressee_id === viewerId) {
    db.prepare("UPDATE friendships SET status='accepted' WHERE id=?").run(existing.id);
    const row = db.prepare("SELECT * FROM friendships WHERE id=?").get(existing.id);
    return serializeRequest(db, row, viewerId);
  }
  db.prepare(
    `UPDATE friendships SET requester_id=?, addressee_id=?, status='pending', created_at=? WHERE id=?`,
  ).run(viewerId, other.id, new Date().toISOString(), existing.id);
  const row = db.prepare("SELECT * FROM friendships WHERE id=?").get(existing.id);
  return serializeRequest(db, row, viewerId);
}

function acceptRequest(db, viewerId, requestId) {
  const row = db.prepare("SELECT * FROM friendships WHERE id=?").get(Number(requestId));
  if (!row) throw httpError(404, "Friend request not found.");
  if (row.addressee_id !== viewerId) throw httpError(403, "Only the recipient can accept.");
  if (row.status !== "pending") throw httpError(409, "This request is no longer pending.");
  db.prepare("UPDATE friendships SET status='accepted' WHERE id=?").run(row.id);
  return serializeRequest(db, db.prepare("SELECT * FROM friendships WHERE id=?").get(row.id), viewerId);
}

function rejectRequest(db, viewerId, requestId) {
  const row = db.prepare("SELECT * FROM friendships WHERE id=?").get(Number(requestId));
  if (!row) throw httpError(404, "Friend request not found.");
  if (row.addressee_id !== viewerId) throw httpError(403, "Only the recipient can reject.");
  if (row.status !== "pending") throw httpError(409, "This request is no longer pending.");
  db.prepare("UPDATE friendships SET status='rejected' WHERE id=?").run(row.id);
  return serializeRequest(db, db.prepare("SELECT * FROM friendships WHERE id=?").get(row.id), viewerId);
}

module.exports = {
  friendshipPayload,
  publicPreview,
  searchUsers,
  listFriends,
  listRequests,
  sendRequest,
  acceptRequest,
  rejectRequest,
};
