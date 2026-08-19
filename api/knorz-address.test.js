#!/usr/bin/env node
/**
 * Hotel Knorz street address + Google Maps URL (no live Google).
 */
const fs = require("fs");
const path = require("path");
const os = require("os");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tmg-knorz-"));
process.env.SQLITE_PATH = path.join(dir, "app.sqlite3");

const { ensureDb, mapsUrl, serializeVenue, HOTEL_KNORZ_ADDRESS, syncDemoVenueAddresses } =
  require("./db");

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

const expected = "Volkhardtstraße 18, 90513 Zirndorf";
assert(HOTEL_KNORZ_ADDRESS === expected, `constant is ${JSON.stringify(HOTEL_KNORZ_ADDRESS)}`);

const row = db.prepare("SELECT * FROM venues WHERE name = ?").get("Hotel Knorz");
assert(!!row, "Hotel Knorz is seeded");
assert(row.location === expected, `seeded location is ${JSON.stringify(row.location)}`);

const ser = serializeVenue(row);
assert(ser.location === expected, "serialized location");
assert(ser.maps_url.includes("google.com/maps"), `maps_url is Maps: ${ser.maps_url}`);
assert(
  decodeURIComponent(ser.maps_url).includes("Volkhardtstraße") ||
    decodeURIComponent(ser.maps_url).includes("Zirndorf"),
  "maps query includes the Zirndorf street",
);
assert(decodeURIComponent(ser.maps_url).includes("Hotel Knorz"), "maps query includes venue name");

const dateHouse = db.prepare("SELECT * FROM venues WHERE name = ?").get("Date House Cafe");
const dh = serializeVenue(dateHouse);
assert(dh.maps_url.includes("google.com/maps"), "Date House also uses Google Maps");
assert(dh.maps_url.startsWith("https://www.google.com/maps/search/?api=1&query="), "Maps search API");

db.prepare("UPDATE venues SET location = ? WHERE name = ?").run("Nürnberg", "Hotel Knorz");
syncDemoVenueAddresses(db);
const fixed = db.prepare("SELECT location FROM venues WHERE name = ?").get("Hotel Knorz");
assert(fixed.location === expected, "backfill replaces city-only Nürnberg placeholder");

assert(
  mapsUrl("Hotel Knorz", expected) ===
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`Hotel Knorz ${expected}`)}`,
  "mapsUrl encodes name + street",
);

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("all ok");
