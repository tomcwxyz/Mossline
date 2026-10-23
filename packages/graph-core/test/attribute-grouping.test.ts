import { strict as assert } from "node:assert";
import { test } from "node:test";
import { availableGroupingFields, groupByAttribute } from "../src/attribute-grouping";
import type { GraphDocument } from "../src/schema";

const graph: GraphDocument = {
  version: 1, title: "Fixture", description: "",
  edges: [{ id: "e1", source: "a", target: "b", type: "shared-trustee" }],
  nodes: [
    { id: "a", label: "A", type: "organisation", region: "North East", tags: ["Health", "Community"],
      properties: { income_band: "Small", causes: ["Children", "Health"] } },
    { id: "b", label: "B", type: "organisation", region: "north east", tags: ["Health"],
      properties: { income_band: "Large", causes: ["Health"] } },
    { id: "c", label: "C", type: "organisation", tags: [], properties: { income_band: "Small" } }
  ]
};
test("discovers arbitrary imported fields", () => {
  assert(availableGroupingFields(graph).includes("properties.income_band"));
});
test("groups case-insensitively without creating edges", () => {
  const before = JSON.stringify(graph);
  const result = groupByAttribute(graph, "region");
  assert.equal(result.groups.length, 1);
  assert.equal(result.groups[0].count, 2);
  assert.equal(result.unclassifiedCount, 1);
  assert.equal(JSON.stringify(graph), before);
});
test("supports overlapping multi-value groupings", () => {
  const result = groupByAttribute(graph, "properties.causes");
  assert.equal(result.overlapping, true);
  assert.equal(result.groups.find(g => g.key === "health")?.count, 2);
  assert.equal(result.unclassifiedCount, 1);
});
test("does not treat absent properties as category labels", () => {
  const result = groupByAttribute(graph, "properties.income_band");
  assert.equal(result.groups.find(g => g.key === "small")?.count, 2);
});
