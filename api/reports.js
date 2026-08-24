/** Abuse reports (story 11 / FR-G2) — persist + email admin. */
const { sendAbuseReportEmail } = require("./mail");

function httpError(status, detail) {
  const err = new Error(detail);
  err.status = status;
  return err;
}

function serializeReport(row) {
  return {
    id: row.id,
    type: row.type,
    subject_type: row.subject_type,
    subject_id: row.subject_id,
    message: row.message,
    status: row.status,
    created_at: row.created_at,
  };
}

async function createReport(db, reporter, payload = {}) {
  const type = String(payload.type || "abuse").trim();
  if (type !== "abuse") throw httpError(400, "Only abuse reports are accepted here.");
  const message = String(payload.message || "").trim();
  if (!message) throw httpError(400, "Please describe what happened.");
  if (message.length > 2000) throw httpError(400, "Report is too long.");

  const subjectType = String(payload.subject_type || "user").trim() || "user";
  if (subjectType !== "user") throw httpError(400, "subject_type must be user.");
  const subjectId = Number(payload.subject_id);
  if (!Number.isFinite(subjectId) || subjectId < 1) {
    throw httpError(400, "subject_id is required.");
  }
  if (subjectId === reporter.id) throw httpError(400, "You cannot report yourself.");
  const accused = db.prepare("SELECT id, username FROM users WHERE id=?").get(subjectId);
  if (!accused) throw httpError(404, "User not found.");

  const context = String(payload.context || "").trim().slice(0, 200);
  const createdAt = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO reports (reporter_id, type, subject_type, subject_id, message, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'open', ?)`,
    )
    .run(reporter.id, type, subjectType, subjectId, message, createdAt);
  const row = db.prepare("SELECT * FROM reports WHERE id=?").get(info.lastInsertRowid);

  await sendAbuseReportEmail({
    reporter: { id: reporter.id, username: reporter.username },
    accused: { id: accused.id, username: accused.username },
    issue: message,
    context: context || "private chat",
  });

  return serializeReport(row);
}

module.exports = { createReport };
