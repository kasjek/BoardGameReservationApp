/** Mask rude / abusive words in chat (EN + DE). Applied on send and on read. */

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const WORDS = [
  "motherfucker",
  "motherfuckers",
  "hurensoehne",
  "hurensöhne",
  "hurensohn",
  "arschloecher",
  "arschlöcher",
  "arschloch",
  "assholes",
  "asshole",
  "bastards",
  "bastard",
  "bitches",
  "bitch",
  "bullshit",
  "cockhead",
  "cocksucker",
  "cunts",
  "cunt",
  "dickhead",
  "faggots",
  "faggot",
  "fotzen",
  "fotze",
  "fuckers",
  "fucker",
  "fucking",
  "fucked",
  "fucks",
  "fuck",
  "kanaken",
  "kanake",
  "miststueck",
  "miststück",
  "niggers",
  "nigger",
  "retards",
  "retard",
  "scheisse",
  "scheiße",
  "scheiss",
  "scheiß",
  "schlampen",
  "schlampe",
  "schwuchteln",
  "schwuchtel",
  "shitty",
  "shits",
  "shit",
  "sluts",
  "slut",
  "twats",
  "twat",
  "wankers",
  "wanker",
  "whores",
  "whore",
  "wichser",
  "neger",
].sort((a, b) => b.length - a.length);

const PATTERN = new RegExp(
  `(?<![\\p{L}\\p{N}_])(${WORDS.map(escapeRe).join("|")})(?![\\p{L}\\p{N}_])`,
  "giu",
);

function censorText(text) {
  return String(text ?? "").replace(PATTERN, (match) => "*".repeat(match.length));
}

module.exports = { censorText, WORDS };
