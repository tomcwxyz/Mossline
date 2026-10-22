import test from "node:test";
import assert from "node:assert/strict";
import type {GraphDocument} from "@mossline/graph-core";
import {generalMapCounts} from "../src/lib/general-map-store";
import {MAX_LOCAL_MAPS,readStoredMapLibrary,serialiseMapLibrary,
  type LocalMap} from "../src/lib/map-library";

const makeGraph=(title:string,n:number):GraphDocument=>({
  version:1,title,description:"Evidence is kept intact",
  nodes:Array.from({length:n},(_,i)=>({
    id:title+"-"+i,label:"Organisation "+i,type:"organisation",tags:[]
  })),
  edges:n<2?[]:[{id:"edge",source:title+"-0",target:title+"-1",type:"supports"}]
});

test("v1 library format retains existing small graphs and active-map identity",()=>{
  const existing:LocalMap={
    id:"from-old-browser",createdAt:1720000000000,title:"Original network",
    graph:makeGraph("Original network",2)
  };
  const value=serialiseMapLibrary([existing],existing.id);
  assert.deepEqual(Object.keys(value),["activeId","maps"]);
  assert.equal(value.activeId,"from-old-browser");
  assert.deepEqual(value.maps[0].graph,existing.graph);
  assert.deepEqual(readStoredMapLibrary(JSON.stringify(value)),value);
});
test("large browser maps keep original references and accurate source counts",()=>{
  const graph=makeGraph("Full source",2);
  const existing:LocalMap={
    id:"v1-map",createdAt:1720000000000,title:"Full source",graph,
    generalDatasetId:"v1-indexeddb-key",sourceCounts:{nodes:2000,edges:1999}
  };
  const saved=serialiseMapLibrary([existing],existing.id);
  assert.deepEqual(saved.maps[0].graph.nodes,[]);
  assert.deepEqual(saved.maps[0].graph.edges,[]);
  assert.deepEqual(saved.maps[0].sourceCounts,{nodes:2000,edges:1999});
  assert.equal(saved.maps[0].generalDatasetId,"v1-indexeddb-key");
  assert.equal(existing.graph.nodes.length,2,"Saving a stub must not alter loaded data");
  const restored=readStoredMapLibrary(JSON.stringify(saved));
  assert.equal(restored?.maps[0].graph.title,"Full source");
  assert.deepEqual(restored?.maps[0].sourceCounts,{nodes:2000,edges:1999});
});
test("missing counts use full in-memory graph; invalid entries do not replace user data",()=>{
  const graph=makeGraph("Graph",2);
  const map:LocalMap={id:"g",title:"Graph",createdAt:1,graph,
    generalDatasetId:"persisted-id"};
  const value=serialiseMapLibrary([map],"g");
  assert.deepEqual(value.maps[0].sourceCounts,generalMapCounts(graph));
  assert.equal(readStoredMapLibrary(JSON.stringify({activeId:"x",maps:[]})),null);
  assert.equal(readStoredMapLibrary(JSON.stringify({maps:Array.from({length:MAX_LOCAL_MAPS+1},()=>map)})),null);
  assert.throws(()=>readStoredMapLibrary(JSON.stringify({maps:[{id:6,title:"Bad",createdAt:1,graph}]})));
});
