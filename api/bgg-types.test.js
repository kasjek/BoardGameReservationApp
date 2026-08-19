const { parseThingTypes } = require("./bgg");

const xml = `
<items><item type="boardgame" id="13">
  <name type="primary" value="Catan"/>
  <statistics><ratings><ranks>
    <rank type="subtype" id="1" name="boardgame" friendlyname="Board Game Rank" value="401"/>
    <rank type="family" id="5496" name="thematic" friendlyname="Thematic Rank" value="Not Ranked"/>
    <rank type="family" id="5497" name="strategygames" friendlyname="Strategy Game Rank" value="401"/>
    <rank type="family" name="familygames" type="family" value="44"/>
    <rank type="family" name="partygames" value="Not Ranked"/>
  </ranks></ratings></statistics>
</item></items>`;

const types = parseThingTypes(xml);
if (JSON.stringify(types) !== JSON.stringify(["strategy", "family"])) {
  console.error("unexpected types", types);
  process.exit(1);
}
console.log("ok  parseThingTypes Catan -> strategy, family");

const { parseGeekdoTypes, parseDynamicRankTypes } = require("./bgg");
const geekTypes = parseGeekdoTypes({
  links: {
    boardgamesubdomain: [{ name: "Party Games" }, { name: "Family Games" }],
  },
});
if (JSON.stringify(geekTypes) !== JSON.stringify(["party", "family"])) {
  console.error("unexpected geekdo types", geekTypes);
  process.exit(1);
}
console.log("ok  parseGeekdoTypes -> party, family");

const rankTypes = parseDynamicRankTypes({
  item: {
    rankinfo: [
      { prettyname: "Board Game Rank", subdomain: null },
      { prettyname: "Strategy Game Rank", subdomain: "strategygames" },
      { prettyname: "Family Game Rank", subdomain: "familygames" },
    ],
  },
});
if (JSON.stringify(rankTypes) !== JSON.stringify(["strategy", "family"])) {
  console.error("unexpected rank types", rankTypes);
  process.exit(1);
}
console.log("ok  parseDynamicRankTypes -> strategy, family");
