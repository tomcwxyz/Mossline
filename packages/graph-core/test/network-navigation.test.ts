import test from "node:test";
import assert from "node:assert/strict";
import {parseGraphDocument} from "../src/schema.ts";
import {buildAdaptiveGraphIndex,projectAdaptiveGraph} from "../src/adaptive-graph.ts";
import {buildNetworkNavigation,inspectNetworkNode,searchNetwork,
  revealNetworkNode} from "../src/network-navigation.ts";
const source=parseGraphDocument({
  version:1,title:"Community network",description:"",
  nodes:[
    {id:"trust",label:"North Trust",type:"funder",tags:[]},
    ...Array.from({length:180},(_,i)=>({
      id:"n"+i,label:"Organisation "+String(i).padStart(3,"0"),
      type:"organisation",region:i%2?"North East":"Yorkshire",
      tags:i===170?["food justice"]:[],description:i===170?"Runs a food network":""
    }))
  ],
  edges:Array.from({length:180},(_,i)=>({
    id:"grant"+i,source:"trust",target:"n"+i,
    type:"supports",direction:"directed",description:"Recorded award"
  }))
});
test("whole-graph search finds entities outside a collapsed visual summary",()=>{
  const index=buildNetworkNavigation(source);
  const hits=searchNetwork(index,"organisation 170");
  assert.equal(hits.total,1);
  assert.equal(hits.items[0].id,"n170");
  assert.equal(searchNetwork(index,"food justice").items[0].id,"n170");
  assert.equal(searchNetwork(index,"  ").total,0);
});
test("inspection uses all original edges, not a displayed graph or first page",()=>{
  const index=buildNetworkNavigation(source);
  const page=inspectNetworkNode(index,"trust",{page:4,pageSize:25});
  assert.equal(page.totalRelationships,180);
  assert.equal(page.distinctNeighbours,180);
  assert.equal(page.pages,8);
  assert.equal(page.connections.length,25);
  assert.ok(page.connections.every(entry=>entry.edge.type==="supports"));
  const result=inspectNetworkNode(index,"trust",{query:"Organisation 170"});
  assert.equal(result.matchingRelationships,1);
  assert.equal(result.connections[0].other.id,"n170");
  assert.throws(()=>inspectNetworkNode(index,"absent"),/not present/);
});
test("navigate directly to hidden entity, preserving complete node and edge accounting",()=>{
  const index=buildAdaptiveGraphIndex(source);
  const before=projectAdaptiveGraph(index,[]);
  assert.ok(!before.graph.nodes.some(n=>n.id==="n170"));
  const result=revealNetworkNode(index,[],"n170");
  assert.ok(result.projection.graph.nodes.some(n=>n.id==="n170"));
  assert.equal(result.projection.representedNodes,181);
  assert.equal(result.projection.representedEdges,180);
  assert.ok(result.expandedIds.length>0);
  assert.deepEqual(revealNetworkNode(index,result.expandedIds,"n170").expandedIds,
    result.expandedIds);
});
test("search limits only result presentation, not matching record count",()=>{
  const index=buildNetworkNavigation(source);
  const all=searchNetwork(index,"organisation",6);
  assert.equal(all.total,180);assert.equal(all.items.length,6);
});
test("unrevealed self-loop and parallel records remain separately inspectable",()=>{
 const graph=parseGraphDocument({version:1,title:"Multiple claims",description:"",
  nodes:[{id:"a",label:"A",type:"person",tags:[]},
    {id:"b",label:"B",type:"person",tags:[]}],
  edges:[{id:"e1",source:"a",target:"b",type:"met"},
    {id:"e2",source:"a",target:"b",type:"works with"},
    {id:"e3",source:"a",target:"a",type:"notes"}]});
 const index=buildNetworkNavigation(graph);
 const inspection=inspectNetworkNode(index,"a");
 assert.equal(inspection.totalRelationships,3);
 assert.equal(inspection.distinctNeighbours,2);
 assert.deepEqual(new Set(inspection.connections.map(c=>c.edge.id)),
   new Set(["e1","e2","e3"]));
});
