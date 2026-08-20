/** XP cosmetics layered on the existing DiceBear avatar. No paid service. */

const SLOTS = ["background", "hat", "glasses", "frame", "companion"];
const GAMES_PER_UNLOCK = 10;

/** Catalog order is unlock order: every 10 unique played titles grants the next item. */
const COSMETIC_CATALOG = [
  { id: "bg-lilac", slot: "background", xp_required: 10 },
  { id: "hat-party", slot: "hat", xp_required: 20 },
  { id: "glasses-round", slot: "glasses", xp_required: 30 },
  { id: "frame-gold", slot: "frame", xp_required: 40 },
  { id: "companion-meeple", slot: "companion", xp_required: 50 },
  { id: "bg-wood", slot: "background", xp_required: 60 },
  { id: "hat-wizard", slot: "hat", xp_required: 70 },
  { id: "glasses-star", slot: "glasses", xp_required: 80 },
  { id: "frame-dice", slot: "frame", xp_required: 90 },
  { id: "companion-cat", slot: "companion", xp_required: 100 },
];

function httpError(status, detail) {
  const err = new Error(detail);
  err.status = status;
  return err;
}

function emptyEquipped() {
  return { background: null, hat: null, glasses: null, frame: null, companion: null };
}

function itemById(id) {
  return COSMETIC_CATALOG.find((item) => item.id === id) || null;
}

function parseUnlocks(raw) {
  if (Array.isArray(raw)) {
    return raw.filter((id) => typeof id === "string" && itemById(id));
  }
  if (raw == null || raw === "") return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id) => typeof id === "string" && itemById(id));
  } catch {
    return [];
  }
}

function parseEquipped(raw) {
  const out = emptyEquipped();
  let obj = raw;
  if (typeof raw === "string" && raw) {
    try {
      obj = JSON.parse(raw);
    } catch {
      return out;
    }
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return out;
  for (const slot of SLOTS) {
    const value = obj[slot];
    if (typeof value === "string" && itemById(value)?.slot === slot) out[slot] = value;
  }
  return out;
}

function earnedUnlockIds(differentGames) {
  const n = Math.max(0, Math.floor((Number(differentGames) || 0) / GAMES_PER_UNLOCK));
  return COSMETIC_CATALOG.slice(0, n).map((item) => item.id);
}

function mergeUnlocks(existing, earned) {
  const set = new Set(existing);
  for (const id of earned) set.add(id);
  return COSMETIC_CATALOG.map((item) => item.id).filter((id) => set.has(id));
}

/** Persist newly earned unlocks. Never revokes items if unique-game count later drops. */
function syncUnlocks(database, user, differentGames) {
  const existing = parseUnlocks(user.avatar_unlocks);
  const merged = mergeUnlocks(existing, earnedUnlockIds(differentGames));
  const same = merged.length === existing.length && merged.every((id, i) => id === existing[i]);
  if (!same) {
    database
      .prepare("UPDATE users SET avatar_unlocks=? WHERE id=?")
      .run(JSON.stringify(merged), user.id);
    user.avatar_unlocks = JSON.stringify(merged);
  }
  return merged;
}

function setEquippedSlot(unlocks, equipped, slot, itemId) {
  if (!SLOTS.includes(slot)) throw httpError(400, "Unknown cosmetic slot.");
  const next = { ...equipped };
  if (itemId == null || itemId === "") {
    next[slot] = null;
    return next;
  }
  if (typeof itemId !== "string") throw httpError(400, "item_id must be a string or null.");
  const item = itemById(itemId);
  if (!item) throw httpError(400, "Unknown cosmetic item.");
  if (item.slot !== slot) throw httpError(400, "That item does not belong in this slot.");
  if (!unlocks.includes(itemId)) {
    throw httpError(403, "Play more different games to unlock this cosmetic.");
  }
  next[slot] = itemId;
  return next;
}

function progress(differentGames) {
  const games = Math.max(0, Number(differentGames) || 0);
  const maxXp = COSMETIC_CATALOG[COSMETIC_CATALOG.length - 1].xp_required;
  const nextAt =
    games >= maxXp ? null : (Math.floor(games / GAMES_PER_UNLOCK) + 1) * GAMES_PER_UNLOCK;
  return {
    different_games: games,
    xp: games,
    unlock_every: GAMES_PER_UNLOCK,
    next_unlock_at: nextAt,
    games_until_next: nextAt == null ? 0 : nextAt - games,
  };
}

function catalogPayload({ differentGames, unlocks, equipped }) {
  const unlocked = new Set(unlocks);
  const eq = parseEquipped(equipped);
  return {
    ...progress(differentGames),
    unlocks: [...unlocked],
    equipped: eq,
    items: COSMETIC_CATALOG.map((item) => ({
      id: item.id,
      slot: item.slot,
      xp_required: item.xp_required,
      unlocked: unlocked.has(item.id),
      equipped: eq[item.slot] === item.id,
    })),
  };
}

module.exports = {
  SLOTS,
  GAMES_PER_UNLOCK,
  COSMETIC_CATALOG,
  emptyEquipped,
  itemById,
  parseUnlocks,
  parseEquipped,
  earnedUnlockIds,
  mergeUnlocks,
  syncUnlocks,
  setEquippedSlot,
  catalogPayload,
};
