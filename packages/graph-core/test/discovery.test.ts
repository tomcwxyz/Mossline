import test from "node:test";
import assert from "node:assert/strict";
import { discoverData, buildMappedGraph, previewImport, type ColumnMapping } from "../src/index.ts";
const file=(name:string,text:string)=>({name,text});
const realisticConfig={
  version:1,name:"Example farming project",
  attributes:[
    {name:"Element Type",values:["Organisation","Project","Funder","ToC Methodology","Geography"]},
    {name:"Connection Type",values:["delivered_by","funded_by","operates_in"]},
    {name:"Region",values:["Wales","Scotland"]},
    {name:"Image",values:[]}
  ],
  elements:[],connections:[],loops:[],
  maps:[{name:"Network",src:"auth:googlesheets:REDACTED"}],
  perspectives:[{name:"01 Landscape",style:"element { color: green; }"},{name:"02 Collaborations",style:""}]
};
test("Kumu project configuration is analysed without treating missing Google Sheets records as populated",()=>{
  const input=file("config.json",JSON.stringify(realisticConfig));
  const discovered=discoverData(input);
  assert.equal(discovered.kind,"kumu-configuration");
  if(discovered.kind!=="kumu-configuration")return;
  assert.equal(discovered.externalSheets,true);
  assert.deepEqual(discovered.elementTypes,["Organisation","Project","Funder","ToC Methodology","Geography"]);
  assert.deepEqual(discovered.connectionTypes,["delivered_by","funded_by","operates_in"]);
  assert.equal(discovered.attributes.length,4);
  assert.equal(discovered.perspectives.length,2);
  assert.equal(discovered.fieldSuggestions.find(s=>s.field==="Element Type")?.treatment,"mapped");
  assert.equal(discovered.fieldSuggestions.find(s=>s.field==="Image")?.treatment,"review");
  assert.equal(discovered.embeddedNodes,0);
  const preview=previewImport([input]);
  assert.equal(preview.graph,null);
  assert.ok(preview.issues.some(x=>x.severity==="error" && x.message.includes("Google Sheets")));
  assert.equal(preview.counts.nodes,0);
});

test("a Kumu project that actually embeds records remains importable",()=>{
  const data={...realisticConfig,
    elements:[{id:"o",label:"Farm group", "Element Type":"Organisation",region:"Wales",topics:"Soil health"},
      {id:"p",label:"Field labs","Element Type":"Project"}],
    connections:[{id:"r",from:"o",to:"p","Connection Type":"delivered_by"}]};
  const preview=previewImport([file("populated.json",JSON.stringify(data))]);
  assert.ok(preview.graph);
  assert.equal(preview.graph.nodes[0].type,"organisation");
  assert.deepEqual(preview.graph.nodes[0].tags,["Soil health"]);
  assert.equal(preview.graph.edges[0].type,"delivered_by");
});

test("detects a straightforward existing spreadsheet and suggests possible network roles",()=>{
  const result=discoverData(file("landscape.csv",
    "Organisation,Project,Funder,Region\nFarm collective,Field trials,Community foundation,Wales\nFarm trust,Field trials,Community foundation,England\n"));
  assert.equal(result.kind,"csv-table");
  if(result.kind!=="csv-table")return;
  assert.equal(result.rowCount,2);
  assert.equal(result.mapping.mode,"relationships");
  assert.equal(result.mapping.rules[0].fromColumn,"Organisation");
  assert.equal(result.mapping.rules[0].toColumn,"Project");
  assert.equal(result.mapping.rules.length,2);
  assert.deepEqual(result.mapping.rules[1],{
    fromColumn:"Project",toColumn:"Funder",fromType:"project",toType:"funder",type:"funded by"
  });
  assert.equal(result.columns.find(c=>c.name==="Project")?.distinct,1);
  assert.equal(result.mapping.regionColumn,"Region");
});

test("reviewed, two-rule mapping builds graph entities from ordinary columns without requiring Kumu format",()=>{
  const input=file("landscape.csv",
    "Organisation,Project,Funder,Region\nFarm collective,Field trials,Community foundation,Wales\nFarm trust,Field trials,Community foundation,England\n");
  const discovered=discoverData(input);
  assert.equal(discovered.kind,"csv-table");
  if(discovered.kind!=="csv-table")return;
  const plan:ColumnMapping={...discovered.mapping,rules:[
    {fromColumn:"Organisation",toColumn:"Project",fromType:"organisation",toType:"project",type:"participates in"},
    {fromColumn:"Project",toColumn:"Funder",fromType:"project",toType:"funder",type:"funded by"}
  ]};
  const result=buildMappedGraph(input,plan);
  assert.ok(result.graph);
  assert.equal(result.graph.nodes.length,4);
  assert.equal(result.graph.edges.length,4);
  assert.equal(result.graph.nodes.find(n=>n.label==="Field trials")?.type,"project");
  assert.equal(result.graph.edges.find(e=>e.type==="funded by")?.origin?.fileName,"landscape.csv");
  assert.equal(result.counts.skipped,0);
});

test("mapping mode entities works without a connection table and preserves basic provenance",()=>{
  const input=file("names.csv","Entity,Category,Summary\nFarm A,Organisation,A local farm\nFarm B,Organisation,Another farm");
  const plan:ColumnMapping={mode:"entities",nameColumn:"Entity",nodeType:"other",typeColumn:"Category",regionTarget:"source",
    descriptionColumn:"Summary",regionColumn:"",rules:[]};
  const result=buildMappedGraph(input,plan);
  assert.equal(result.graph?.nodes.length,2);
  assert.equal(result.graph?.edges.length,0);
  assert.equal(result.graph?.nodes[0].type,"organisation");
  assert.equal(result.graph?.nodes[0].description,"A local farm");
  assert.equal(result.graph?.nodes[0].origin?.recordNumber,2);
});

test("bad mappings and missing endpoints are surfaced, never quietly guessed",()=>{
  const input=file("data.csv","Organisation,Project\nOrg A,\n,Project B\nOrg B,Project C");
  const discovered=discoverData(input);
  if(discovered.kind!=="csv-table")throw Error("Expected a table");
  const result=buildMappedGraph(input,discovered.mapping);
  assert.equal(result.graph?.edges.length,1);
  assert.equal(result.counts.skipped,2);
  assert.ok(result.issues.some(i=>i.severity==="warning" && i.message.includes("skipped")));
  assert.equal(buildMappedGraph(input,{...discovered.mapping,rules:[
    {...discovered.mapping.rules[0],fromColumn:"nonexistent"}
  ]}).graph,null);
  assert.equal(buildMappedGraph(input,{...discovered.mapping,rules:[
    {...discovered.mapping.rules[0],type:""}
  ]}).graph,null);
});

test("reviewed mappings refuse to expose rows explicitly marked non-public",()=>{
  const input=file("records.csv",
    "Organisation,Project,Public\nVisible farm,Project A,TRUE\nHidden farm,Project Secret,FALSE\n");
  const discovered=discoverData(input);
  if(discovered.kind!=="csv-table")throw Error("Expected tabular input");
  const preview=buildMappedGraph(input,discovered.mapping);
  assert.ok(preview.graph);
  assert.equal(preview.graph.nodes.length,2);
  assert.equal(preview.graph.edges.length,1);
  assert.equal(preview.counts.skipped,1);
  assert.equal(preview.graph.nodes.some(n=>n.label==="Hidden farm"),false);
  assert.ok(preview.issues.some(i=>i.message.includes("non-public")));
});

test("Kumu import excludes explicit private elements and links pointing to them",()=>{
  const result=previewImport([file("example.json",JSON.stringify({
    elements:[
      {id:"a",label:"Visible",Public:"TRUE","Element Type":"Organisation"},
      {id:"b",label:"Hidden",Public:"FALSE","Element Type":"Project"},
      {id:"c",label:"Also visible",Public:"TRUE","Element Type":"Funder"}
    ],
    connections:[
      {id:"a-b",from:"a",to:"b","Connection Type":"works_on"},
      {id:"a-c",from:"a",to:"c","Connection Type":"funded_by"},
      {id:"c-a",from:"c",to:"a","Connection Type":"funds",Public:"FALSE"}
    ]
  }))]);
  assert.ok(result.graph);
  assert.deepEqual(result.graph.nodes.map(n=>n.label),["Visible","Also visible"]);
  assert.deepEqual(result.graph.edges.map(e=>e.type),["funded_by"]);
  assert.ok(result.issues.some(i=>i.message.includes("non-public")));
});

test("mapped relationship identity survives reordered spreadsheet rows",()=>{
  const rows=["Organisation,Project","Growers A,Project A","Growers B,Project B"];
  const first=file("before.csv",rows.join("\n"));
  const second=file("after.csv",[rows[0],rows[2],rows[1]].join("\n"));
  const analysed=discoverData(first);
  if(analysed.kind!=="csv-table") throw Error("Expected tabular data");
  const a=buildMappedGraph(first,analysed.mapping).graph;
  const b=buildMappedGraph(second,analysed.mapping).graph;
  assert.ok(a&&b);
  assert.deepEqual(new Set(a.edges.map(e=>e.id)),new Set(b.edges.map(e=>e.id)));
});
