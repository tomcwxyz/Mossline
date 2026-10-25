import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { zipSync, strToU8 } from "fflate";
import {
  applySources, mergeRecords, readDelimited, readJson, readXlsx, recogniseTable, suggestShape, detectDelimiter,
  charityOrgId, companyOrgId, cleanOrgId, titleCaseName, extractPostcode, lookupPostcode, placeByPostcode,
  placedCoordinates, summarisePlaces, APPROXIMATE_KEY, type PlannedTable, type PostcodeCentroids, type SourceTable, type UseMode
} from "../src/index.ts";
import { fundingFlows } from "../src/field-atlas.ts";
import { parseGraphDocument } from "../src/schema.ts";

/* The sample files are invented; see data/generators/source-samples.mjs. */
const SAMPLES = fileURLToPath(new URL("../../../apps/web/public/samples/", import.meta.url));
function readSample(name: string): SourceTable[] {
  if (name.endsWith(".xlsx")) return readXlsx(name, new Uint8Array(readFileSync(SAMPLES + name)));
  const text = readFileSync(SAMPLES + name, "utf8");
  if (name.endsWith(".json")) { const r = readJson(name, text); assert.equal(r.kind, "tables"); return r.kind === "tables" ? r.tables : []; }
  return [readDelimited(name, text)];
}
const plan = (tables: SourceTable[], use: UseMode = "records"): PlannedTable[] =>
  tables.map(table => ({ table, shape: recogniseTable(table)[0].shape, use }));
const all = () => readdirSync(SAMPLES).sort().flatMap(readSample);
const centroids: PostcodeCentroids = { kind: "mossline-postcode-centroids", version: 1, generated: "2026-05-25", attribution: [],
  sectors: { "NE47 9": [54.89, -2.25], "NE46 1": [54.963, -2.092] }, districts: { NE45: [54.97, -2.0] } };

test("reads delimited text leniently and picks the delimiter", () => {
  assert.equal(detectDelimiter("a\tb\tc"), "\t");
  assert.equal(detectDelimiter("a;b;c"), ";");
  assert.equal(detectDelimiter('"a,b";c;d'), ";");
  const t = readDelimited("x.csv", '﻿Name,Notes,Name\r\n"Quoted, with comma",He said "hi",Second\r\nPlain,"Esc ""q""",\r\n\r\n');
  assert.deepEqual(t.headings, ["Name", "Notes", "Name (2)"]);
  assert.deepEqual(t.rows, [["Quoted, with comma", 'He said "hi"', "Second"], ["Plain", 'Esc "q"', ""]]);
  assert.equal(t.format, "csv");
  const tsv = readDelimited("y.txt", "a\tb\nx \"y\tz");
  assert.equal(tsv.format, "tsv");
  assert.deepEqual(tsv.rows[0], ['x "y', "z"]);
});

test("flattens JSON arrays into tables and reads Excel sheets", () => {
  const [grants] = readSample("360giving-grants.json");
  assert.equal(grants.name, "360giving-grants.json · grants");
  assert.ok(grants.headings.includes("recipientOrganization.0.name"));
  assert.equal(grants.rows[0][grants.headings.indexOf("amountAwarded")], "7500");
  const kumu = readSample("kumu-map.json");
  assert.deepEqual(kumu.map(t => t.name), ["kumu-map.json · elements", "kumu-map.json · connections"]);
  const elements = kumu[0];
  assert.equal(elements.rows[1][elements.headings.indexOf("attributes.tags")], "food | network");
  const sheets = readSample("kumu-map.xlsx");
  assert.deepEqual(sheets.map(s => s.name), ["kumu-map.xlsx · Elements", "kumu-map.xlsx · Connections"]);
  assert.deepEqual(sheets[0].headings, ["Label", "Type", "Description", "Tags", "Postcode"]);
  assert.equal(sheets[0].rows[0][0], "Hexmoor Youth Project");
  assert.equal(sheets[0].firstRecordNumber, 2);
  // Inline strings and gaps between cells, as other spreadsheet tools write them.
  const xml = '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Name</t></is></c><c r="C1" t="inlineStr"><is><t>Place &amp; area</t></is></c></row>' +
    '<row r="2"><c r="A2" t="inlineStr"><is><t>Fell Garden</t></is></c><c r="C2"><v>3</v></c></row></sheetData></worksheet>';
  const book = zipSync({ "xl/workbook.xml": strToU8('<workbook><sheets><sheet name="List" sheetId="1" r:id="rId1"/></sheets></workbook>'),
    "xl/_rels/workbook.xml.rels": strToU8('<Relationships><Relationship Id="rId1" Target="/xl/worksheets/sheet1.xml"/></Relationships>'),
    "xl/worksheets/sheet1.xml": strToU8(xml) });
  const [list] = readXlsx("list.xlsx", book);
  assert.deepEqual(list.headings, ["Name", "Column 2", "Place & area"]);
  assert.deepEqual(list.rows, [["Fell Garden", "", "3"]]);
});

test("normalises organisation identifiers to org-id form", () => {
  assert.equal(charityOrgId("1990001"), "GB-CHC-1990001");
  assert.equal(charityOrgId("SC099901"), "GB-SC-SC099901");
  assert.equal(charityOrgId("NIC100001"), "GB-NIC-100001");
  assert.equal(charityOrgId("0"), null);
  assert.equal(companyOrgId("990001"), "GB-COH-00990001");
  assert.equal(companyOrgId("SC12345"), "GB-COH-SC012345");
  assert.equal(cleanOrgId("gb-coh-99000002"), "GB-COH-99000002");
  assert.equal(cleanOrgId("GB-CHC-01990001"), null, "a zero-padded charity number is not a valid England and Wales number");
  assert.equal(cleanOrgId("XI-EXAMPLE-12"), "XI-EXAMPLE-12");
  assert.equal(cleanOrgId("Moorfield"), null);
});

test("recognises each source by its headings, with a suggestion as the fallback", () => {
  const names = Object.fromEntries(all().map(t => [t.name, recogniseTable(t)[0]]));
  assert.equal(names["360giving-grants.csv"].shape.id, "360giving-grants");
  assert.equal(names["360giving-grants.json · grants"].shape.id, "360giving-grants");
  assert.equal(names["publicextract.charity.txt"].shape.id, "charity-commission-charity");
  assert.equal(names["publicextract.charity_trustee.txt"].shape.id, "charity-commission-trustees");
  assert.equal(names["publicextract.charity_classification.txt"].shape.id, "charity-commission-classification");
  assert.equal(names["companies-house.csv"].shape.id, "companies-house");
  assert.equal(names["kumu-map.json · elements"].shape.id, "kumu-elements");
  assert.equal(names["kumu-map.xlsx · Connections"].shape.id, "kumu-connections");
  const odd = readDelimited("partners.csv", "Organisation Name,Charity No,Postcode,Themes\nFell Garden,1990005,NE47 9ZZ,food; growing");
  const [only] = recogniseTable(odd);
  assert.equal(only.builtIn, false);
  assert.equal(only.shape.records[0].label, "{Organisation Name}");
  assert.deepEqual(only.shape.records[0].identifiers, [{ value: "{Charity No}", scheme: "charity" }]);
});

test("suggests shapes for grants, links and rows naming several records", () => {
  const grants = suggestShape(readDelimited("g.csv", "Funder,Recipient,Recipient Charity Number,Amount,Date\nA Trust,B Group,1990005,500,2025-01-01"))!;
  assert.equal(grants.name, "Grants (funder to recipient)");
  assert.equal(grants.records.find(r => r.key === "recipient")!.identifiers![0].scheme, "charity");
  const res = applySources([{ table: readDelimited("g.csv", "Funder,Recipient,Recipient Charity Number,Amount,Date\nA Trust,B Group,1990005,500,2025-01-01"), shape: grants, use: "records" }], null);
  assert.equal(fundingFlows(res.graph).length, 1);
  assert.ok(res.graph.nodes.some(n => n.id === "id:GB-CHC-1990005"));
  const links = suggestShape(readDelimited("l.csv", "Source,Target,Relationship\nA,B,partner"))!;
  assert.equal(links.name, "Links between named records");
  const several = suggestShape(readDelimited("p.csv", "Project,Organisation,Funder\nFood hubs,Town Larder,Moorfield Foundation"))!;
  assert.equal(several.records.length, 3);
  const r = applySources([{ table: readDelimited("p.csv", "Project,Organisation,Funder\nFood hubs,Town Larder,Moorfield Foundation"), shape: several, use: "records" }], null);
  assert.deepEqual(r.graph.nodes.map(n => n.type).sort(), ["funder", "organisation", "project"]);
  assert.deepEqual(r.graph.edges.map(e => e.type).sort(), ["delivers", "funded by"]);
});

test("joins 360Giving, Charity Commission and Companies House rows on identifiers, never names", () => {
  const res = applySources(plan(all()), null);
  const g = res.graph;
  const larder = g.nodes.find(n => n.id === "id:GB-CHC-1990001")!;
  assert.equal(larder.label, "Allendale Larder", "the capitalised register name gives way to the same name written normally");
  assert.deepEqual(larder.identifiers, ["GB-CHC-1990001", "GB-COH-99000001"]);
  assert.deepEqual(new Set(larder.receipts!.map(r => r.fileName)),
    new Set(["360giving-grants.csv", "publicextract.charity.txt", "companies-house.csv", "publicextract.charity_classification.txt"]));
  assert.ok(larder.tags.includes("The prevention or relief of poverty"), "register Title Case becomes sentence case");
  assert.ok(larder.tags.includes("Children/young people"));
  assert.ok(!larder.tags.some(t => /provides services/i.test(t)), "'How' classifications are skipped");
  const grantRow = g.nodes.find(n => n.id === "id:360G-MOORFIELD-0001")!;
  assert.equal(placeByPostcode(g, centroids).graph.nodes.find(n => n.id === grantRow.id)!.properties![APPROXIMATE_KEY], undefined,
    "a grant is not placed at its recipient's postcode");
  assert.equal(larder.properties!.Postcode, "NE47 9QZ");
  assert.equal(larder.properties!["Latest income"], "48210");
  // Kumu's "Allendale Larder" has no identifier, so it stays separate and is listed for a person to decide.
  assert.ok(g.nodes.some(n => n.id === "src:kumu-elements:elem-larder"));
  assert.ok(res.sameName.some(c => c.a === "id:GB-CHC-1990001" && c.b === "src:kumu-elements:elem-larder"));
  assert.ok(res.sameName.some(c => c.label === "Moorfield Foundation"), "a trustee organisation with the same name as a funder is listed");
  assert.ok(!res.sameName.some(c => g.nodes.find(n => n.id === c.a)?.type === "person"));
  // Title case for register names, original kept in the source fields.
  const sprocket = g.nodes.find(n => n.id === "id:GB-COH-99000077")!;
  assert.equal(sprocket.label, "Northern Sprocket Ltd");
  assert.equal(sprocket.properties!.CompanyName, "NORTHERN SPROCKET LTD");
  assert.deepEqual(sprocket.tags, ["Manufacture of other parts and accessories for motor vehicles"]);
  // Skips are counted with their reason.
  const report = (name: string) => res.tables.find(t => t.table === name)!;
  assert.deepEqual(report("360giving-grants.csv").skipped, [{ reason: "Grants to individuals are left out", count: 1 }]);
  assert.equal(report("publicextract.charity.txt").skipped[0].count, 1);
  assert.ok(!g.nodes.some(n => /minibus/i.test(n.label)), "linked charities are not added as separate records");
  assert.ok(res.joins.some(j => j.text === "360giving-grants.csv ↔ companies-house.csv" && j.count === 2));
});

test("grants become funder → grant → recipient in the form the Funding lens reads", () => {
  const res = applySources(plan(readSample("360giving-grants.csv").concat(readSample("360giving-grants.json"))), null);
  const flows = fundingFlows(res.graph);
  assert.equal(flows.length, 5, "four grants to organisations in the CSV, one in the JSON");
  const grant = res.graph.nodes.find(n => n.id === "id:360G-MOORFIELD-0001")!;
  assert.equal(grant.properties!.mosslineFundingGrant, true);
  assert.equal(grant.properties!.amountAwarded, 12000);
  assert.equal(grant.properties!.funderId, "id:GB-CHC-1990101");
  assert.equal(grant.properties!.recipientId, "id:GB-CHC-1990001");
  const awarded = res.graph.edges.find(e => e.id === "grant:id:360G-MOORFIELD-0001:awarded")!;
  assert.equal(awarded.origin?.fileName, "360giving-grants.csv");
  assert.equal(awarded.origin?.recordNumber, 2);
  assert.equal(res.graph.nodes.find(n => n.id === "id:GB-SC-SC099901")!.receipts!.length, 2, "the same funder in CSV and JSON is one record");
});

test("Kumu links resolve by element ID or by name within the same file", () => {
  const res = applySources(plan(all()), null);
  const json = res.tables.find(t => t.table === "kumu-map.json · connections")!;
  const xlsx = res.tables.find(t => t.table === "kumu-map.xlsx · Connections")!;
  assert.equal(json.links, 2); assert.equal(json.unresolvedLinks, 0);
  assert.equal(xlsx.links, 2); assert.equal(xlsx.unresolvedLinks, 0);
  const partner = res.graph.edges.find(e => e.type === "partner")!;
  assert.equal(partner.direction, "mutual");
  assert.equal(partner.source, "src:kumu-elements:organisation:hexmoor youth project");
  const trustee = res.graph.edges.filter(e => e.type === "trustee of");
  assert.equal(trustee.length, 4);
  assert.ok(trustee.every(e => e.properties?.["Start Date"]));
});

test("'fill in' keeps only rows about records already in the map", () => {
  const base = applySources(plan(readSample("360giving-grants.csv")), null).graph;
  const before = base.nodes.length;
  const res = applySources(plan([...readSample("companies-house.csv"), ...readSample("publicextract.charity.txt"),
    ...readSample("publicextract.charity_trustee.txt"), ...readSample("publicextract.charity_classification.txt")], "fill"), base);
  const ch = res.tables.find(t => t.table === "companies-house.csv")!;
  assert.equal(ch.used, 2);
  assert.deepEqual(ch.skipped, [{ reason: "Not about a record you already have", count: 1 }]);
  assert.ok(!res.graph.nodes.some(n => n.label === "Distant Dales Trust"));
  assert.ok(!res.graph.nodes.some(n => n.label === "Robin Ashby"), "trustees of charities outside the map are left out");
  assert.equal(res.graph.nodes.length, before + 3, "three trustees of charities in the map are added");
  assert.equal(res.totals.filledIn, 3);
  const larder = res.graph.nodes.find(n => n.id === "id:GB-CHC-1990001")!;
  assert.equal(larder.properties!.Title, undefined);
  assert.equal(larder.properties!["Charity status"], "Registered");
  assert.ok(larder.receipts!.some(r => r.fileName === "companies-house.csv" && r.fields?.CompanyName === "ALLENDALE LARDER"));
  assert.ok(res.joins.some(j => j.text === "companies-house.csv ↔ records already in this map" && j.count === 2));
  // With no map yet, "fill in" works against records added from other files in the same batch.
  const fresh = applySources([...plan(readSample("360giving-grants.csv")), ...plan(readSample("companies-house.csv"), "fill")], null);
  assert.equal(fresh.tables.find(t => t.table === "companies-house.csv")!.used, 2);
  assert.ok(!fresh.graph.nodes.some(n => n.label === "Northern Sprocket Ltd"));
  // Re-adding the same files changes nothing.
  const again = applySources(plan([...readSample("companies-house.csv"), ...readSample("publicextract.charity_trustee.txt")], "fill"), res.graph);
  assert.equal(again.totals.newRecords, 0);
  assert.equal(again.totals.newLinks, 0);
  assert.equal(again.graph.nodes.length, res.graph.nodes.length);
});

test("a same-name pair is merged only when a person confirms it", () => {
  const res = applySources(plan(all()), null);
  const pair = res.sameName.find(c => c.b === "src:kumu-elements:elem-larder")!;
  const merged = mergeRecords(res.graph, pair.a, pair.b);
  assert.equal(merged.nodes.length, res.graph.nodes.length - 1);
  const larder = merged.nodes.find(n => n.id === pair.a)!;
  assert.ok(larder.tags.includes("food"));
  assert.ok(String(larder.properties!["Merged by you"]).startsWith("Allendale Larder (same name, confirmed on "));
  assert.ok(merged.edges.some(e => e.source === pair.a && e.type === "member of"));
  assert.ok(!merged.edges.some(e => e.source === pair.b || e.target === pair.b));
});

test("places records approximately from postcodes, never over recorded coordinates", () => {
  assert.equal(extractPostcode("The Old Chapel, ne479qz"), "NE47 9QZ");
  assert.deepEqual(lookupPostcode("NE47 9QZ", centroids), { latitude: 54.89, longitude: -2.25, precision: "postcode sector", method: "offline lookup", from: "NE47 9QZ" });
  assert.equal(lookupPostcode("NE45 5ZZ", centroids)!.precision, "postcode district");
  assert.equal(lookupPostcode("ZZ1 1ZZ", centroids), null);
  const graph = parseGraphDocument({ version: 1, title: "t", nodes: [
    { id: "a", label: "A", type: "organisation", tags: [], properties: { Postcode: "NE47 9QZ" } },
    { id: "b", label: "B", type: "organisation", tags: [], properties: { Postcode: "NE46 1ZZ", Latitude: "55.0", Longitude: "-1.6" } },
    { id: "c", label: "C", type: "organisation", tags: [], properties: { Postcode: "BT1 1AA" } },
    { id: "d", label: "D", type: "organisation", tags: [] }], edges: [] });
  const summary = summarisePlaces(graph, centroids);
  assert.equal(summary.recorded, 1);
  assert.deepEqual(summary.placed, { "postcode sector": 1 });
  assert.deepEqual(summary.notFound, ["BT1 1AA"]);
  assert.equal(summary.noPlace, 1);
  assert.deepEqual(summary.postcodesToLookUp.sort(), ["BT1 1AA", "NE47 9QZ"]);
  const { graph: placed, placed: count } = placeByPostcode(graph, centroids);
  assert.equal(count, 1);
  const a = placed.nodes.find(n => n.id === "a")!;
  assert.equal(a.properties!.Latitude, undefined, "approximate places never pose as recorded coordinates");
  assert.deepEqual(placedCoordinates(a), { lat: 54.89, lon: -2.25, approximate: true, place: a.properties![APPROXIMATE_KEY] });
  assert.deepEqual(placedCoordinates(placed.nodes.find(n => n.id === "b")!), { lat: 55, lon: -1.6, approximate: false });
  // An exact lookup a person asked for replaces the sector estimate.
  const exact = placeByPostcode(placed, centroids, { "NE47 9QZ": [54.8912, -2.2501], "BT1 1AA": [54.6, -5.93] }).graph;
  assert.equal((exact.nodes.find(n => n.id === "a")!.properties![APPROXIMATE_KEY] as { precision: string }).precision, "postcode");
  assert.equal((exact.nodes.find(n => n.id === "c")!.properties![APPROXIMATE_KEY] as { method: string }).method, "postcodes.io");
  assert.equal(placeByPostcode(exact, centroids).placed, 0, "running again changes nothing");
});

test("title-cases names written in capitals only", () => {
  assert.equal(titleCaseName("ST. JOHN'S CHURCH OF ENGLAND PTA"), "St. John's Church of England PTA");
  assert.equal(titleCaseName("THE FRIENDS OF HEXHAM PARK (NORTH)"), "The Friends of Hexham Park (North)");
  assert.equal(titleCaseName("NE YOUTH CIC"), "NE Youth CIC");
  assert.equal(titleCaseName("McCarthy Trust"), "McCarthy Trust");
  assert.equal(titleCaseName("A"), "A");
});

test("streams a large register file, keeping only rows about records in the map", async () => {
  const { readHead, streamDelimited, wantedKeys, rowMatcher } = await import("../src/index.ts");
  const base = applySources(plan(readSample("360giving-grants.csv")), null).graph;
  const sample = readFileSync(SAMPLES + "publicextract.charity.txt", "utf8").split("\r\n");
  const filler = Array.from({ length: 20000 }, (_, i) => sample[4].replace("1990009", String(1800000 + i)).replace("DISTANT DALES TRUST", "FILLER " + i));
  const text = [sample[0], ...filler.slice(0, 10000), sample[1], ...filler.slice(10000), sample[2], ""].join("\r\n");
  const head = readHead("publicextract.charity.txt", text.slice(0, 4096));
  const shape = recogniseTable(head)[0].shape;
  assert.equal(shape.id, "charity-commission-charity");
  const wanted = wantedKeys(base, []);
  let match: ((row: string[]) => boolean) | null = null;
  async function* chunks() { for (let i = 0; i < text.length; i += 997) yield text.slice(i, i + 997); }
  const { table, rowsRead } = await streamDelimited("publicextract.charity.txt", chunks(),
    (row, headings) => (match ??= rowMatcher(shape, headings, wanted))(row));
  assert.equal(rowsRead, 20002);
  assert.equal(table.rows.length, 2);
  assert.deepEqual(table.recordNumbers, [10002, 20003]);
  const res = applySources([{ table, shape, use: "fill" }], base);
  const youth = res.graph.nodes.find(n => n.id === "id:GB-CHC-1990003")!;
  assert.equal(youth.receipts!.find(r => r.fileName === "publicextract.charity.txt")!.recordNumber, 20003);
  assert.equal(res.graph.nodes.length, base.nodes.length);
});
