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

test("CSV source locations survive imported graph round trips",()=>{
  const result=previewImport([
    file("people.csv","Label,Type\nOrg One,Organisation\nOrg Two,Organisation\n"),
    file("links.csv","From,To,Type\nOrg One,Org Two,partners with\n")
  ]);
  assert.ok(result.graph);
  assert.deepEqual(result.graph.nodes[0].origin,{
    system:"csv",recordId:"Org One",fileName:"people.csv",recordNumber:2
  });
  assert.deepEqual(result.graph.edges[0].origin,{
    system:"csv",recordId:"1:0",fileName:"links.csv",recordNumber:2
  });
  const copy=previewImport([file("roundtrip.json",JSON.stringify(result.graph))]);
  assert.deepEqual(copy.graph?.nodes[0].origin,result.graph.nodes[0].origin);
});

test("Kumu elements and connections have their own array index, not invented line numbers",()=>{
  const result=previewImport([file("blueprint.json",JSON.stringify({elements:[
    {id:"x",label:"X"},{id:"y",label:"Y"}],
    connections:[{id:"a",from:"x",to:"y",type:"supports"}]
  }))]);
  assert.equal(result.graph?.nodes[1].origin?.recordNumber,2);
  assert.equal(result.graph?.edges[0].origin?.recordNumber,1);
  assert.equal(result.graph?.nodes[1].origin?.fileName,"blueprint.json");
});

test("invalid image/source URLs are visibly reported without deleting original fields",()=>{
  const result=previewImport([file("bad-urls.csv",
    "Label,Image URL,Source URL\nExample,ftp://unsupported,image-not-a-url\n")]);
  assert.ok(result.graph);
  assert.equal(result.graph.nodes[0].imageUrl,undefined);
  assert.equal(result.graph.nodes[0].sourceUrl,undefined);
  assert.equal(result.graph.nodes[0].properties?.["image url"],"ftp://unsupported");
  assert.ok(result.issues.some(x=>x.message.includes("entity image URLs")));
  assert.ok(result.issues.some(x=>x.message.includes("entity source URLs")));
});
