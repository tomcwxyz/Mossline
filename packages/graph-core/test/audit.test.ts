import test from "node:test";
import assert from "node:assert/strict";
import { auditGraph, parseGraphDocument } from "../src/index.ts";

test("coverage tracks original source files, isolated entities and duplicate labels",()=>{
  const graph=parseGraphDocument({version:1,title:"Audit",nodes:[
    {id:"a",label:"Same",type:"organisation",region:"North",description:"Example",
      origin:{system:"csv",recordId:"a",fileName:"elements.csv",recordNumber:2}},
    {id:"b",label:"Same",type:"project",origin:{
      system:"csv",recordId:"b",fileName:"elements.csv",recordNumber:3}},
    {id:"c",label:"Orphan",type:"other",sourceUrl:"https://example.org"}
  ],edges:[{id:"r",source:"a",target:"b",type:"works with",origin:{
    system:"csv",recordId:"r",fileName:"connections.csv",recordNumber:2}}]});
  const audit=auditGraph(graph);
  assert.deepEqual(audit.totals,{nodes:3,relationships:1,recorded:1,inferred:0});
  assert.equal(audit.categories.other,1);
  assert.equal(audit.coverage.nodesWithOrigin,2);
  assert.equal(audit.coverage.relationshipsWithOrigin,1);
  assert.equal(audit.coverage.nodesWithDescription,1);
  assert.deepEqual(audit.isolated,[{id:"c",label:"Orphan"}]);
  assert.deepEqual(audit.duplicateLabels,[{label:"Same",ids:["a","b"]}]);
  assert.deepEqual(audit.sources,[
    {system:"csv",fileName:"connections.csv",nodes:0,relationships:1},
    {system:"csv",fileName:"elements.csv",nodes:2,relationships:0}
  ]);
});

test("recorded and inferred counts are distinct; inferred still counts as a connection",()=>{
  const graph=parseGraphDocument({version:1,title:"Test",nodes:[
    {id:"x",label:"X",type:"organisation"},{id:"y",label:"Y",type:"organisation"}
  ],edges:[{id:"shared",source:"x",target:"y",type:"shared",inferred:true}]});
  const audit=auditGraph(graph);
  assert.equal(audit.totals.recorded,0);
  assert.equal(audit.totals.inferred,1);
  assert.equal(audit.isolated.length,0);
  assert.deepEqual(audit.sources,[]);
});

test("empty graphs return zeros and no fabricated source coverage",()=>{
  const result=auditGraph(parseGraphDocument({version:1,title:"Empty",nodes:[],edges:[]}));
  assert.equal(result.totals.nodes,0);
  assert.equal(result.sources.length,0);
  assert.equal(result.duplicateLabels.length,0);
  assert.equal(result.coverage.nodesWithOrigin,0);
});
