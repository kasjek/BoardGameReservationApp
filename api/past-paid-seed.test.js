#!/usr/bin/env node
/** Seed at least 20 completed, paid past tables for demo/alice at 3 venues. */
const fs = require("fs");
const path = require("path");
const os = require("os");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tmg-past-paid-"));
process.env.DATA_DIR = dir;
process.env.SQLITE_PATH = path.join(dir, "app.sqlite3");
process.env.NODE_ENV = "development";

const { ensureDb } = require("./db");
const { PAST_PAID_TABLES, ensurePastPaidTables } = require("./past-paid-seed");

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

assert(PAST_PAID_TABLES.length >= 20, `catalog has ${PAST_PAID_TABLES.length} tables`);

const now = Date.now();
const rows = db
  .prepare(
    `SELECT t.id, t.organizer_id, t.venue_id, t.game_title, t.starts_at, t.ends_at, t.status, t.seats_taken
     FROM tables t
     WHERE t.status='completed' AND t.ends_at < ?`,
  )
  .all(new Date().toISOString());

assert(rows.length >= 20, `seeded ${rows.length} completed past tables`);

const venues = new Set(rows.map((r) => r.venue_id));
assert(venues.size === 3, `covers 3 venues (got ${venues.size})`);

const hosts = db
  .prepare(
    `SELECT DISTINCT u.username
     FROM tables t JOIN users u ON u.id = t.organizer_id
     WHERE t.status='completed'`,
  )
  .all()
  .map((r) => r.username)
  .sort();
assert(
  hosts.every((name) => name === "demo" || name === "alice") && hosts.includes("demo") && hosts.includes("alice"),
  `hosts are demo/alice (got ${hosts.join(",")})`,
);

const unpaid = db
  .prepare(
    `SELECT COUNT(*) AS c FROM seats s
     JOIN tables t ON t.id = s.table_id
     WHERE t.status='completed' AND s.status='reserved' AND s.paid=0`,
  )
  .get().c;
assert(unpaid === 0, "every reserved seat on completed tables is paid");

const future = rows.filter((r) => new Date(r.ends_at).getTime() >= now);
assert(future.length === 0, "none of the seeded completed tables are still in the future");

const before = db.prepare("SELECT COUNT(*) AS c FROM tables WHERE status='completed'").get().c;
const createdAgain = ensurePastPaidTables(db);
const after = db.prepare("SELECT COUNT(*) AS c FROM tables WHERE status='completed'").get().c;
assert(createdAgain === 0 && after === before, "second seed is a no-op");

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nall passed");
