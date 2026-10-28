import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  applySources, defaultGrouping, fundingFlows, grantsAsLinks, groupRecords, groupingOptions, placeName, postcodeAreaName,
  readDelimited, recogniseTable, suggestTopics
} from "../src/index.ts";
import { parseGraphDocument } from "../src/schema.ts";

const SAMPLES = fileURLToPath(new URL("../../../apps/web/public/samples/", import.meta.url));
const grants = () => {
  const t = readDelimited("360giving-grants.csv", readFileSync(SAMPLES + "360giving-grants.csv", "utf8"));
  return applySources([{ table: t, shape: recogniseTable(t)[0].shape, use: "records" }], null).graph;
};

test("suggests readable topics from words, with the words that matched", () => {
  const t = suggestTopics("Weekly larder and a shared meal for families in the upper dale");
  assert.equal(t[0].topic, "Food");
  assert.deepEqual(t[0].words, ["meal", "larder"]);
  assert.ok(t.some(x => x.topic === "Children and families"));
  assert.equal(suggestTopics("Mental health support")[0].topic, "Mental health and wellbeing");
  assert.equal(suggestTopics("An article about parties").length, 0, "word starts only: 'art' is not found inside other words");
  assert.deepEqual(suggestTopics(""), []);
});

test("names a postcode's area from its letters, and a record's place from its own data", () => {
  assert.equal(postcodeAreaName("NE46 1AB"), "Newcastle upon Tyne (NE)");
  assert.equal(postcodeAreaName("M1 1AA"), "Manchester (M)");
  assert.equal(postcodeAreaName("nonsense"), "");
  const n = (properties: Record<string, unknown>, region?: string) => ({ id: "x", label: "X", type: "organisation" as const, tags: [], properties, ...(region ? { region } : {}) });
  assert.equal(placeName(n({ Postcode: "SR1 1AA" })), "Sunderland (SR)");
  assert.equal(placeName(n({ Postcode: "SR1 1AA", "Approximate location": { latitude: 54.9, longitude: -1.4, town: "Sunderland" } })), "Sunderland");
  assert.equal(placeName(n({ Postcode: "SR1 1AA" }, "North East")), "North East", "a recorded region wins");
});

test("groups grants and the organisations they reached, by programme, funder, place or topic", () => {
  const g = grants();
  const flows = fundingFlows(g);
  const programme = groupRecords(g, "programme", flows);
  assert.equal(programme.of.get("id:360G-MOORFIELD-0001"), "Rural Food");
  assert.equal(programme.of.get("id:GB-CHC-1990001"), "Rural Food", "an organisation takes the programme most of its grants came from");
  const funder = groupRecords(g, "funder", flows);
  assert.equal(funder.of.get("id:GB-CHC-1990003"), "Larkspur Community Trust");
  const topics = groupRecords(g, "topics", flows);
  assert.equal(topics.suggested, true);
  assert.equal(topics.of.get("id:360G-LARKSPUR-0001"), "Young people");
  assert.ok(topics.why.get("id:360G-LARKSPUR-0001")!.includes("youth"));
  assert.equal(topics.of.has("id:GB-CHC-1990101"), false, "funders span topics and are not put in one");
  const place = groupRecords(g, "place", flows);
  assert.equal(place.of.get("id:GB-CHC-1990001"), "Northumberland", "the sample's recorded region");
  const options = groupingOptions(g, flows);
  assert.deepEqual(options.map(o => o.kind).sort(), ["funder", "place", "programme", "tags", "topics"]);
  assert.equal(options.find(o => o.kind === "topics")!.suggested, true);
  assert.equal(defaultGrouping(options, g.nodes.length), "tags", "the file's own classifications come first");
  assert.equal(defaultGrouping(options.filter(o => o.kind !== "tags"), g.nodes.length), "programme", "source groupings come before suggestions");
  assert.equal(defaultGrouping(options.filter(o => o.kind !== "programme" && o.kind !== "tags"), g.nodes.length), "topics");
});

test("draws many grants as one recorded link per funder and recipient, keeping counts and money", () => {
  const g = grants();
  const view = grantsAsLinks(g);
  assert.equal(view.grants, 4);
  assert.equal(view.pairs, 3);
  assert.ok(!view.graph.nodes.some(n => n.properties?.mosslineFundingGrant), "grant records are not drawn");
  const larder = view.graph.edges.find(e => e.id === "grants:id:GB-CHC-1990101>id:GB-CHC-1990001")!;
  assert.equal(larder.type, "funded");
  assert.equal(larder.description, "2 grants");
  assert.equal(larder.properties!.amountAwarded, 18000);
  assert.equal(larder.origin?.fileName, "360giving-grants.csv", "the link keeps a receipt from its first grant");
  assert.deepEqual(view.grantEnds.get("id:360G-MOORFIELD-0003"), { funderId: "id:GB-CHC-1990101", recipientId: "id:GB-CHC-1990001" });
  // A grant with links of its own (to a project, say) stays drawn.
  const linked = parseGraphDocument({ ...g, edges: [...g.edges, { id: "x", source: "id:360G-MOORFIELD-0002", target: "id:GB-SC-SC099901", type: "reported to" }] });
  assert.ok(grantsAsLinks(linked).graph.nodes.some(n => n.id === "id:360G-MOORFIELD-0002"));
});
