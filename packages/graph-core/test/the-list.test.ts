import test from "node:test";
import assert from "node:assert/strict";
import { theListChangesToGraph } from "../src/sources/the-list";
import { recordedYear } from "../src/field-atlas";

const example = {
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", slug: "test-change",
  status: "confirmed", change_type: "Paused", date_of_change: "2026-10-04",
  description: "Applications have been paused.", additional_details: "Updated website.",
  url: "https://example.org/notice", context: "CONFIDENTIAL ADMIN NOTES",
  contact_email: "private@example.org", reviewed_by: "PRIVATE_USER_ID",
  funder_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  funder: { id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", name: "Example Trust",
    charity_number: "1234567", website: "https://example.org" },
  charitable_cause_areas: ["Poverty"], organisation_types_impacted: ["Small charities"],
  organisation_sizes_impacted: ["Under £100k"]
};

test("published changes become evidence-backed, dated relationships, not grants", () => {
  const { graph, count, skipped } = theListChangesToGraph([example]);
  assert.equal(count, 1); assert.equal(skipped, 0);
  assert.equal(graph.nodes.find(n => n.id.includes("funder:"))?.type, "funder");
  const change = graph.nodes.find(n => n.id.startsWith("the-list:change:"))!;
  assert.equal(change.type, "other");
  assert.equal(change.sourceUrl, "https://the-list.uk/changes/test-change");
  assert.deepEqual(change.tags, ["Paused", "Poverty"]);
  assert.equal(change.origin?.fields?.["Original evidence"], "https://example.org/notice");
  const recorded = graph.edges.find(e => e.type === "has a published change")!;
  assert.equal(recordedYear(recorded), 2026);
  assert.equal(recorded.source, "the-list:funder:" + example.funder_id);
  assert.equal(graph.edges.filter(e => e.type === "lists cause area").length, 1);
  assert.equal(graph.edges.some(e => /funded|awarded|collaborat/i.test(e.type)), false);
  assert.equal(JSON.stringify(graph).includes("CONFIDENTIAL"), false);
  assert.equal(JSON.stringify(graph).includes("private@example.org"), false);
  assert.equal(JSON.stringify(graph).includes("PRIVATE_USER_ID"), false);
});

test("unreviewed changes never enter the graph", () => {
  const { graph, skipped } = theListChangesToGraph([example, { ...example, id: "cccccccc-cccc-cccc-cccc-cccccccccccc", status: "pending" }]);
  assert.equal(skipped, 1);
  assert.equal(graph.nodes.filter(n => n.id.startsWith("the-list:change:")).length, 1);
});

test("unlinked funders are not joined by matching names", () => {
  const x = { ...example, funder: null, funder_id: null, funder_name: "Similar Name" };
  const y = { ...x, id: "dddddddd-dddd-dddd-dddd-dddddddddddd" };
  const { graph } = theListChangesToGraph([x, y]);
  assert.equal(graph.nodes.filter(n => n.type === "funder").length, 2);
});

test("invalid source URLs and missing dates cannot invent citations or years", () => {
  const { graph } = theListChangesToGraph([{ ...example, date_of_change: "not a date", submitted_at: "", url: "javascript:alert(1)" }]);
  const change = graph.nodes.find(n => n.id.startsWith("the-list:change:"))!;
  assert.equal(change.properties?.["Original evidence"], undefined);
  assert.equal(change.properties?.Date, undefined);
  assert.equal(recordedYear(graph.edges.find(e => e.type === "has a published change")!), null);
});

test("no public evidence means no atlas, rather than silently showing an empty success", () => {
  assert.throws(() => theListChangesToGraph([{ ...example, status: "pending" }]), /No approved or confirmed/);
});
