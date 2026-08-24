const fs = require("fs");
const path = require("path");

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads", "venues");
const MAX_BYTES = 2 * 1024 * 1024;
const MIME_TO_EXT = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const EXT_TO_MIME = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

function parseDataUrl(dataUrl) {
  const raw = String(dataUrl || "").trim();
  if (!raw) return { error: "Photo is required." };
  const m = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/);
  if (!m) {
    return { error: "Photo must be a JPEG, PNG, WebP, or GIF image." };
  }
  const mime = m[1].toLowerCase();
  const ext = MIME_TO_EXT[mime];
  if (!ext) {
    return { error: "Photo must be a JPEG, PNG, WebP, or GIF image." };
  }
  let buf;
  try {
    buf = Buffer.from(m[2].replace(/\s+/g, ""), "base64");
  } catch {
    return { error: "Photo could not be read." };
  }
  if (!buf.length) return { error: "Photo could not be read." };
  if (buf.length > MAX_BYTES) return { error: "Photo must be 2 MB or smaller." };
  return { mime, ext, buf };
}

function absPath(filename) {
  const base = path.resolve(UPLOAD_DIR);
  const abs = path.resolve(base, filename);
  if (abs !== base && !abs.startsWith(base + path.sep)) {
    throw new Error("Invalid photo path.");
  }
  return abs;
}

function savePhotoFile(venueId, parsed) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const filename = `${Number(venueId)}.${parsed.ext}`;
  fs.writeFileSync(absPath(filename), parsed.buf);
  return filename;
}

function deletePhotoFile(filename) {
  if (!filename) return;
  try {
    fs.unlinkSync(absPath(filename));
  } catch {
    /* already gone */
  }
}

function publicPhotoUrl(row) {
  const filename = row?.photo_path;
  if (!filename) return null;
  try {
    const file = absPath(filename);
    if (!fs.existsSync(file)) return null;
    const v = Math.floor(fs.statSync(file).mtimeMs);
    return `/api/venues/${row.id}/photo?v=${v}`;
  } catch {
    return null;
  }
}

function readPhotoFile(filename) {
  if (!filename) return null;
  const file = absPath(filename);
  if (!fs.existsSync(file)) return null;
  const ext = path.extname(filename).slice(1).toLowerCase();
  return {
    buf: fs.readFileSync(file),
    contentType: EXT_TO_MIME[ext] || "application/octet-stream",
  };
}

module.exports = {
  parseDataUrl,
  savePhotoFile,
  deletePhotoFile,
  publicPhotoUrl,
  readPhotoFile,
  MAX_BYTES,
};
