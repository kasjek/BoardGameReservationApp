/**
 * BoardGameGeek board-game categories from
 * https://boardgamegeek.com/browse/boardgamecategory
 *
 * Names and ids match Geekdo `objecttype=property` / `subtype=boardgamecategory`.
 */
const MAX_FAVORITE_CATEGORIES = 3;

const BGG_CATEGORIES = [
  { id: 1009, name: "Abstract Strategy" },
  { id: 1032, name: "Action / Dexterity" },
  { id: 1022, name: "Adventure" },
  { id: 2726, name: "Age of Reason" },
  { id: 1048, name: "American Civil War" },
  { id: 1108, name: "American Indian Wars" },
  { id: 1075, name: "American Revolutionary War" },
  { id: 1055, name: "American West" },
  { id: 1050, name: "Ancient" },
  { id: 1089, name: "Animals" },
  { id: 1052, name: "Arabian" },
  { id: 2650, name: "Aviation / Flight" },
  { id: 1023, name: "Bluffing" },
  { id: 1117, name: "Book" },
  { id: 1002, name: "Card Game" },
  { id: 1041, name: "Children's Game" },
  { id: 1029, name: "City Building" },
  { id: 1102, name: "Civil War" },
  { id: 1015, name: "Civilization" },
  { id: 1044, name: "Collectible Components" },
  { id: 1116, name: "Comic Book / Strip" },
  { id: 1039, name: "Deduction" },
  { id: 1017, name: "Dice" },
  { id: 1021, name: "Economic" },
  { id: 1094, name: "Educational" },
  { id: 1072, name: "Electronic" },
  { id: 1084, name: "Environmental" },
  { id: 1042, name: "Expansion for Base-game" },
  { id: 1020, name: "Exploration" },
  { id: 2687, name: "Fan Expansion" },
  { id: 1010, name: "Fantasy" },
  { id: 1013, name: "Farming" },
  { id: 1046, name: "Fighting" },
  { id: 1119, name: "Game System" },
  { id: 1024, name: "Horror" },
  { id: 1079, name: "Humor" },
  { id: 1088, name: "Industry / Manufacturing" },
  { id: 1091, name: "Korean War" },
  { id: 1033, name: "Mafia" },
  { id: 1104, name: "Math" },
  { id: 1118, name: "Mature / Adult" },
  { id: 1059, name: "Maze" },
  { id: 2145, name: "Medical" },
  { id: 1035, name: "Medieval" },
  { id: 1045, name: "Memory" },
  { id: 1047, name: "Miniatures" },
  { id: 1069, name: "Modern Warfare" },
  { id: 1064, name: "Movies / TV / Radio theme" },
  { id: 1040, name: "Murder / Mystery" },
  { id: 1054, name: "Music" },
  { id: 1082, name: "Mythology" },
  { id: 1051, name: "Napoleonic" },
  { id: 1008, name: "Nautical" },
  { id: 1026, name: "Negotiation" },
  { id: 1093, name: "Novel-based" },
  { id: 1098, name: "Number" },
  { id: 1030, name: "Party Game" },
  { id: 2725, name: "Pike and Shot" },
  { id: 1090, name: "Pirates" },
  { id: 1001, name: "Political" },
  { id: 2710, name: "Post-Napoleonic" },
  { id: 1036, name: "Prehistoric" },
  { id: 1120, name: "Print & Play" },
  { id: 1028, name: "Puzzle" },
  { id: 1031, name: "Racing" },
  { id: 1037, name: "Real-time" },
  { id: 1115, name: "Religious" },
  { id: 1070, name: "Renaissance" },
  { id: 1016, name: "Science Fiction" },
  { id: 1113, name: "Space Exploration" },
  { id: 1081, name: "Spies / Secret Agents" },
  { id: 1038, name: "Sports" },
  { id: 1086, name: "Territory Building" },
  { id: 1034, name: "Trains" },
  { id: 1011, name: "Transportation" },
  { id: 1097, name: "Travel" },
  { id: 1027, name: "Trivia" },
  { id: 1101, name: "Video Game Theme" },
  { id: 1109, name: "Vietnam War" },
  { id: 1019, name: "Wargame" },
  { id: 1025, name: "Word Game" },
  { id: 1065, name: "World War I" },
  { id: 1049, name: "World War II" },
  { id: 2481, name: "Zombies" },
];

const BY_ID = new Map(BGG_CATEGORIES.map((c) => [c.id, c]));

function categoryUrl(id) {
  return `https://boardgamegeek.com/boardgamecategory/${id}`;
}

function hydrateCategories(ids) {
  const out = [];
  for (const id of ids || []) {
    const cat = BY_ID.get(Number(id));
    if (cat) out.push({ id: cat.id, name: cat.name, url: categoryUrl(cat.id) });
  }
  return out;
}

function listCategories() {
  return BGG_CATEGORIES.map((c) => ({ id: c.id, name: c.name, url: categoryUrl(c.id) }));
}

function parseStoredCategoryIds(raw) {
  if (raw == null || raw === "") return [];
  if (Array.isArray(raw)) return parseCategoryIds(raw).ids;
  try {
    return parseCategoryIds(JSON.parse(raw)).ids;
  } catch {
    return [];
  }
}

/** @returns {{ ids: number[], error?: string }} */
function parseCategoryIds(raw) {
  if (raw == null) return { ids: [] };
  if (!Array.isArray(raw)) return { ids: [], error: "category_ids must be an array." };
  const ids = [];
  const seen = new Set();
  for (const value of raw) {
    const id = Number(value);
    if (!Number.isInteger(id) || id < 1) {
      return { ids: [], error: "Each category id must be a positive integer." };
    }
    if (!BY_ID.has(id)) {
      return { ids: [], error: "Unknown BoardGameGeek category." };
    }
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  if (ids.length > MAX_FAVORITE_CATEGORIES) {
    return { ids: [], error: `Pick at most ${MAX_FAVORITE_CATEGORIES} categories.` };
  }
  return { ids };
}

module.exports = {
  MAX_FAVORITE_CATEGORIES,
  BGG_CATEGORIES,
  hydrateCategories,
  listCategories,
  parseStoredCategoryIds,
  parseCategoryIds,
};
