const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { hydrateCategories, parseStoredCategoryIds } = require("./bgg-categories");

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const DB_PATH = process.env.SQLITE_PATH || path.join(DATA_DIR, "app.sqlite3");

let db;

function mapsUrl(name, location) {
  const q = [name, location].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

function ensureDb() {
  if (db) return db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL DEFAULT '',
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'USER',
      venue_id INTEGER,
      allow_invites INTEGER NOT NULL DEFAULT 1,
      avatar_seed TEXT NOT NULL DEFAULT '',
      cancellations_count INTEGER NOT NULL DEFAULT 0,
      favorite_categories TEXT NOT NULL DEFAULT '[]'
    );
    CREATE TABLE IF NOT EXISTS tokens (
      key TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS friendships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      addressee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      UNIQUE(requester_id, addressee_id),
      CHECK (requester_id != addressee_id)
    );
    CREATE TABLE IF NOT EXISTS direct_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      CHECK (sender_id != recipient_id)
    );
    CREATE INDEX IF NOT EXISTS idx_direct_messages_pair
      ON direct_messages (sender_id, recipient_id, id);
    CREATE TABLE IF NOT EXISTS venues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      min_players INTEGER NOT NULL DEFAULT 2,
      max_players INTEGER NOT NULL DEFAULT 8,
      min_reservation_minutes INTEGER NOT NULL DEFAULT 60,
      max_reservation_minutes INTEGER NOT NULL DEFAULT 180
    );
    CREATE TABLE IF NOT EXISTS venue_availability (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venue_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      tables_available INTEGER NOT NULL DEFAULT 3
    );
    CREATE TABLE IF NOT EXISTS venue_hours (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venue_id INTEGER NOT NULL,
      weekday INTEGER NOT NULL,
      is_closed INTEGER NOT NULL DEFAULT 0,
      start_time TEXT,
      end_time TEXT,
      UNIQUE(venue_id, weekday)
    );
    CREATE TABLE IF NOT EXISTS venue_closures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venue_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      comment TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS venue_games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venue_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      bgg_id INTEGER,
      thumbnail_url TEXT NOT NULL DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      min_players INTEGER NOT NULL DEFAULT 2,
      max_players INTEGER NOT NULL DEFAULT 8
    );
    CREATE TABLE IF NOT EXISTS tables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organizer_id INTEGER NOT NULL,
      venue_id INTEGER NOT NULL,
      game_title TEXT NOT NULL,
      bring_own_game INTEGER NOT NULL DEFAULT 0,
      game_language TEXT NOT NULL DEFAULT 'en',
      game_language_other TEXT NOT NULL DEFAULT '',
      venue_game_confirmed INTEGER NOT NULL DEFAULT 0,
      starts_at TEXT NOT NULL,
      ends_at TEXT NOT NULL,
      min_players INTEGER NOT NULL,
      max_players INTEGER NOT NULL,
      status TEXT NOT NULL,
      seats_taken INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS seats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      is_organizer INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      waitlist_position INTEGER,
      paid INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_id INTEGER NOT NULL,
      table_id INTEGER NOT NULL,
      target_type TEXT NOT NULL,
      target_user_id INTEGER,
      target_venue_id INTEGER,
      rating INTEGER NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
  `);
  migrateSchema(db);
  seedIfEmpty(db);
  return db;
}

const STATUS_ALIASES = {
  waiting_for_venue_confirmation: "requested",
  waiting_for_players: "available",
  confirmed: "confirmed_unpaid",
};

const JOINABLE_STATUSES = ["available", "confirmed_unpaid", "confirmed_paid"];

function canonicalTableStatus(status) {
  return STATUS_ALIASES[status] || status;
}

function migrateSchema(database) {
  const { capTablesToGameLimits } = require("./game-limits");
  const seatCols = database.prepare("PRAGMA table_info(seats)").all().map((c) => c.name);
  if (!seatCols.includes("paid")) {
    database.exec("ALTER TABLE seats ADD COLUMN paid INTEGER NOT NULL DEFAULT 0");
  }
  const userCols = database.prepare("PRAGMA table_info(users)").all().map((c) => c.name);
  if (!userCols.includes("favorite_categories")) {
    database.exec("ALTER TABLE users ADD COLUMN favorite_categories TEXT NOT NULL DEFAULT '[]'");
  }
  const gameCols = database.prepare("PRAGMA table_info(venue_games)").all().map((c) => c.name);
  const addedSeatLimits = !gameCols.includes("min_players") || !gameCols.includes("max_players");
  if (!gameCols.includes("min_players")) {
    database.exec("ALTER TABLE venue_games ADD COLUMN min_players INTEGER NOT NULL DEFAULT 2");
  }
  if (!gameCols.includes("max_players")) {
    database.exec("ALTER TABLE venue_games ADD COLUMN max_players INTEGER NOT NULL DEFAULT 8");
  }
  if (addedSeatLimits) {
    database.exec(
      `UPDATE venue_games SET min_players=2, max_players=2 WHERE lower(trim(title))='patchwork'`,
    );
  }
  database.exec(`
    UPDATE tables SET status='requested' WHERE status='waiting_for_venue_confirmation';
    UPDATE tables SET status='available' WHERE status='waiting_for_players';
    UPDATE tables SET status='confirmed_unpaid' WHERE status='confirmed';
  `);
  database.exec(`
    UPDATE seats SET paid=1
    WHERE status='reserved'
      AND table_id IN (SELECT id FROM tables WHERE bring_own_game=1);
  `);
  const unpaidConfirmed = database
    .prepare(
      `SELECT t.id FROM tables t
       WHERE t.status='confirmed_unpaid' AND t.bring_own_game=1
         AND (SELECT COUNT(*) FROM seats s WHERE s.table_id=t.id AND s.status='reserved') >= t.min_players
         AND NOT EXISTS (
           SELECT 1 FROM seats s WHERE s.table_id=t.id AND s.status='reserved' AND s.paid=0
         )`,
    )
    .all();
  const markPaid = database.prepare("UPDATE tables SET status='confirmed_paid' WHERE id=?");
  for (const row of unpaidConfirmed) markPaid.run(row.id);
  capTablesToGameLimits(database);
}

function expandStatusFilter(status) {
  if (!status) return null;
  if (status === "available") return JOINABLE_STATUSES;
  if (status === "waiting_for_venue_confirmation") return ["requested"];
  if (status === "waiting_for_players") return ["available"];
  if (status === "confirmed") return ["confirmed_unpaid", "confirmed_paid"];
  return [canonicalTableStatus(status)];
}

function syncOpenTableStatus(database, tableId) {
  const table = database.prepare("SELECT * FROM tables WHERE id=?").get(tableId);
  if (!table) return null;
  const status = canonicalTableStatus(table.status);
  if (status === "requested" || status === "cancelled" || status === "completed") {
    return table;
  }
  const reserved = database
    .prepare(`SELECT id, paid FROM seats WHERE table_id=? AND status='reserved'`)
    .all(tableId);
  let next = "available";
  if (reserved.length >= table.min_players) {
    const needsPay = !table.bring_own_game;
    const unpaid = needsPay && reserved.some((s) => !s.paid);
    next = unpaid ? "confirmed_unpaid" : "confirmed_paid";
  }
  if (next !== status) {
    database.prepare("UPDATE tables SET status=? WHERE id=?").run(next, tableId);
  }
  return database.prepare("SELECT * FROM tables WHERE id=?").get(tableId);
}

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function checkPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

function newToken() {
  return crypto.randomBytes(24).toString("hex");
}

function seedIfEmpty(database) {
  const n = database.prepare("SELECT COUNT(*) AS c FROM users").get().c;
  if (n > 0) return;

  const insertUser = database.prepare(
    `INSERT INTO users (username, email, password_hash, role, venue_id, avatar_seed)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const insertVenue = database.prepare(
    `INSERT INTO venues (name, description, location, min_players, max_players, min_reservation_minutes, max_reservation_minutes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertHours = database.prepare(
    `INSERT INTO venue_hours (venue_id, weekday, is_closed, start_time, end_time) VALUES (?, ?, 0, ?, ?)`,
  );
  const insertAvail = database.prepare(
    `INSERT INTO venue_availability (venue_id, date, start_time, end_time, tables_available) VALUES (?, ?, ?, ?, 3)`,
  );
  const insertGame = database.prepare(
    `INSERT INTO venue_games (venue_id, title, bgg_id, thumbnail_url, min_players, max_players) VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const insertTable = database.prepare(
    `INSERT INTO tables (organizer_id, venue_id, game_title, bring_own_game, game_language, venue_game_confirmed, starts_at, ends_at, min_players, max_players, status, seats_taken, created_at)
     VALUES (?, ?, ?, 0, 'de', 1, ?, ?, 2, 4, 'available', 1, ?)`,
  );
  const insertSeat = database.prepare(
    `INSERT INTO seats (table_id, user_id, is_organizer, status, waitlist_position, paid) VALUES (?, ?, 1, 'reserved', NULL, 0)`,
  );

  const tx = database.transaction(() => {
    const dateHouse = insertVenue.run(
      "Date House Cafe",
      "Board-game-friendly cafe in Nürnberg's old town.",
      "Breite G. 88, 90402 Nürnberg",
      2,
      8,
      60,
      180,
    ).lastInsertRowid;
    const katzen = insertVenue.run(
      "Katzentempel",
      "Vegan cat café restaurant in Nürnberg's old town.",
      "Peter-Vischer-Straße 21, 90403 Nürnberg",
      2,
      8,
      60,
      180,
    ).lastInsertRowid;
    const knorz = insertVenue.run(
      "Hotel Knorz",
      "Hotel with board-game tables.",
      "Nürnberg",
      2,
      8,
      60,
      180,
    ).lastInsertRowid;

    const hours = {
      [dateHouse]: [
        ["10:00", "20:00"],
        ["10:00", "20:00"],
        ["10:00", "20:00"],
        ["10:00", "20:00"],
        ["10:00", "22:00"],
        ["09:00", "22:00"],
        ["09:00", "20:00"],
      ],
      [katzen]: [
        ["10:00", "20:30"],
        ["10:00", "20:30"],
        ["10:00", "20:30"],
        ["10:00", "20:30"],
        ["09:30", "20:30"],
        ["09:30", "20:30"],
        ["09:30", "19:30"],
      ],
      [knorz]: Array(7).fill(["10:00", "22:00"]),
    };
    for (const [vid, rows] of Object.entries(hours)) {
      rows.forEach(([s, e], weekday) => insertHours.run(Number(vid), weekday, s, e));
    }

    // Next 60 days of availability from hours
    const today = new Date();
    for (let d = 0; d < 60; d++) {
      const day = new Date(today);
      day.setDate(today.getDate() + d);
      const iso = day.toISOString().slice(0, 10);
      const weekday = (day.getDay() + 6) % 7; // Mon=0
      for (const vid of [dateHouse, katzen, knorz]) {
        const h = hours[vid][weekday];
        insertAvail.run(vid, iso, h[0], h[1]);
      }
    }

    const games = [
      [dateHouse, "Love Letter", 129622, 2, 8],
      [dateHouse, "Patchwork", 163412, 2, 2],
      [dateHouse, "Onitama", 160477, 2, 8],
      [katzen, "The Isle of Cats", 281259, 2, 8],
      [katzen, "Spicy", 299169, 2, 8],
      [katzen, "Calico", 283155, 2, 8],
      [knorz, "Catan", 13, 2, 8],
      [knorz, "Secret Hitler", 188834, 2, 8],
    ];
    for (const [vid, title, bgg, minP, maxP] of games) {
      insertGame.run(vid, title, bgg, "", minP, maxP);
    }

    insertUser.run("demo", "", hashPassword("demopass"), "USER", null, "demo");
    insertUser.run("alice", "alice@example.com", hashPassword("playpass1"), "USER", null, "alice");
    insertUser.run("bob", "bob@example.com", hashPassword("playpass1"), "USER", null, "bob");
    insertUser.run("charlie", "charlie@example.com", hashPassword("playpass1"), "USER", null, "charlie");
    insertUser.run("chester", "chester@chomik.pl", hashPassword("playpass1"), "USER", null, "chester");
    insertUser.run("admin", "admin@example.com", hashPassword("adminpass"), "ADMIN", null, "admin");
    insertUser.run(
      "datehouse",
      "datehouse@example.com",
      hashPassword("venuepass"),
      "VENUE_USER",
      dateHouse,
      "datehouse",
    );
    insertUser.run(
      "katzen",
      "katzen@katzentempel.example",
      hashPassword("VenuePass1!"),
      "VENUE_USER",
      katzen,
      "katzen",
    );
    insertUser.run(
      "knorz",
      "knorz@hotelknorz.example",
      hashPassword("VenuePass1!"),
      "VENUE_USER",
      knorz,
      "knorz",
    );

    const demoId = database.prepare("SELECT id FROM users WHERE username='demo'").get().id;
    const aliceId = database.prepare("SELECT id FROM users WHERE username='alice'").get().id;
    const now = new Date();
    const mkStart = (days, hour) => {
      const s = new Date(now);
      s.setDate(s.getDate() + days);
      s.setHours(hour, 0, 0, 0);
      const e = new Date(s);
      e.setHours(hour + 2);
      return [s.toISOString(), e.toISOString()];
    };
    const created = new Date().toISOString();
    const demos = [
      [demoId, knorz, "Secret Hitler", ...mkStart(1, 10)],
      [aliceId, katzen, "The Isle of Cats", ...mkStart(1, 11)],
      [demoId, dateHouse, "Love Letter", ...mkStart(1, 11)],
    ];
    for (const [org, vid, game, start, end] of demos) {
      const tid = insertTable.run(org, vid, game, start, end, created).lastInsertRowid;
      insertSeat.run(tid, org);
    }
  });
  tx();
}

function gameStats(database, userId) {
  const sessions = database
    .prepare(
      `SELECT t.id AS table_id, t.game_title, t.starts_at, t.ends_at, t.status,
              v.name AS venue_name, s.is_organizer
       FROM seats s
       JOIN tables t ON t.id = s.table_id
       JOIN venues v ON v.id = t.venue_id
       WHERE s.user_id=? AND s.status='reserved' AND t.status != 'cancelled'
       ORDER BY t.starts_at DESC`,
    )
    .all(userId)
    .map((row) => ({
      table_id: row.table_id,
      game_title: row.game_title,
      starts_at: row.starts_at,
      ends_at: row.ends_at,
      venue_name: row.venue_name || "",
      status: canonicalTableStatus(row.status),
      is_organizer: !!row.is_organizer,
    }));
  const grouped = new Map();
  for (const session of sessions) {
    const key = session.game_title.toLowerCase();
    const existing = grouped.get(key);
    if (existing) existing.count += 1;
    else grouped.set(key, { title: session.game_title, count: 1 });
  }
  const titles = [...grouped.values()].sort(
    (a, b) => b.count - a.count || a.title.localeCompare(b.title),
  );
  return {
    games_played: sessions.length,
    different_games: titles.length,
    sessions,
    titles,
  };
}

function serializeUser(row) {
  if (!row) return null;
  const rating = db
    .prepare(
      `SELECT AVG(rating) AS avg FROM reviews WHERE target_type='user' AND target_user_id=?`,
    )
    .get(row.id);
  const games = gameStats(db, row.id);
  return {
    id: row.id,
    username: row.username,
    email: row.email || "",
    role: row.role,
    venue: row.venue_id,
    allow_invites: !!row.allow_invites,
    avatar_seed: row.avatar_seed || String(row.id),
    rating_avg: rating?.avg != null ? Number(rating.avg) : null,
    cancellations_count: row.cancellations_count || 0,
    late_cancel_marks_active: 0,
    games_played: games.games_played,
    different_games: games.different_games,
    favorite_categories: hydrateCategories(parseStoredCategoryIds(row.favorite_categories)),
  };
}

function serializeVenue(row) {
  const rating = db
    .prepare(
      `SELECT AVG(rating) AS avg FROM reviews WHERE target_type='venue' AND target_venue_id=?`,
    )
    .get(row.id);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    location: row.location,
    min_players: row.min_players,
    max_players: row.max_players,
    min_reservation_minutes: row.min_reservation_minutes,
    max_reservation_minutes: row.max_reservation_minutes,
    rating_avg: rating?.avg != null ? Number(rating.avg) : null,
    maps_url: mapsUrl(row.name, row.location),
  };
}

function serializeTable(row) {
  const venue = db.prepare("SELECT name FROM venues WHERE id=?").get(row.venue_id);
  return {
    id: row.id,
    organizer: row.organizer_id,
    venue: row.venue_id,
    venue_name: venue?.name || "",
    game_title: row.game_title,
    bring_own_game: !!row.bring_own_game,
    game_language: row.game_language,
    game_language_other: row.game_language_other || "",
    venue_game_confirmed: !!row.venue_game_confirmed,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    min_players: row.min_players,
    max_players: row.max_players,
    status: canonicalTableStatus(row.status),
    seats_taken: row.seats_taken,
    created_at: row.created_at,
  };
}

function serializeSeat(row) {
  const u = db.prepare("SELECT username, avatar_seed FROM users WHERE id=?").get(row.user_id);
  return {
    id: row.id,
    table: row.table_id,
    user: row.user_id,
    username: u?.username || "",
    avatar_seed: u?.avatar_seed || String(row.user_id),
    is_organizer: !!row.is_organizer,
    status: row.status,
    waitlist_position: row.waitlist_position,
    paid: !!row.paid,
  };
}

function validPassword(password) {
  if (!password || password.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(password)) return "Password must include at least one capital letter.";
  if (!/[^A-Za-z0-9]/.test(password))
    return "Password must include at least one special character.";
  return null;
}

module.exports = {
  ensureDb,
  hashPassword,
  checkPassword,
  newToken,
  serializeUser,
  serializeVenue,
  serializeTable,
  serializeSeat,
  validPassword,
  gameStats,
  mapsUrl,
  canonicalTableStatus,
  expandStatusFilter,
  syncOpenTableStatus,
  JOINABLE_STATUSES,
  getDb: () => ensureDb(),
};
