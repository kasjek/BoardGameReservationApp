/** New tables must start at least 24 hours from now. */

const MIN_LEAD_MS = 24 * 60 * 60 * 1000;
const LEAD_TIME_DETAIL = "Tables must start at least 24 hours from now.";

function startsTooSoon(startsAt, now = Date.now()) {
  const start = new Date(startsAt).getTime();
  return !Number.isFinite(start) || start < now + MIN_LEAD_MS;
}

module.exports = { MIN_LEAD_MS, LEAD_TIME_DETAIL, startsTooSoon };
