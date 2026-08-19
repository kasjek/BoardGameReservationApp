const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

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
      cancellations_count INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS tokens (
      key TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
    );
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
      is_active INTEGER NOT NULL DEFAULT 1
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
      waitlist_position INTEGER
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
    CREATE TABLE IF NOT EXISTS bgg_games (
      bgg_id INTEGER PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      types TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL
    );
  `);
  migrateSchema(db);
  seedIfEmpty(db);
  return db;
}

function migrateSchema(database) {
  const userCols = database.prepare("PRAGMA table_info(users)").all().map((c) => c.name);
  if (!userCols.includes("google_sub")) {
    database.exec("ALTER TABLE users ADD COLUMN google_sub TEXT");
  }
  database.exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub
     ON users(google_sub) WHERE google_sub IS NOT NULL AND google_sub != ''`,
  );
  const tableCols = database.prepare("PRAGMA table_info(tables)").all().map((c) => c.name);
  if (!tableCols.includes("game_types")) {
    database.exec("ALTER TABLE tables ADD COLUMN game_types TEXT NOT NULL DEFAULT '[]'");
  }
  database.exec(`
    CREATE TABLE IF NOT EXISTS bgg_games (
      bgg_id INTEGER PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      types TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL
    );
  `);
}

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function checkPassword(password, hash) {
  if (!password || !hash) return false;
  try {
    return bcrypt.compareSync(password, hash);
  } catch {
    return false;
  }
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
    `INSERT INTO venue_games (venue_id, title, bgg_id, thumbnail_url) VALUES (?, ?, ?, ?)`,
  );
  const insertTable = database.prepare(
    `INSERT INTO tables (organizer_id, venue_id, game_title, bring_own_game, game_language, venue_game_confirmed, starts_at, ends_at, min_players, max_players, status, seats_taken, created_at)
     VALUES (?, ?, ?, 0, 'de', 1, ?, ?, 2, 4, 'waiting_for_players', 1, ?)`,
  );
  const insertSeat = database.prepare(
    `INSERT INTO seats (table_id, user_id, is_organizer, status, waitlist_position) VALUES (?, ?, 1, 'reserved', NULL)`,
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
      [dateHouse, "Love Letter", 129622],
      [dateHouse, "Patchwork", 163412],
      [dateHouse, "Onitama", 160477],
      [katzen, "The Isle of Cats", 281259],
      [katzen, "Spicy", 299169],
      [katzen, "Calico", 283155],
      [knorz, "Catan", 13],
      [knorz, "Secret Hitler", 188834],
    ];
    for (const [vid, title, bgg] of games) {
      insertGame.run(vid, title, bgg, "");
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

function serializeUser(row) {
  if (!row) return null;
  const rating = db
    .prepare(
      `SELECT AVG(rating) AS avg FROM reviews WHERE target_type='user' AND target_user_id=?`,
    )
    .get(row.id);
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
    has_usable_password: Boolean(row.password_hash),
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
    status: row.status,
    seats_taken: row.seats_taken,
    created_at: row.created_at,
    game_types: parseGameTypes(row.game_types),
  };
}

function parseGameTypes(raw) {
  if (Array.isArray(raw)) return raw;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
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
  mapsUrl,
  getDb: () => ensureDb(),
};
