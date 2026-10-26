import test from "node:test";
import assert from "node:assert/strict";
import { unzipSync, strFromU8 } from "fflate";
import {
  applyEdits, describeEdit, edgePolarity, edgeValues, emptyEdits, evidenceReceipt, feedbackLoops, makeEdit, newRecordId,
  nodeValues, parseEdits, parseQuickLink, planQuickLinks, quickLinkEdits, readXlsx, recordEdit, setUndone, toKumuWorkbook
} from "../src/index.ts";
import { parseGraphDocument } from "../src/schema.ts";

const base = parseGraphDocument({ version: 1, title: "Base", nodes: [
  { id: "a", label: "Allendale Larder", type: "organisation", tags: ["food"], origin: { system: "csv", recordId: "r2", fileName: "orgs.csv", recordNumber: 2 } },
  { id: "b", label: "Moorfield Foundation", type: "funder", tags: [] }],
  edges: [{ id: "e1", source: "b", target: "a", type: "funds", origin: { system: "csv", recordId: "r3", fileName: "links.csv", recordNumber: 3 } }] });

test("changes sit beside the imported map, each with a receipt, and can be undone", () => {
  let layer = emptyEdits();
  const c = makeEdit({ kind: "add-node", node: { id: "you:1", label: "Village Hall", type: "place", tags: [] } }, "Tom", "Seen on site visit", "2026-10-26T19:00:00Z");
  layer = recordEdit(layer, c);
  const u = makeEdit({ kind: "update-node", id: "a", set: { label: "Allendale Larder CIO", postcode: "NE47 9QZ" }, was: nodeValues(base.nodes[0], ["label", "postcode"]) }, "Tom");
  layer = recordEdit(layer, u);
  const l = makeEdit({ kind: "add-edge", edge: { id: "you:2", source: "a", target: "you:1", type: "meets at", direction: "directed" } }, "Tom");
  layer = recordEdit(layer, l);
  const out = applyEdits(base, layer).graph;
  assert.equal(out.nodes.length, 3);
  const larder = out.nodes.find(n => n.id === "a")!;
  assert.equal(larder.label, "Allendale Larder CIO");
  assert.equal(larder.properties!.Postcode, "NE47 9QZ");
  assert.deepEqual(larder.receipts!.map(r => r.system), ["csv", "edit"], "the file's receipt is kept, the change adds its own");
  assert.equal(larder.receipts![1].fields!.by, "Tom");
  assert.deepEqual(u.op.kind === "update-node" && u.op.was, { label: "Allendale Larder", postcode: "" }, "what the file said is kept");
  assert.equal(out.nodes.find(n => n.id === "you:1")!.origin!.fields!.note, "Seen on site visit");
  assert.equal(evidenceReceipt(out.edges.find(e => e.id === "you:2")!), "Entered by Tom · " + l.at.slice(0, 10));
  assert.deepEqual(base.nodes[0].label, "Allendale Larder", "the imported map itself is never changed");
  // Undo, then redo.
  const undone = applyEdits(base, setUndone(layer, u.id, true)).graph;
  assert.equal(undone.nodes.find(n => n.id === "a")!.label, "Allendale Larder");
  assert.equal(applyEdits(base, setUndone(setUndone(layer, u.id, true), u.id, false)).graph.nodes.find(n => n.id === "a")!.label, "Allendale Larder CIO");
  // Survives a round trip through storage; junk is ignored.
  assert.deepEqual(parseEdits(JSON.parse(JSON.stringify(layer))), layer);
  assert.deepEqual(parseEdits({ nonsense: true }), emptyEdits());
  assert.equal(describeEdit(l, id => out.nodes.find(n => n.id === id)?.label ?? id), "Linked Allendale Larder CIO → Village Hall (meets at)");
});

test("removing a record takes its links; changes to records no longer present wait rather than vanish", () => {
  const layer = recordEdit(emptyEdits(), makeEdit({ kind: "remove-node", id: "b", label: "Moorfield Foundation" }, "Tom", "Closed in 2024"));
  const { graph, removed } = applyEdits(base, layer);
  assert.equal(graph.nodes.length, 1);
  assert.equal(graph.edges.length, 0);
  assert.equal(removed.get("b")!.note, "Closed in 2024");
  // A re-import that no longer has record "a": the change to it is kept as stale, not lost.
  const later = parseGraphDocument({ ...base, nodes: [base.nodes[1]], edges: [] });
  const change = recordEdit(emptyEdits(), makeEdit({ kind: "update-node", id: "a", set: { label: "X" }, was: { label: "Allendale Larder" } }, "Tom"));
  assert.equal(applyEdits(later, change).stale.length, 1);
});

test("links can be given a kind, direction and sign, and edited later", () => {
  const e = base.edges[0];
  const edit = makeEdit({ kind: "update-edge", id: "e1", set: { direction: "mutual", polarity: "-", type: "supports" },
    was: edgeValues(e, ["direction", "polarity", "type"]) }, "Tom");
  assert.deepEqual(edit.op.kind === "update-edge" && edit.op.was, { direction: "directed", polarity: "none", type: "funds" });
  const out = applyEdits(base, recordEdit(emptyEdits(), edit)).graph.edges[0];
  assert.equal(out.direction, "mutual");
  assert.equal(edgePolarity(out), "-");
  assert.equal(out.type, "supports");
  assert.equal(out.origin?.fileName, "links.csv", "an edited link keeps its source receipt");
  assert.match(String(out.properties!["Changed here"]), /^Tom · \d{4}-\d{2}-\d{2} · direction, polarity, type$/);
});

test("quick entry turns typed lines into records and links", () => {
  assert.deepEqual(parseQuickLink("Trust -> funds -> Youth Project"), { from: "Trust", to: "Youth Project", type: "funds", direction: "directed", polarity: null });
  assert.deepEqual(parseQuickLink("Volunteers + Meals served"), { from: "Volunteers", to: "Meals served", type: "increases", direction: "directed", polarity: "+" });
  assert.equal(parseQuickLink("Burnout − Volunteers")!.polarity, "-");
  assert.equal(parseQuickLink("A <-> partners <-> B")!.direction, "mutual");
  assert.equal(parseQuickLink("A -- B")!.direction, "undirected");
  assert.equal(parseQuickLink("Rain → decreases → Crop yield")!.polarity, "-", "a sign word is read as a sign");
  assert.equal(parseQuickLink("Just a note"), null);
  const { plans, notLinks } = planQuickLinks(["allendale larder + Meals served", "Meals served + Community trust", "notes"], base);
  assert.deepEqual(notLinks, ["notes"]);
  assert.equal(plans[0].fromId, "a", "names match records already in the map, case aside");
  assert.deepEqual(plans[0].newRecords, ["Meals served"]);
  const edits = quickLinkEdits(plans, "Tom", "outcome");
  assert.equal(edits.filter(e => e.op.kind === "add-node").length, 2, "'Meals served' is created once");
  const out = applyEdits(base, edits.reduce(recordEdit, emptyEdits())).graph;
  assert.equal(out.nodes.length, 4);
  assert.equal(out.edges.filter(e => edgePolarity(e) === "+").length, 2);
  // Typing a loop makes a loop.
  const loop = quickLinkEdits(planQuickLinks(["X + Y", "Y + Z", "Z − X"], base).plans, "Tom", "outcome");
  assert.equal(feedbackLoops(applyEdits(base, loop.reduce(recordEdit, emptyEdits())).graph).loops[0].kind, "balancing");
  assert.ok(newRecordId().startsWith("you:"));
});

test("exports a workbook Kumu can import, noting where each item came from", () => {
  const edits = quickLinkEdits(planQuickLinks(["Allendale Larder + Meals served"], base).plans, "Tom", "outcome");
  const graph = applyEdits(base, edits.reduce(recordEdit, emptyEdits())).graph;
  const book = toKumuWorkbook(graph);
  const [elements, connections] = readXlsx("export.xlsx", book);
  assert.deepEqual(elements.headings, ["ID", "Label", "Type", "Description", "Tags", "Region", "Postcode", "Source"]);
  assert.equal(elements.rows.length, 3);
  assert.equal(elements.rows.find(r => r[1] === "Meals served")![2], "Factor");
  assert.match(elements.rows.find(r => r[1] === "Meals served")![7], /^Entered in Mossline by Tom /);
  assert.equal(elements.rows.find(r => r[1] === "Allendale Larder")![7], "orgs.csv #2");
  assert.deepEqual(connections.rows.find(r => r[1] === "Meals served")!.slice(0, 5), ["Allendale Larder", "Meals served", "increases", "directed", "+"]);
  assert.ok(strFromU8(unzipSync(book)["xl/workbook.xml"]).includes('name="Connections"'));
});
