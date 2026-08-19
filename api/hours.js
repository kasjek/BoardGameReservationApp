/** Weekly hours ↔ per-date availability, matching backend/apps/venues/hours.py. */

const DEFAULT_HORIZON_WEEKS = 12;
const DEFAULT_TABLES_AVAILABLE = 3;
const WEEKDAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function defaultWeeklyHours() {
  return Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    is_closed: false,
    start_time: "10:00:00",
    end_time: "20:00:00",
  }));
}

function horizonDaysFor(venue, horizonDays) {
  if (horizonDays != null) return Math.max(1, Number(horizonDays));
  const weeks = Math.max(1, Math.min(52, Number(venue?.booking_horizon_weeks || DEFAULT_HORIZON_WEEKS)));
  return weeks * 7;
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDaysISO(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function weekdayMon0(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return (new Date(y, m - 1, d).getDay() + 6) % 7;
}

function normalizeTime(value) {
  if (!value) return null;
  const s = String(value);
  if (/^\d{2}:\d{2}$/.test(s)) return `${s}:00`;
  if (/^\d{2}:\d{2}:\d{2}/.test(s)) return s.slice(0, 8);
  return s;
}

function setWeeklyHours(database, venueId, hours, horizonDays) {
  if (!Array.isArray(hours) || hours.length !== 7) {
    throw Object.assign(new Error("Exactly 7 weekday hour rows are required (Monday–Sunday)."), {
      status: 400,
    });
  }
  const byDay = {};
  for (const h of hours) {
    byDay[Number(h.weekday)] = h;
  }
  for (let weekday = 0; weekday < 7; weekday += 1) {
    if (!(weekday in byDay)) {
      throw Object.assign(new Error("Weekday values must be 0–6 covering every day of the week."), {
        status: 400,
      });
    }
  }

  const tx = database.transaction(() => {
    database.prepare("DELETE FROM venue_hours WHERE venue_id=?").run(venueId);
    const ins = database.prepare(
      `INSERT INTO venue_hours (venue_id, weekday, is_closed, start_time, end_time)
       VALUES (?, ?, ?, ?, ?)`,
    );
    for (let weekday = 0; weekday < 7; weekday += 1) {
      const h = byDay[weekday];
      const isClosed = Boolean(h.is_closed);
      let start = isClosed ? null : normalizeTime(h.start_time);
      let end = isClosed ? null : normalizeTime(h.end_time);
      if (!isClosed) {
        if (!start || !end) {
          throw Object.assign(
            new Error(`${WEEKDAY_NAMES[weekday]} needs start_time and end_time.`),
            { status: 400 },
          );
        }
        if (end <= start) {
          throw Object.assign(
            new Error(`${WEEKDAY_NAMES[weekday]} end_time must be after start_time.`),
            { status: 400 },
          );
        }
      }
      ins.run(venueId, weekday, isClosed ? 1 : 0, start, end);
    }
  });
  tx();

  const venue = database.prepare("SELECT * FROM venues WHERE id=?").get(venueId);
  syncAvailabilityFromHours(database, venueId, horizonDaysFor(venue, horizonDays));
  return database
    .prepare(
      `SELECT weekday, is_closed, start_time, end_time FROM venue_hours WHERE venue_id=? ORDER BY weekday`,
    )
    .all(venueId)
    .map((r) => ({
      weekday: r.weekday,
      is_closed: !!r.is_closed,
      start_time: r.start_time,
      end_time: r.end_time,
    }));
}

function syncAvailabilityFromHours(database, venueId, horizonDays) {
  const hours = database
    .prepare(
      `SELECT weekday, is_closed, start_time, end_time FROM venue_hours WHERE venue_id=? ORDER BY weekday`,
    )
    .all(venueId);
  if (hours.length !== 7) return 0;
  const byDay = Object.fromEntries(hours.map((h) => [h.weekday, h]));
  const closed = new Set(
    database.prepare("SELECT date FROM venue_closures WHERE venue_id=?").all(venueId).map((r) => r.date),
  );
  const today = todayISO();
  const days = Math.max(1, Number(horizonDays) || DEFAULT_HORIZON_WEEKS * 7);
  const del = database.prepare("DELETE FROM venue_availability WHERE venue_id=? AND date=?");
  const ins = database.prepare(
    `INSERT INTO venue_availability (venue_id, date, start_time, end_time, tables_available)
     VALUES (?, ?, ?, ?, ?)`,
  );
  let kept = 0;
  const tx = database.transaction(() => {
    for (let offset = 0; offset < days; offset += 1) {
      const day = addDaysISO(today, offset);
      del.run(venueId, day);
      if (closed.has(day)) continue;
      const wh = byDay[weekdayMon0(day)];
      if (!wh || wh.is_closed || !wh.start_time || !wh.end_time) continue;
      ins.run(venueId, day, wh.start_time, wh.end_time, DEFAULT_TABLES_AVAILABLE);
      kept += 1;
    }
  });
  tx();
  return kept;
}

function applyClosures(database, venueId, closures) {
  const rows = Array.isArray(closures) ? closures : [];
  const ins = database.prepare(
    `INSERT INTO venue_closures (venue_id, date, comment, created_at) VALUES (?, ?, ?, ?)`,
  );
  const now = new Date().toISOString();
  for (const c of rows) {
    if (!c?.date || !c?.comment) continue;
    ins.run(venueId, c.date, String(c.comment), now);
  }
}

module.exports = {
  DEFAULT_HORIZON_WEEKS,
  defaultWeeklyHours,
  horizonDaysFor,
  setWeeklyHours,
  syncAvailabilityFromHours,
  applyClosures,
};
