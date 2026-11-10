import {test} from "node:test";
import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {parseGraphDocument} from "@mossline/graph-core";
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
