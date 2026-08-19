/** Venue location pictures stored under DATA_DIR/venue-pictures/. */

const fs = require("fs");
const path = require("path");

const MAX_PICTURE_BYTES = 2 * 1024 * 1024;
const DATA_URL = /^data:(image\/(?:jpeg|jpg|png|webp|gif));base64,(.+)$/i;
const EXT_BY_MIME = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};
const MIME_BY_EXT = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

function picturesDir() {
  const dataDir = process.env.DATA_DIR || path.join(__dirname, "..", "data");
  const dir = path.join(dataDir, "venue-pictures");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function pictureFile(id, ext) {
  if (!ext) return null;
  const safe = String(ext).toLowerCase();
  if (!MIME_BY_EXT[safe]) return null;
  return path.join(picturesDir(), `${Number(id)}${safe}`);
}

function pictureUrl(row) {
  if (!row || !row.picture_ext) return null;
  const file = pictureFile(row.id, row.picture_ext);
  if (!file || !fs.existsSync(file)) return null;
  return `/api/venues/${row.id}/picture`;
}

function contentTypeFor(ext) {
  return MIME_BY_EXT[String(ext || "").toLowerCase()] || "application/octet-stream";
}

function decodePictureData(data) {
  const raw = String(data || "").trim();
  if (!raw) {
    const err = new Error("Picture data is empty.");
    err.status = 400;
    throw err;
  }
  const match = DATA_URL.exec(raw);
  if (!match) {
    const err = new Error("Picture must be a PNG, JPEG, WebP, or GIF data URL.");
    err.status = 400;
    throw err;
  }
  const ext = EXT_BY_MIME[match[1].toLowerCase()];
  if (!ext) {
    const err = new Error("Unsupported image type.");
    err.status = 400;
    throw err;
  }
  let blob;
  try {
    blob = Buffer.from(match[2], "base64");
  } catch {
    const err = new Error("Picture data is not valid base64.");
    err.status = 400;
    throw err;
  }
  if (!blob.length) {
    const err = new Error("Picture data is empty.");
    err.status = 400;
    throw err;
  }
  if (blob.length > MAX_PICTURE_BYTES) {
    const err = new Error("Picture must be 2 MB or smaller.");
    err.status = 400;
    throw err;
  }
  return { blob, ext };
}

function savePicture(id, data) {
  const { blob, ext } = decodePictureData(data);
  const dir = picturesDir();
  const prefix = `${Number(id)}.`;
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith(prefix) || name === `${Number(id)}${ext}`) {
      fs.unlinkSync(path.join(dir, name));
    }
  }
  fs.writeFileSync(path.join(dir, `${Number(id)}${ext}`), blob);
  return ext;
}

function readPicture(id, ext) {
  const file = pictureFile(id, ext);
  if (!file || !fs.existsSync(file)) return null;
  return { buffer: fs.readFileSync(file), contentType: contentTypeFor(ext) };
}

module.exports = {
  MAX_PICTURE_BYTES,
  picturesDir,
  pictureUrl,
  savePicture,
  readPicture,
  contentTypeFor,
};
