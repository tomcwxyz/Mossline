import test from "node:test";
import assert from "node:assert/strict";
import {sourceNetworkInsights,semanticNetworkInsights,type GraphDocument,
 type NetworkSemanticDocument} from "../src/index";

const graph:GraphDocument={
 version:1,title:"Source evidence",description:"",
 nodes:[
  {id:"a",label:"Green Futures",type:"organisation",tags:["Environment","Learning"],region:"North"},
  {id:"b",label:"Care Partnership",type:"organisation",tags:["Environment"],region:"South"},
  {id:"c",label:"Seed Project",type:"project",tags:["Environment"],region:"North"},
  {id:"d",label:"City Gardens",type:"organisation",tags:["Arts"],region:"South"},
  {id:"e",label:"New Space",type:"organisation",tags:["Arts"],region:"North"},
  {id:"private",label:"Private Notes",type:"other",tags:["Environment"],region:"South"}
 ],
 edges:[
  {id:"ab",source:"a",target:"b",type:"funding"},
  {id:"ac",source:"a",target:"c",type:"collaboration"},
  {id:"de",source:"d",target:"e",type:"possible",inferred:true}
 ]};
const eligible=new Set(["a","b","c","d","e"]);

test("source signals cite original nodes and edges, never mutate the graph",()=>{
 const before=JSON.stringify(graph);
 const signals=sourceNetworkInsights(graph,eligible);
 assert.equal(JSON.stringify(graph),before);
 assert.ok(signals.some(x=>x.kind==="recorded"&&x.sourceIds.includes("a")));
 assert.ok(signals.some(x=>x.kind==="theme"&&x.count===3));
 assert.ok(signals.some(x=>x.kind==="coverage"&&x.count===2));
 assert.ok(signals.every(x=>x.sourceIds.every(id=>eligible.has(id))));
 assert.ok(signals.every(x=>x.edgeIds.every(id=>id!=="de")));
 assert.ok(signals.every(x=>x.summary.length>20));
});
test("semantic leads use similarity only for unlinked source entities",()=>{
 const docs:NetworkSemanticDocument[]=graph.nodes.slice(0,5).map(n=>({
  id:n.id,label:n.label,type:n.type,
  text:n.id==="d"||n.id==="e"?
    "urban gardening horticulture green spaces civic gardens neighbourhood transformation":
    "youth education learning apprenticeship programmes outdoor skills vocational learning"
 }));
 const vectors=docs.map((_,i)=>i>=3?[0,1]:[1,0]);
 const before=JSON.stringify(graph);
 const leads=semanticNetworkInsights(graph,docs,vectors);
 assert.ok(leads.some(x=>x.kind==="similarity"&&
  x.sourceIds.includes("d")&&x.sourceIds.includes("e")));
 assert.ok(leads.every(x=>x.edgeIds.length===0));
 assert.equal(JSON.stringify(graph),before);
});
test("semantic leads reject incomplete or inconsistent embeddings",()=>{
 const docs:NetworkSemanticDocument[]=graph.nodes.slice(0,2).map(n=>({
  id:n.id,label:n.label,type:n.type,text:"Source records"}));
 assert.throws(()=>semanticNetworkInsights(graph,docs,[[1,0]]),/complete/);
 assert.throws(()=>semanticNetworkInsights(graph,docs,[[1,0],[1]]),/consistent/);
});
