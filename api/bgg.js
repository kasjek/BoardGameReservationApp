/**
 * Cover / thing helpers for the embedded Node API.
 * Uses BGG_API_TOKEN (Bearer) when set; falls back to Geekdo JSON + Wikipedia.
 */
const { ensureDb } = require("./db");

const BGG_THING = "https://boardgamegeek.com/xmlapi2/thing";
const BGG_SEARCH = "https://boardgamegeek.com/xmlapi2/search";
const GEEKDO_ITEM = "https://api.geekdo.com/api/geekitems";
const WIKI_SEARCH = "https://en.wikipedia.org/w/api.php";
const WIKI_SUMMARY = "https://en.wikipedia.org/api/rest_v1/page/summary/";
const UA = "TooManyGames/1.0 (GoDaddy Node; contact: local)";

function authHeaders() {
  const headers = { "User-Agent": UA, Accept: "*/*" };
  const token = process.env.BGG_API_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function httpGet(url, headers = authHeaders(), timeoutMs = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal, redirect: "follow" });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function stripYear(name) {
  return name.replace(/\s*\(\d{4}\)\s*/g, " ").trim().replace(/\s+/g, " ");
}

function normalize(name) {
  return stripYear(name).toLowerCase().replace(/^the\s+/, "").trim();
}

function absUrl(url) {
  if (!url) return null;
  if (url.startsWith("//")) return `https:${url}`;
  return url;
}

function parseThingThumbnail(xml) {
  const m = String(xml).match(/<thumbnail>([^<]+)<\/thumbnail>/i);
  return m ? absUrl(m[1].trim()) : null;
}

function parseThingName(xml) {
  const m = String(xml).match(/<name[^>]*type="primary"[^>]*value="([^"]+)"/i);
  return m ? m[1] : null;
}

function parsePlayTimes(xml) {
  const s = String(xml);
  const num = (re) => {
    const m = s.match(re);
    return m ? Number(m[1]) : null;
  };
  return {
    playing_time: num(/<playingtime[^>]*value="(\d+)"/i),
    min_play_time: num(/<minplaytime[^>]*value="(\d+)"/i),
    max_play_time: num(/<maxplaytime[^>]*value="(\d+)"/i),
    min_players: num(/<minplayers[^>]*value="(\d+)"/i),
    max_players: num(/<maxplayers[^>]*value="(\d+)"/i),
  };
}

function decodeXmlEntities(s) {
  return String(s)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function parseSearchResults(xml) {
  const out = [];
  const seen = new Set();
  const re = /<item[^>]*id="(\d+)"[^>]*>[\s\S]*?<\/item>/gi;
  let m;
  while ((m = re.exec(String(xml)))) {
    const id = Number(m[1]);
    if (!id || seen.has(id)) continue;
    const block = m[0];
    const nameM = block.match(/<name[^>]*type="primary"[^>]*value="([^"]+)"/i);
    const yearM = block.match(/<yearpublished[^>]*value="(\d+)"/i);
    if (!nameM) continue;
    seen.add(id);
    out.push({
      bgg_id: id,
      name: decodeXmlEntities(nameM[1]),
      year: yearM ? Number(yearM[1]) : null,
    });
  }
  return out;
}

/** Prefer exact title, then prefix matches, then the rest (BGG order). */
function rankSearchHits(hits, query) {
  const want = normalize(query);
  const score = (name) => {
    const n = normalize(name);
    if (n === want) return 0;
    if (n.startsWith(want)) return 1;
    if (n.includes(want)) return 2;
    return 3;
  };
  return hits
    .map((h, i) => ({ h, i, s: score(h.name) }))
    .sort((a, b) => a.s - b.s || a.i - b.i)
    .map((x) => x.h);
}

async function geekdoItem(bggId) {
  const body = await httpGet(
    `${GEEKDO_ITEM}?objectid=${bggId}&objecttype=thing`,
    { "User-Agent": UA, Accept: "application/json" },
  );
  if (!body) return null;
  try {
    const data = JSON.parse(body.toString("utf8"));
    const item = data.item || data;
    const images = item.images || {};
    const thumb =
      absUrl(images.thumb) ||
      absUrl(images.previewthumb) ||
      absUrl(item.imageurl) ||
      absUrl(item.thumbnail) ||
      "";
    return {
      bgg_id: bggId,
      name: item.name || item.primaryname || `Game ${bggId}`,
      thumbnail_url: thumb,
      playing_time: item.playingtime ? Number(item.playingtime) : null,
      min_play_time: item.minplaytime ? Number(item.minplaytime) : null,
      max_play_time: item.maxplaytime ? Number(item.maxplaytime) : null,
      min_players: item.minplayers ? Number(item.minplayers) : null,
      max_players: item.maxplayers ? Number(item.maxplayers) : null,
    };
  } catch {
    return null;
  }
}

async function bggThumbnail(bggId) {
  const xml = await httpGet(`${BGG_THING}?id=${bggId}`);
  if (xml) {
    const thumb = parseThingThumbnail(xml.toString("utf8"));
    if (thumb) return thumb;
  }
  const geek = await geekdoItem(bggId);
  return geek?.thumbnail_url || null;
}

async function wikipediaCover(name) {
  const q = `${stripYear(name)} board game`;
  const searchBody = await httpGet(
    `${WIKI_SEARCH}?action=query&list=search&srlimit=1&format=json&srsearch=${encodeURIComponent(q)}`,
    { "User-Agent": UA, Accept: "application/json" },
  );
  if (!searchBody) return null;
  try {
    const results = JSON.parse(searchBody.toString("utf8"))?.query?.search || [];
    const title = results[0]?.title;
    if (!title) return null;
    const sumBody = await httpGet(`${WIKI_SUMMARY}${encodeURIComponent(title)}`, {
      "User-Agent": UA,
      Accept: "application/json",
    });
    if (!sumBody) return null;
    const data = JSON.parse(sumBody.toString("utf8"));
    return data?.thumbnail?.source || data?.originalimage?.source || null;
  } catch {
    return null;
  }
}

function findVenueGame(name) {
  const db = ensureDb();
  const exact = db
    .prepare(
      `SELECT id, title, bgg_id, thumbnail_url FROM venue_games
       WHERE is_active=1 AND lower(title)=lower(?) LIMIT 1`,
    )
    .get(name);
  if (exact) return exact;
  return db
    .prepare(
      `SELECT id, title, bgg_id, thumbnail_url FROM venue_games
       WHERE is_active=1 AND title LIKE ? LIMIT 1`,
    )
    .get(`%${stripYear(name)}%`);
}

function cacheThumb(gameId, url) {
  if (!gameId || !url) return;
  ensureDb()
    .prepare(`UPDATE venue_games SET thumbnail_url=? WHERE id=?`)
    .run(url, gameId);
}

async function resolveCoverUrl(name) {
  const q = (name || "").trim();
  if (!q) return null;

  const game = findVenueGame(q);
  if (game?.thumbnail_url && /geekdo-images\.com|boardgamegeek\.com/i.test(game.thumbnail_url)) {
    return game.thumbnail_url;
  }
  if (game?.thumbnail_url) return game.thumbnail_url;

  // Prefer known bgg_id (no live search — searching on every cover request
  // overwhelms BGG and causes site-wide timeouts).
  const bggId = game?.bgg_id || null;
  let thumb = bggId ? await bggThumbnail(bggId) : null;
  if (!thumb) thumb = await wikipediaCover(q);

  if (thumb && game?.id) cacheThumb(game.id, thumb);
  return thumb;
}

async function resolveThing(bggId) {
  const db = ensureDb();
  const local = db.prepare(`SELECT * FROM venue_games WHERE bgg_id=? LIMIT 1`).get(bggId);
  const xml = await httpGet(`${BGG_THING}?id=${bggId}`);
  if (xml) {
    const s = xml.toString("utf8");
    const thumb = parseThingThumbnail(s) || local?.thumbnail_url || "";
    const times = parsePlayTimes(s);
    if (thumb && local?.id) cacheThumb(local.id, thumb);
    return {
      bgg_id: bggId,
      name: parseThingName(s) || local?.title || `Game ${bggId}`,
      thumbnail_url: thumb,
      ...times,
    };
  }
  const geek = await geekdoItem(bggId);
  if (geek) {
    if (geek.thumbnail_url && local?.id) cacheThumb(local.id, geek.thumbnail_url);
    return geek;
  }
  return {
    bgg_id: bggId,
    name: local?.title || `Game ${bggId}`,
    thumbnail_url: local?.thumbnail_url || "",
    playing_time: null,
    min_play_time: null,
    max_play_time: null,
    min_players: null,
    max_players: null,
  };
}

async function liveSearch(q, limit = 500) {
  const query = stripYear(q);
  const max = !limit || limit < 1 ? 1000 : Math.min(limit, 1000);
  if (process.env.BGG_API_TOKEN) {
    // Search XML can be large; allow more than the default 8s cover/thing timeout.
    const xml = await httpGet(
      `${BGG_SEARCH}?query=${encodeURIComponent(query)}&type=boardgame`,
      authHeaders(),
      20_000,
    );
    if (xml) {
      const hits = rankSearchHits(parseSearchResults(xml.toString("utf8")), query);
      if (hits.length) return hits.slice(0, max);
    }
  }
  const db = ensureDb();
  return rankSearchHits(
    db
      .prepare(
        `SELECT DISTINCT title AS name, bgg_id FROM venue_games
         WHERE is_active=1 AND bgg_id IS NOT NULL AND title LIKE ?
         ORDER BY title LIMIT ?`,
      )
      .all(`%${query}%`, max)
      .map((r) => ({ bgg_id: r.bgg_id, name: r.name, year: null })),
    query,
  );
}

module.exports = {
  resolveCoverUrl,
  resolveThing,
  liveSearch,
};
