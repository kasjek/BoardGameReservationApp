#!/usr/bin/env node
/** Venue/admin BGG search lists catalog hits, not only local inventory. */
const fs = require("fs");
const path = require("path");
const os = require("os");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tmg-bgg-search-"));
process.env.DATA_DIR = dir;
process.env.SQLITE_PATH = path.join(dir, "app.sqlite3");
process.env.NODE_ENV = "development";
delete process.env.BGG_API_TOKEN;

const { ensureDb } = require("./db");
const { liveSearch } = require("./bgg");

ensureDb();

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  } else {
    console.log("ok ", msg);
  }
}

function xmlSearch(items) {
  const body = items
    .map(
      (it) =>
        `<item type="boardgame" id="${it.id}">` +
        `<name type="primary" value="${it.name}"/>` +
        (it.year ? `<yearpublished value="${it.year}"/>` : "") +
        `</item>`,
    )
    .join("");
  return `<items total="${items.length}">${body}</items>`;
}

function jsonResponse(payload) {
  return {
    ok: true,
    arrayBuffer: async () => Buffer.from(JSON.stringify(payload)),
  };
}

function xmlResponse(xml) {
  return {
    ok: true,
    arrayBuffer: async () => Buffer.from(xml),
  };
}

function notFound() {
  return { ok: false, arrayBuffer: async () => Buffer.from("") };
}

async function withFetch(impl, fn) {
  const orig = global.fetch;
  global.fetch = impl;
  try {
    await fn();
  } finally {
    global.fetch = orig;
  }
}

async function run() {
  await withFetch(async (url) => {
    const u = String(url);
    if (u.includes("xmlapi2/search") && u.includes("Catan")) {
      return xmlResponse(
        xmlSearch([
          { id: 13, name: "Catan", year: 1995 },
          { id: 27785, name: "Catan Card Game", year: 1996 },
          { id: 39463, name: "Catan Dice Game", year: 2007 },
        ]),
      );
    }
    return notFound();
  }, async () => {
    const hits = await liveSearch("Catan", 500);
    assert(hits.length === 3, `xml catalog without token returns all Catan hits, got ${hits.length}`);
    assert(hits[0].bgg_id === 13 && hits[0].name === "Catan", "exact Catan title ranks first");
    assert(
      hits.some((h) => h.bgg_id === 27785),
      "related BGG titles are selectable, not only local inventory",
    );
  });

  await withFetch(async (url) => {
    const u = String(url);
    if (u.includes("xmlapi2/search")) return notFound();
    if (u.includes("wbsearchentities")) {
      return jsonResponse({ search: [{ id: "Q17508" }] });
    }
    if (u.includes("wbgetentities")) {
      return jsonResponse({
        entities: {
          Q17508: {
            labels: { en: { value: "Terraforming Mars" } },
            claims: { P2339: [{ mainsnak: { datavalue: { value: "167791" } } }] },
          },
        },
      });
    }
    return notFound();
  }, async () => {
    const hits = await liveSearch("Terraforming Mars", 500);
    assert(hits.some((h) => h.bgg_id === 167791), "wikidata fallback exposes BGG id when XML is down");
    assert(hits[0].name === "Terraforming Mars", "wikidata title is selectable");
  });

  await withFetch(async (url) => {
    const u = String(url);
    if (u.includes("api.geekdo.com") && u.includes("266192")) {
      return jsonResponse({ item: { name: "Wingspan", primaryname: "Wingspan" } });
    }
    if (u.includes("api.geekdo.com") && u.includes("230784")) {
      return jsonResponse({ item: { name: "Das Petersen-Spiel", primaryname: "Das Petersen-Spiel" } });
    }
    return notFound();
  }, async () => {
    const fromId = await liveSearch("266192", 500);
    assert(fromId.length === 1 && fromId[0].bgg_id === 266192, "numeric BGG id resolves a single selectable game");
    const fromUrl = await liveSearch("https://boardgamegeek.com/boardgame/266192/wingspan", 500);
    assert(fromUrl[0].name === "Wingspan", "BGG URL resolves the catalog game");
    const fromSlug = await liveSearch(
      "https://boardgamegeek.com/boardgame/230784/architects-of-the-west-kingdom",
      500,
    );
    assert(
      fromSlug[0].bgg_id === 230784 && /architects of the west kingdom/i.test(fromSlug[0].name),
      `BGG URL slug is used as the selectable title (got ${fromSlug[0] && fromSlug[0].name})`,
    );
  });

  await withFetch(async (url) => {
    const u = String(url);
    if (u.includes("xmlapi2/search")) {
      const items = [];
      for (let i = 1; i <= 80; i += 1) items.push({ id: i, name: `Game ${i}` });
      return xmlResponse(xmlSearch(items));
    }
    return notFound();
  }, async () => {
    const hits = await liveSearch("Game", 500);
    assert(hits.length === 80, `search returns the full BGG page, not a 30/50 cap (got ${hits.length})`);
  });

  if (failed) {
    console.error(`${failed} failure(s)`);
    process.exit(1);
  }
  console.log("all passed");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
