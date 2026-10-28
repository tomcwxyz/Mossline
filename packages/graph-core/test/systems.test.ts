import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  applySources, connectionTypes, edgePolarity, feedbackLoops, findRecordedRoutes, loopLabels, readJson, readDelimited,
  readPolarity, recogniseTable
} from "../src/index.ts";
import { parseGraphDocument } from "../src/schema.ts";

const SAMPLES = fileURLToPath(new URL("../../../apps/web/public/samples/", import.meta.url));
function systemsMap() {
  const r = readJson("kumu-systems-map.json", readFileSync(SAMPLES + "kumu-systems-map.json", "utf8"));
  assert.equal(r.kind, "tables");
  if (r.kind !== "tables") throw new Error();
  return applySources(r.tables.map(table => ({ table, shape: recogniseTable(table)[0].shape, use: "records" as const })), null).graph;
}
const id = (g: ReturnType<typeof systemsMap>, label: string) => g.nodes.find(n => n.label === label)!.id;

test("reads a link's sign from source words, symbols or numbers", () => {
  for (const v of ["+", "positive", "Increases", "same", 1]) assert.equal(readPolarity(v), "+", String(v));
  for (const v of ["-", "−", "negative", "decreases", "opposite", -2]) assert.equal(readPolarity(v), "-", String(v));
  assert.equal(readPolarity("related to"), null);
  assert.equal(readPolarity(0), null);
  assert.equal(edgePolarity({ id: "a", source: "x", target: "y", type: "+" }), "+", "a type that is only a sign counts");
});

test("a Kumu systems map keeps direction, kind and sign on every link", () => {
  const g = systemsMap();
  assert.equal(g.nodes.length, 12);
  assert.ok(g.nodes.every(n => n.type === "outcome"), "factors are read as outcomes");
  const types = connectionTypes(g);
  assert.deepEqual(types.map(t => [t.type, t.count, t.directed, t.signed]),
    [["increases", 13, 13, 13], ["decreases", 4, 4, 4], ["related to", 1, 0, 0]]);
  const burnout = g.edges.find(e => e.source === id(g, "Staff and volunteer burnout"))!;
  assert.equal(burnout.direction, "directed");
  assert.equal(burnout.properties!.Polarity, "-");
});

test("finds feedback loops along directed links and names them reinforcing or balancing", () => {
  const g = systemsMap();
  const { loops, truncated } = feedbackLoops(g);
  assert.equal(truncated, false);
  assert.equal(loops.length, 4);
  const labels = loopLabels(loops);
  const named = loops.map(l => labels.get(l.id) + " " + l.nodeIds.map(n => g.nodes.find(x => x.id === n)!.label).join(" > "));
  assert.ok(named.includes("R1 Community trust > Volunteer capacity > Meals served"));
  assert.ok(named.some(n => n.startsWith("B") && n.includes("Staff and volunteer burnout")));
  assert.equal(loops.filter(l => l.kind === "reinforcing").length, 2);
  assert.equal(loops.filter(l => l.kind === "balancing").length, 2);
  // The undirected "related to" link never closes a loop.
  assert.ok(!loops.some(l => l.edgeIds.some(e => g.edges.find(x => x.id === e)!.type === "related to")));
  // A loop with an unsigned link is reported as unknown, never guessed.
  const unsigned = parseGraphDocument({ ...g, edges: g.edges.map(e => e.type === "decreases" ? { ...e, properties: {}, type: "affects" } : e) });
  assert.ok(feedbackLoops(unsigned).loops.some(l => l.kind === "unknown"));
  // Mutual links count both ways; a bound stops a dense map running away.
  const ring = parseGraphDocument({ version: 1, title: "t", nodes: ["a", "b"].map(x => ({ id: x, label: x, type: "other", tags: [] })),
    edges: [{ id: "m", source: "a", target: "b", type: "with", direction: "mutual" }] });
  assert.equal(feedbackLoops(ring).loops.length, 1);
  const dense = parseGraphDocument({ version: 1, title: "d", nodes: Array.from({ length: 9 }, (_, i) => ({ id: "n" + i, label: "n" + i, type: "other", tags: [] })),
    edges: Array.from({ length: 9 }, (_, i) => Array.from({ length: 9 }, (_, j) => i === j ? null : { id: i + ">" + j, source: "n" + i, target: "n" + j, type: "+" }))
      .flat().filter(Boolean) as never });
  const capped = feedbackLoops(dense, { max: 50 });
  assert.equal(capped.loops.length, 50);
  assert.equal(capped.truncated, true);
});

test("routes can follow arrows: cause to effect, never backwards", () => {
  const g = systemsMap();
  const grant = id(g, "Grant funding"), insecurity = id(g, "Household food insecurity");
  const forward = findRecordedRoutes(g, grant, insecurity, { followDirection: true, maxRoutes: 3 });
  assert.ok(forward.length >= 2);
  assert.ok(forward.every(t => t.steps.every(s => s.forward || s.direction !== "directed")));
  assert.equal(findRecordedRoutes(g, insecurity, grant, { followDirection: true }).length, 0, "nothing causes grant funding in this map");
  assert.ok(findRecordedRoutes(g, insecurity, grant).length > 0, "without arrows, any recorded link can be walked");
});

test("a links table with a sign column carries the sign", () => {
  const t = readDelimited("links.csv", "From,To,Type,Polarity,Direction\nRain,Floods,causes,+,directed\nTrees,Floods,reduce,-,directed");
  const shape = recogniseTable(t).find(m => !m.builtIn || m.shape.id === "kumu-connections")!.shape;
  const g = applySources([{ table: readDelimited("nodes.csv", "Label,Type\nRain,factor\nFloods,factor\nTrees,factor"), shape: recogniseTable(readDelimited("nodes.csv", "Label,Type\nRain,factor")).at(0)!.shape, use: "records" },
    { table: t, shape, use: "records" }], null).graph;
  assert.deepEqual(g.edges.map(e => edgePolarity(e)).sort(), ["+", "-"]);
});
