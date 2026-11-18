import {test} from "node:test";
import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {parseGraphDocument,readDelimited,recogniseTable} from "@mossline/graph-core";
import {mossyOverview} from "../src/lib/mossy-findings";
const examples=["village-web","follow-the-money","after-dark","the-ripple-effect","changing-tides"] as const;
for(const id of examples)test("fictional "+id+" has valid source-grounded exploratory findings",()=>{
  const graph=parseGraphDocument(JSON.parse(readFileSync(resolve("apps/web/public/examples",id+".json"),"utf8")));
  const report=mossyOverview(graph);
  assert.ok(graph.nodes.length>=20);
  assert.ok(graph.edges.length>=20);
  assert.ok(report.findings.length>0);
  assert.equal(report.relationships,graph.edges.filter(e=>!e.inferred).length);
  assert.ok(graph.nodes.every(n=>n.origin?.fileName?.includes("fictional")));
  assert.ok(graph.edges.every(e=>e.origin?.fileName?.includes("fictional")));
  if(id==="after-dark"){
    // A geographical discovery must contain connected places, not merely pins.
    assert.ok(report.mappedConnections>=100);
    const placeFinding=report.findings.find(f=>f.id==="places");
    assert.ok(placeFinding);
    assert.match(placeFinding.detail,/recorded relationships connect mapped places/);
  }
});
test("the 5 examples recommend meaningfully different lenses",()=>{
 const lenses=examples.map(id=>mossyOverview(parseGraphDocument(
   JSON.parse(readFileSync(resolve("apps/web/public/examples",id+".json"),"utf8")))).recommended);
 assert.ok(new Set(lenses).size>=3);
});
test("inferences do not increase recorded relationship counts",()=>{
 const graph=parseGraphDocument({version:1,title:"Test",nodes:[
   {id:"a",label:"One",type:"organisation",tags:[]},{id:"b",label:"Two",type:"organisation",tags:[]}],
   edges:[{id:"guess",source:"a",target:"b",type:"similar to",inferred:true}]});
 const result=mossyOverview(graph);
 assert.equal(result.relationships,0);
 assert.equal(result.noConnections,2);
});

for(const id of examples)test("raw source CSVs for "+id+" are matched by the importer",()=>{
 const graph=parseGraphDocument(JSON.parse(readFileSync(resolve("apps/web/public/examples",id+".json"),"utf8")));
 const records=readDelimited(id+"-records.csv",readFileSync(resolve("apps/web/public/examples",id+"-records.csv"),"utf8"));
 const relationships=readDelimited(id+"-relationships.csv",readFileSync(resolve("apps/web/public/examples",id+"-relationships.csv"),"utf8"));
 assert.equal(records.rows.length,graph.nodes.length);
 assert.equal(relationships.rows.length,graph.edges.length);
 assert.equal(recogniseTable(records)[0]?.shape.id,"kumu-elements");
 assert.equal(recogniseTable(relationships)[0]?.shape.id,"kumu-connections");
 const labels=new Set(records.rows.map(row=>row[0]));
 assert.ok(relationships.rows.every(row=>labels.has(row[0])&&labels.has(row[1])));
});

test("showcase scale is meaningful without orphan records or misleading geography",()=>{
  const ranges:Record<string,{minNodes:number;minEdges:number;minMapped:number}>={
    "after-dark":{minNodes:300,minEdges:450,minMapped:110},
    "village-web":{minNodes:90,minEdges:190,minMapped:8},
    "the-ripple-effect":{minNodes:190,minEdges:400,minMapped:0},
    "follow-the-money":{minNodes:85,minEdges:500,minMapped:0},
    "changing-tides":{minNodes:135,minEdges:280,minMapped:16}
  };
  for(const id of examples){
    const graph=parseGraphDocument(JSON.parse(readFileSync(resolve("apps/web/public/examples",id+".json"),"utf8")));
    const ids=new Set(graph.nodes.map(n=>n.id));
    assert.ok(graph.nodes.length>=ranges[id].minNodes,id+" too few records");
    assert.ok(graph.edges.length>=ranges[id].minEdges,id+" too few links");
    assert.ok(graph.nodes.filter(n=>Number.isFinite(n.properties?.latitude)&&Number.isFinite(n.properties?.longitude)).length>=ranges[id].minMapped,id+" missing places");
    assert.ok(graph.edges.every(e=>ids.has(e.source)&&ids.has(e.target)),id+" orphan link");
    assert.ok(graph.edges.every(e=>!e.inferred),id+" example should not assert suggested links as facts");
  }
});
test("each showcase visual is a distinct, data-backed chart",()=>{
  const expected=["after-dark","village-web","the-ripple-effect","follow-the-money","changing-tides"];
  for(const id of expected){
    const svg=readFileSync(resolve("apps/web/public/examples",id+".svg"),"utf8");
    assert.match(svg,/<svg[^>]+viewBox="0 0 960 540"/);
    assert.ok(svg.includes("</svg>"));
  }
  assert.match(readFileSync(resolve("apps/web/public/examples/after-dark.svg"),"utf8"),/GEOGRAPHY/);
  assert.match(readFileSync(resolve("apps/web/public/examples/the-ripple-effect.svg"),"utf8"),/THEMES/);
  assert.match(readFileSync(resolve("apps/web/public/examples/follow-the-money.svg"),"utf8"),/Ribbon widths/);
});

test("a theme-rich list with no recorded relationships starts with themes, not an empty network",()=>{
  const graph=parseGraphDocument({version:1,title:"Themes alone",
    nodes:Array.from({length:80},(_,i)=>({
      id:"n"+i,label:"Initiative "+i,type:"project",tags:[i%2?"Culture":"Nature",i%5?"Health":"Food"]
    })),
    edges:[]});
  const report=mossyOverview(graph);
  assert.equal(report.recommended,"themes");
  assert.equal(report.relationships,0);
  assert.ok(report.findings.some(item=>item.id==="themes"));
});

