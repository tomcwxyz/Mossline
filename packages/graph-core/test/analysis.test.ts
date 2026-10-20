import test from "node:test";
import assert from "node:assert/strict";
import { findRecordedRoutes, findReachableDestinations, findStructuralJunctions, parseGraphDocument } from "../src/index.ts";

const network = parseGraphDocument({version:1,title:"Alternative routes",nodes:[
  {id:"a",label:"A",type:"organisation"},
  {id:"b",label:"B",type:"project"},
  {id:"c",label:"C",type:"funder"},
  {id:"d",label:"D",type:"organisation"},
  {id:"e",label:"Disconnected",type:"person"}
],edges:[
  {id:"ab",source:"a",target:"b",type:"supports"},
  {id:"bd",source:"b",target:"d",type:"funds"},
  {id:"ac",source:"a",target:"c",type:"supports"},
  {id:"cd",source:"c",target:"d",type:"supports"},
  {id:"bc",source:"b",target:"c",type:"supports"},
  {id:"shortcut",source:"a",target:"d",type:"shared",inferred:true}
]});

test("offers different simple routes, shortest first, with exact source edge IDs",()=>{
  const routes=findRecordedRoutes(network,"a","d");
  assert.equal(routes.length,3);
  assert.deepEqual(routes[0].nodeIds,["a","b","d"]);
  assert.deepEqual(routes[1].nodeIds,["a","c","d"]);
  assert.deepEqual(routes[0].steps.map(s=>s.edgeId),["ab","bd"]);
  assert.equal(routes[0].steps[1].forward,true);
  assert.equal(routes[0].steps.every(s=>s.edgeId!=="shortcut"),true);
  assert.equal(routes[2].steps.length,3);
});

test("excluding an exact relationship type changes the available routes",()=>{
  const routes=findRecordedRoutes(network,"a","d",{excludeTypes:["funds"],maxHops:2});
  assert.equal(routes.length,1);
  assert.deepEqual(routes[0].nodeIds,["a","c","d"]);
});

test("route exploration is bounded and never claims missing paths exist",()=>{
  assert.deepEqual(findRecordedRoutes(network,"a","e"),[]);
  assert.deepEqual(findRecordedRoutes(network,"a","d",{maxHops:1}),[]);
  assert.deepEqual(findRecordedRoutes(network,"a","a"),[{nodeIds:["a"],steps:[]}]);
  assert.deepEqual(findRecordedRoutes(network,"a","missing"),[]);
  assert.deepEqual(findRecordedRoutes(network,"a","d",{maxRoutes:0}),[]);
  assert.deepEqual(findRecordedRoutes(network,"a","d",{maxHops:200}),[]);
});

test("a path preserves source relationship direction even when explored backwards",()=>{
  const route=findRecordedRoutes(network,"d","a",{maxHops:2})[0];
  assert.deepEqual(route.nodeIds,["d","b","a"]);
  assert.equal(route.steps.every(step=>step.forward===false),true);
});

test("structural junctions identify cut nodes in the recorded graph only",()=>{
  const line=parseGraphDocument({version:1,title:"Cut vertices",nodes:[
    {id:"a",label:"A",type:"organisation"},
    {id:"b",label:"B",type:"organisation"},
    {id:"c",label:"C",type:"project"},
    {id:"d",label:"D",type:"funder"},
    {id:"e",label:"E",type:"person"},
    {id:"f",label:"F",type:"other"}
  ],edges:[
    {id:"ab",source:"a",target:"b",type:"knows"},
    {id:"bc",source:"b",target:"c",type:"knows"},
    {id:"cd",source:"c",target:"d",type:"knows"},
    {id:"ef",source:"e",target:"f",type:"knows"},
    {id:"ad-projection",source:"a",target:"d",type:"shared",inferred:true}
  ]});
  const junctions=findStructuralJunctions(line);
  assert.deepEqual(junctions.map(x=>x.nodeId).sort(),["b","c"]);
  assert.equal(junctions.find(x=>x.nodeId==="c")?.separatedGroups,2);
});

test("cycles do not create junctions, and star centres separate distinct groups",()=>{
  const ring=parseGraphDocument({version:1,title:"Cycle",nodes:
    ["a","b","c"].map(id=>({id,label:id,type:"other"})),edges:[
    {id:"ab",source:"a",target:"b",type:"knows"},
    {id:"bc",source:"b",target:"c",type:"knows"},
    {id:"ca",source:"c",target:"a",type:"knows"}]});
  assert.deepEqual(findStructuralJunctions(ring),[]);
  const star=parseGraphDocument({version:1,title:"Star",nodes:
    ["hub","a","b","c"].map(id=>({id,label:id,type:"other"})),edges:
    ["a","b","c"].map(id=>({id:"h-"+id,source:"hub",target:id,type:"knows"}))});
  assert.deepEqual(findStructuralJunctions(star),[{nodeId:"hub",degree:3,separatedGroups:3}]);
});

test("the destination selector only offers source-connected entities reachable in five or fewer hops",()=>{
  const destinations=findReachableDestinations(network,"a");
  assert.deepEqual(destinations.map(x=>[x.nodeId,x.hops]),[
    ["b",1],["c",1],["d",2]
  ]);
  assert.equal(destinations.some(x=>x.nodeId==="e"||x.nodeId==="a"),false);
  for(const dest of destinations) {
    const routes=findRecordedRoutes(network,"a",dest.nodeId,{maxHops:5,maxRoutes:1});
    assert.equal(routes.length,1);
    assert.equal(routes[0].steps.length,dest.hops);
  }
});

test("reaching a destination never treats an inferred link as a shortcut",()=>{
  const results=findReachableDestinations(network,"a",{maxHops:1});
  assert.deepEqual(results.map(x=>x.nodeId),["b","c"]);
  assert.equal(results.some(x=>x.nodeId==="d"),false);
});

test("relationship-type exclusions and hop limits apply identically to the destination selector",()=>{
  const withinOne=findReachableDestinations(network,"a",{maxHops:1});
  assert.equal(withinOne.length,2);
  const noSupports=findReachableDestinations(network,"a",{excludeTypes:["supports"]});
  assert.deepEqual(noSupports,[]);
  const noFunding=findReachableDestinations(network,"a",{excludeTypes:["funds"]});
  assert.equal(noFunding.find(x=>x.nodeId==="d")?.hops,2);
  assert.deepEqual(findReachableDestinations(network,"a",{maxHops:0}),[]);
  assert.deepEqual(findReachableDestinations(network,"a",{maxHops:100}),[]);
  assert.deepEqual(findReachableDestinations(network,"missing"),[]);
  assert.deepEqual(findReachableDestinations(network,"e"),[]);
});

test("a directed source link can be explored backwards but its direction is preserved in the route",()=>{
  const backwards=findReachableDestinations(network,"d",{maxHops:1});
  assert.deepEqual(backwards.map(x=>x.nodeId),["b","c"]);
  const trail=findRecordedRoutes(network,"d","b",{maxHops:1,maxRoutes:1})[0];
  assert.equal(trail.steps[0].forward,false);
});

test("destination discovery deduplicates multiple records for the same pair",()=>{
  const duplicates=parseGraphDocument({...network,edges:[
    ...network.edges,
    {id:"second-ab",source:"a",target:"b",type:"supports"}
  ]});
  const destinations=findReachableDestinations(duplicates,"a",{maxHops:1});
  assert.equal(destinations.filter(d=>d.nodeId==="b").length,1);
});
