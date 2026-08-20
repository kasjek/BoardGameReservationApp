/** BGG "Type" on a game page = ranked family (Strategy, Family, Party, ...). */
const BGG_FAMILY_TYPES = {
  strategygames: "strategy",
  familygames: "family",
  partygames: "party",
  thematic: "thematic",
  abstracts: "abstract",
  wargames: "war",
  cgs: "customizable",
  childrensgames: "childrens",
};

const GAME_TYPE_IDS = [
  "strategy",
  "family",
  "party",
  "thematic",
  "abstract",
  "war",
  "customizable",
  "childrens",
];

/** Ranked BGG family types for catalog titles so All Tables can filter offline. */
const KNOWN_GAME_TYPES = {
  13: ["strategy", "family"],
  129622: ["party"],
  163412: ["abstract", "family"],
  160477: ["abstract"],
  281259: ["strategy", "family"],
  299169: ["party"],
  283155: ["family", "abstract"],
  188834: ["party"],
};

const KNOWN_GAME_TYPES_BY_TITLE = {
  catan: ["strategy", "family"],
  "settlers of catan": ["strategy", "family"],
  "love letter": ["party"],
  patchwork: ["abstract", "family"],
  onitama: ["abstract"],
  "the isle of cats": ["strategy", "family"],
  "isle of cats": ["strategy", "family"],
  spicy: ["party"],
  calico: ["family", "abstract"],
  "secret hitler": ["party"],
  "ark nova": ["strategy"],
  "terraforming mars": ["strategy"],
  "brass: birmingham": ["strategy"],
  root: ["strategy", "thematic"],
  "spirit island": ["strategy", "thematic"],
  everdell: ["strategy", "family"],
  cascadia: ["family", "abstract"],
  codenames: ["party"],
  dixit: ["party", "family"],
  pandemic: ["family"],
  "the quacks of quedlinburg": ["family"],
  scout: ["party"],
  "the crew": ["family"],
  crew: ["family"],
  heat: ["family"],
  "forest shuffle": ["family"],
  "sky team": ["family"],
  harmonies: ["abstract", "family"],
  seti: ["strategy"],
  finspan: ["family", "strategy"],
  wyrmspan: ["strategy", "family"],
  wingspan: ["strategy", "family"],
  azul: ["abstract", "family"],
};

module.exports = {
  BGG_FAMILY_TYPES,
  GAME_TYPE_IDS,
  KNOWN_GAME_TYPES,
  KNOWN_GAME_TYPES_BY_TITLE,
};
