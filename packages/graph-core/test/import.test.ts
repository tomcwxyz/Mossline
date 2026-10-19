import test from "node:test";
import assert from "node:assert/strict";
import { previewImport, parseCsv } from "../src/index.ts";
const file = (name: string, text: string) => ({name,text});

test("CSV parser handles BOM, quoted commas, quotes and newlines", () => {
  assert.deepEqual(parseCsv('\uFEFFLabel,Description\r\n"A, B","one ""quote""\nand another line"'),
    [["Label","Description"],["A, B",'one "quote"\nand another line']]);
});
test("Kumu IDs, directions, and custom fields survive import; repeatable IDs", () => {
  const source = {elements:[
    {id:"one",label:"Duplicate",type:"Organisation","Focus area":"Land"},
    {id:"two",label:"Duplicate",type:"Funder"}
  ],connections:[{id:"rel",from:"one",to:"two",direction:"mutual",type:"supports","Strength":"high"}]};
  const first=previewImport([file("map.json",JSON.stringify(source))]);
  const second=previewImport([file("map.json",JSON.stringify(source))]);
  assert.ok(first.graph);
  assert.deepEqual(first.graph,second.graph);
  assert.equal(first.graph.nodes[0].properties?.["Focus area"],"Land");
  assert.equal(first.graph.edges[0].properties?.Strength,"high");
  assert.equal(first.graph.edges[0].direction,"mutual");
});
test("ambiguous label references cause errors, not guessed relationships", () => {
  const result=previewImport([file("map.json",JSON.stringify({elements:[
    {id:"a",label:"Same"},{id:"b",label:"Same"}
  ],connections:[{from:"Same",to:"b"}]}))]);
  assert.equal(result.graph,null);
  assert.ok(result.issues.some(x => x.severity==="error" && x.message.includes("ambiguous")));
});
test("missing endpoints prevent import", () => {
  const result=previewImport([
    file("elements.csv","Label,Type\nA,Organisation\n"),
    file("connections.csv","From,To\nA,B\n")
  ]);
  assert.equal(result.graph,null);
  assert.ok(result.issues.some(x => x.message.includes("missing")));
});
test("Sheets CSV pairs parse pipe-separated To and tags", () => {
  const result=previewImport([
    file("elements.csv","Label,Type,Tags\nA,Organisation,food|soil\nB,Project,\nC,Funder,\n"),
    file("connections.csv","From,To,Type\nA,B|C,works on\n")
  ]);
  assert.ok(result.graph);
  assert.equal(result.graph.nodes.length,3);
  assert.equal(result.graph.edges.length,2);
  assert.deepEqual(result.graph.nodes[0].tags,["food","soil"]);
});
test("unknown Kumu backup structure fails with explanation", () => {
  const result=previewImport([file("backup.json",JSON.stringify({project:{maps:[]}}))]);
  assert.equal(result.graph,null);
  assert.match(result.issues[0].message,/unsupported Kumu backup/i);
});
test("extra Kumu top-level fields warn of incomplete migration", () => {
  const result=previewImport([file("map.json",JSON.stringify({
    elements:[{label:"A"}],connections:[],views:[{name:"default"}]
  }))]);
  assert.ok(result.graph);
  assert.ok(result.issues.some(x => x.severity==="warning" && x.message.includes("views")));
});
