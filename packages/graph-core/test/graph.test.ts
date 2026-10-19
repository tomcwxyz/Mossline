import test from "node:test";
import assert from "node:assert/strict";
import { collaborationGraph, filterGraph, parseGraphDocument, shortestPath, neighbours } from "../src/index.ts";

const map = parseGraphDocument({ version: 1, title: "Test", description: "", nodes: [
  { id: "a", label: "Alpha", type: "organisation" },
  { id: "b", label: "Beta", type: "organisation" },
  { id: "p", label: "Project", type: "project" }
], edges: [
  { id: "e1", source: "a", target: "p", type: "delivers" },
  { id: "e2", source: "b", target: "p", type: "delivers" }
] });

test("rejects dangling relationships", () => assert.throws(() => parseGraphDocument({ ...map, edges: [{ id: "missing", source: "a", target: "not-a-node", type: "funds" }] })));
test("finds neighbours and undirected shortest paths", () => {
  assert.deepEqual(neighbours(map, "p").map(n => n.id), ["a", "b"]);
  assert.deepEqual(shortestPath(map, "a", "b"), ["a", "p", "b"]);
  assert.equal(shortestPath(map, "a", "none"), null);
});
test("category filter can retain connective context", () => {
  const result = filterGraph(map, { types: ["organisation"], includeNeighbours: true });
  assert.equal(result.graph.nodes.length, 3);
  assert.deepEqual(result.contextNodeIds, ["p"]);
  assert.equal(result.graph.edges.length, 2);
});
test("strict type filter keeps only matching entities", () => {
  const result = filterGraph(map, { types: ["organisation"], includeNeighbours: false });
  assert.equal(result.graph.nodes.length, 2);
  assert.equal(result.graph.edges.length, 0);
});
test("shared projects are labelled inferred, not actual partnerships", () => {
  const result = collaborationGraph(map);
  assert.equal(result.nodes.length, 2);
  assert.equal(result.edges.length, 1);
  assert.equal(result.edges[0].inferred, true);
  assert.match(result.edges[0].description ?? "", /not a confirmed collaboration/i);
});
test("relationship basis limits inferred links without removing organisations", () => {
  const withFunder = parseGraphDocument({ ...map,
    nodes: [...map.nodes, { id: "f", label: "Shared funder", type: "funder" }],
    edges: [...map.edges, { id: "e3", source: "a", target: "f", type: "funded by" },
      { id: "e4", source: "b", target: "f", type: "funded by" }]
  });
  assert.deepEqual(collaborationGraph(withFunder, "project").edges[0].evidenceNodeIds, ["p"]);
  assert.deepEqual(collaborationGraph(withFunder, "funder").edges[0].evidenceNodeIds, ["f"]);
  assert.equal(collaborationGraph(withFunder, "recorded").edges.length, 0);
  assert.equal(collaborationGraph(withFunder, "recorded").nodes.length, 2);
  assert.deepEqual(collaborationGraph(withFunder, "all").edges[0].evidenceNodeIds, ["f", "p"]);
});
test("rejects invalid evidence reference", () =>
  assert.throws(() => parseGraphDocument({ ...map, edges: [{ ...map.edges[0], evidenceNodeIds: ["missing"] }] })));
