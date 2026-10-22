import test from "node:test";
import assert from "node:assert/strict";
import type {GraphDocument} from "@mossline/graph-core";
import {generalMapCounts,generalMapStub,shouldStoreGeneralGraph,
  LARGE_GENERAL_GRAPH_CHARS} from "../src/lib/general-map-store";

const makeGraph=(n:number):GraphDocument=>({
 version:1,title:"My source network",description:"Original descriptions stay intact",
 nodes:Array.from({length:n},(_,i)=>({
  id:"entity-"+i,label:"Organisation "+i,type:"organisation" as const,
  tags:["community"],description:"Source description for this entity"
 })),
 edges:Array.from({length:Math.max(0,n-1)},(_,i)=>({
  id:"edge-"+i,source:"entity-"+i,target:"entity-"+(i+1),type:"knows"
 }))
});
test("small maps retain their normal in-browser editing route",()=>{
 const graph=makeGraph(5);
 assert.equal(shouldStoreGeneralGraph(graph),false);
 assert.deepEqual(generalMapCounts(graph),{nodes:5,edges:4});
});
test("2000-entity networks use a reference but keep accurate full counts",()=>{
 const graph=makeGraph(2000);
 assert.ok(JSON.stringify(graph).length>LARGE_GENERAL_GRAPH_CHARS);
 assert.equal(shouldStoreGeneralGraph(graph),true);
 assert.deepEqual(generalMapCounts(graph),{nodes:2000,edges:1999});
 const stub=generalMapStub(graph);
 assert.deepEqual(stub.nodes,[]);
 assert.deepEqual(stub.edges,[]);
 assert.equal(stub.title,graph.title);
 assert.equal(stub.description,graph.description);
 assert.equal(graph.nodes.length,2000,"Stub creation must never mutate the original network");
});
