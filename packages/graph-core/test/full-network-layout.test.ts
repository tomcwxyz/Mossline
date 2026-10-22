import test from "node:test";
import assert from "node:assert/strict";
import {parseGraphDocument} from "../src/schema.ts";
import {layoutFullNetwork,focusFullNetwork} from "../src/full-network-layout.ts";
import {atlasDetailLevel,visibleAtlasNodeLabels} from "../src/atlas-detail.ts";
test("full network GPU geometry includes every source entity and parallel edge",()=>{
 const graph=parseGraphDocument({version:1,title:"All",description:"",
  nodes:Array.from({length:900},(_,i)=>({id:"n"+i,label:"Node "+i,
    type:i%2?"organisation":"project",tags:[]})),
  edges:Array.from({length:1250},(_,i)=>({id:"e"+i,source:"n"+i%900,
    target:"n"+(i+1)%900,type:"recorded"}))});
 const g=layoutFullNetwork(graph);
 assert.equal(g.nodeCount,900);assert.equal(g.edgeCount,1250);
 assert.equal(g.ids.length,900);
 assert.equal(g.labels[0],"Node 0");
 assert.equal(g.endpoints.length,2500);assert.equal(g.recorded.length,1250);
 assert.equal(g.positions.length,1800);assert.equal(g.segments.length,5000);
 assert.ok([...g.positions].every(Number.isFinite));
 assert.ok([...g.segments].every(Number.isFinite));
 assert.deepEqual(layoutFullNetwork(graph).positions,g.positions);
});
test("an empty network produces finite fit bounds",()=>{
 const g=layoutFullNetwork(parseGraphDocument({version:1,title:"Empty",description:"",
  nodes:[],edges:[]}));
 assert.equal(g.nodeCount,0);
 assert.deepEqual(g.bounds,{minX:-1,minY:-1,maxX:1,maxY:1});
});

test("focus highlights only recorded source relationships, preserving full background geometry",()=>{
 const graph=parseGraphDocument({version:1,title:"Focus",description:"",
   nodes:["a","b","c","d"].map(id=>({id,label:id,type:"organisation",tags:[]})),
   edges:[
    {id:"r1",source:"a",target:"b",type:"supports"},
    {id:"r2",source:"a",target:"b",type:"supports"},
    {id:"predicted",source:"a",target:"c",type:"similar",inferred:true}
   ]});
 const geometry=layoutFullNetwork(graph);
 const focus=focusFullNetwork(geometry,"a");
 assert.ok(focus);
 assert.equal(focus.relationships,2);
 assert.equal(focus.neighbours,1);
 assert.deepEqual([...focus.neighbourIndices].sort(),[0,1]);
 assert.equal(focus.lines.length,8);
 assert.equal(geometry.edgeCount,3,"No original edges should be dropped from the background");
 assert.equal(focusFullNetwork(geometry,"d")?.relationships,0);
 assert.equal(focusFullNetwork(geometry,"d")?.neighbours,0);
 assert.equal(focusFullNetwork(geometry,"unseen"),null);
 assert.equal(focusFullNetwork(geometry,null),null);
});
test("large parallel source graph focuses without inventing relationships",()=>{
 const length=6000;
 const graph=parseGraphDocument({version:1,title:"Big",description:"",
 nodes:Array.from({length},(_,i)=>({id:"n"+i,label:"N"+i,
  type:"project",tags:[]})),
 edges:Array.from({length:length-1},(_,i)=>({id:"e"+i,
  source:"n"+i,target:"n"+(i+1),type:"recorded"}))});
 const geometry=layoutFullNetwork(graph);
 const focus=focusFullNetwork(geometry,"n3000");
 assert.equal(geometry.nodeCount,length);
 assert.equal(focus?.relationships,2);
 assert.equal(focus?.neighbours,2);
});

test("funding size encodes recorded degree independently from single-currency amounts",()=>{
 const graph=parseGraphDocument({version:1,title:"Funding",description:"",
 nodes:[
  {id:"f",label:"Funder",type:"funder",tags:[]},
  {id:"r",label:"Recipient",type:"organisation",tags:[]},
  {id:"g1",label:"Grant 10k",type:"project",tags:[],
   properties:{mosslineFundingGrant:true,amountAwarded:10000,currency:"GBP",funderId:"f",recipientId:"r"}},
  {id:"g2",label:"Grant 90k",type:"project",tags:[],
   properties:{mosslineFundingGrant:true,amountAwarded:90000,currency:"GBP",funderId:"f",recipientId:"r"}},
  {id:"other",label:"Unrelated",type:"organisation",tags:[]}
 ],
 edges:[
  {id:"e1",source:"f",target:"g1",type:"awarded"},
  {id:"e2",source:"g1",target:"r",type:"awarded to"},
  {id:"e3",source:"f",target:"g2",type:"awarded"},
  {id:"e4",source:"g2",target:"r",type:"awarded to"}
 ]});
 const geometry=layoutFullNetwork(graph);
 assert.equal(geometry.amountCurrency,"GBP");
 assert.equal(geometry.amountCount,2);
 assert.equal(geometry.degreeSizes.length,5);
 assert.equal(geometry.amountSizes.length,5);
 assert.ok(geometry.degreeSizes[0]>geometry.degreeSizes[4]);
 assert.ok(geometry.amountSizes[0]>geometry.amountSizes[3]);
 assert.ok(geometry.amountSizes[3]>geometry.amountSizes[2]);
 assert.equal(geometry.amountSizes[4],3.5);
 const focus=focusFullNetwork(geometry,"f");
 assert.ok(focus);
 assert.equal(focus.degreeSizes.length,3);
 assert.equal(focus.amountSizes.length,3);
});
test("mixed currencies do not imply comparable award amounts",()=>{
 const graph=parseGraphDocument({version:1,title:"Mixed",description:"",
 nodes:[
  {id:"f",label:"Funder",type:"funder",tags:[]},
  {id:"g1",label:"GBP",type:"project",tags:[],properties:{
   mosslineFundingGrant:true,amountAwarded:500,currency:"GBP",funderId:"f"}},
  {id:"g2",label:"USD",type:"project",tags:[],properties:{
   mosslineFundingGrant:true,amountAwarded:800,currency:"USD",funderId:"f"}}],
 edges:[{id:"e1",source:"f",target:"g1",type:"funded"},
  {id:"e2",source:"f",target:"g2",type:"funded"}]});
 const geometry=layoutFullNetwork(graph);
 assert.equal(geometry.amountCurrency,null);
 assert.equal(geometry.amountCount,0);
});

test("relationship-led layout creates meaningful connector areas without hiding source records",()=>{
 const nodes=[
  {id:"funder-a",label:"Foundation A",type:"funder" as const,tags:[]},
  {id:"funder-b",label:"Foundation B",type:"funder" as const,tags:[]},
  ...Array.from({length:18},(_,i)=>({id:"grant-"+i,
   label:"Award "+i,type:"project" as const,tags:[]})),
  {id:"isolated",label:"No recorded relationships",type:"organisation" as const,tags:[]}
 ];
 const edges=Array.from({length:18},(_,i)=>({
  id:"award-"+i,source:i<9?"funder-a":"funder-b",
  target:"grant-"+i,type:"awarded"
 }));
 const graph=parseGraphDocument({version:1,title:"Two funders",description:"",nodes,edges});
 const geometry=layoutFullNetwork(graph);
 assert.equal(geometry.arrangement,"areas");
 assert.equal(geometry.nodeCount,nodes.length);
 assert.equal(geometry.edgeCount,edges.length);
 assert.ok(geometry.areas.some(a=>a.label.includes("Foundation A")&&a.count===10));
 assert.ok(geometry.areas.some(a=>a.label.includes("Foundation B")&&a.count===10));
 assert.ok(geometry.areas.some(a=>a.kind==="unlinked"&&a.count===1));
 assert.ok(geometry.hubs.some(h=>h.id==="funder-a"&&h.connections===9));
 for(let i=0;i<edges.length;i++){
  assert.equal(geometry.segments[4*i],
    geometry.positions[2*geometry.endpoints[2*i]]);
  assert.equal(geometry.segments[4*i+3],
    geometry.positions[2*geometry.endpoints[2*i+1]+1]);
 }
 const focus=focusFullNetwork(geometry,"funder-a");
 assert.equal(focus?.relationships,9);
 assert.equal(focus?.neighbours,9);
 assert.deepEqual(layoutFullNetwork(graph).positions,geometry.positions);
 const categories=layoutFullNetwork(graph,"types");
 assert.equal(categories.arrangement,"types");
 assert.equal(categories.areas.length,0);
 assert.deepEqual(categories.endpoints,geometry.endpoints);
 assert.notDeepEqual(categories.positions,geometry.positions);
});
test("unlinked datasets retain every entity and distinguish source type without invented links",()=>{
 const graph=parseGraphDocument({version:1,title:"Contacts",description:"",
 nodes:Array.from({length:2647},(_,i)=>({id:"contact-"+i,label:"Contact "+i,
 type:i%2?"organisation":"person",tags:[]})),edges:[]});
 const geometry=layoutFullNetwork(graph);
 assert.equal(geometry.nodeCount,2647);
 assert.equal(geometry.edgeCount,0);
 assert.equal(geometry.hubs.length,0);
 assert.equal(geometry.areas.reduce((sum,a)=>sum+a.count,0),2647);
 assert.ok(geometry.areas.every(a=>a.kind==="unlinked"));
 assert.ok([...geometry.positions].every(Number.isFinite));
 assert.deepEqual(focusFullNetwork(geometry,"contact-1")?.relationships,0);
});

test("thematic layout uses source labels and programmes and retains every entity and relationship",()=>{
 const graph=parseGraphDocument({version:1,title:"Funding themes",description:"",
  nodes:[
   {id:"f",label:"Fund Alpha",type:"funder",tags:[]},
   {id:"a",label:"Food project",type:"project",tags:["Food security","Community"],
    properties:{mosslineFundingGrant:true,funderId:"f",recipientId:"r"}},
   {id:"b",label:"Nature",type:"project",tags:["Environment"],
    properties:{mosslineFundingGrant:true,funderId:"f",recipientId:"r"}},
   {id:"r",label:"Charity",type:"organisation",tags:[]},
   {id:"p",label:"Uncategorised person",type:"person",tags:[]}
  ],
  edges:[{id:"fa",source:"f",target:"a",type:"awarded"},
   {id:"fb",source:"f",target:"b",type:"awarded"},
   {id:"ar",source:"a",target:"r",type:"received"},
   {id:"br",source:"b",target:"r",type:"received"}]});
 const frozen=JSON.stringify(graph);
 const geometry=layoutFullNetwork(graph,"themes");
 assert.equal(geometry.arrangement,"themes");
 assert.equal(geometry.nodeCount,5);
 assert.equal(geometry.edgeCount,4);
 assert.equal(geometry.areas.reduce((sum,a)=>sum+a.count,0),5);
 assert.ok(geometry.areas.some(a=>a.label==="Food security"&&a.kind==="theme"));
 assert.ok(geometry.areas.some(a=>a.label==="Environment"&&a.kind==="theme"));
 assert.ok(geometry.areas.some(a=>a.label==="No theme supplied"));
 assert.deepEqual(geometry.positions,layoutFullNetwork(graph,"themes").positions);
 assert.equal(JSON.stringify(graph),frozen,"Theme layout must not modify imported node tags or edges");
 assert.equal(focusFullNetwork(geometry,"f")?.relationships,2);
});
test("no supplied cause areas are not made up by thematic presentation",()=>{
 const graph=parseGraphDocument({version:1,title:"No tags",description:"",
  nodes:[{id:"a",label:"A",type:"organisation",tags:[]},
   {id:"b",label:"B",type:"organisation",tags:[]}],
  edges:[{id:"ab",source:"a",target:"b",type:"recorded"}]});
 const geometry=layoutFullNetwork(graph,"themes");
 assert.equal(geometry.areas.length,1);
 assert.equal(geometry.areas[0].label,"No theme supplied");
 assert.equal(geometry.areas[0].count,2);
});

test("atlas uses recorded-only bridge counts between visual areas",()=>{
 const nodes=[
  {id:"hub-a",label:"Community fund A",type:"funder",tags:[]},
  {id:"hub-b",label:"Community fund B",type:"funder",tags:[]},
  ...Array.from({length:9},(_,i)=>({id:"a"+i,label:"Award A "+i,
   type:"project",tags:[]})),
  ...Array.from({length:9},(_,i)=>({id:"b"+i,label:"Award B "+i,
   type:"project",tags:[]}))
 ];
 const edges=[
  ...Array.from({length:9},(_,i)=>({
   id:"ea"+i,source:"hub-a",target:"a"+i,type:"award"})),
  ...Array.from({length:9},(_,i)=>({
   id:"eb"+i,source:"hub-b",target:"b"+i,type:"award"})),
  {id:"cross-recorded",source:"a0",target:"b0",type:"recorded"},
  {id:"cross-inferred",source:"a1",target:"b1",type:"similar",inferred:true}
 ];
 const graph=parseGraphDocument({version:1,title:"Atlas",description:"",nodes,edges});
 const geometry=layoutFullNetwork(graph,"areas");
 assert.equal(geometry.nodeCount,nodes.length);
 assert.equal(geometry.edgeCount,edges.length);
 assert.equal(geometry.nodeArea.length,nodes.length);
 assert.equal(geometry.areaLinks.reduce((n,x)=>n+x.count,0),1);
 assert.equal(geometry.areaLinks[0].count,1);
 assert.ok(geometry.areas.some(a=>a.id===geometry.areaLinks[0].sourceId));
 assert.ok(geometry.areas.some(a=>a.id===geometry.areaLinks[0].targetId));
 assert.deepEqual(layoutFullNetwork(graph,"areas").areaLinks,geometry.areaLinks);
 assert.deepEqual(layoutFullNetwork(graph,"areas").nodeArea,geometry.nodeArea);
 assert.equal(focusFullNetwork(geometry,"a0")?.relationships,2);
});
test("atlas scale reveals progressively more detail without mutating source graph",()=>{
 const graph=parseGraphDocument({version:1,title:"Scale",description:"",
  nodes:[
   {id:"a",label:"Alpha",type:"organisation",tags:[]},
   {id:"b",label:"Beta",type:"project",tags:[]},
   {id:"c",label:"Gamma",type:"project",tags:[]},
   {id:"d",label:"Delta",type:"project",tags:[]}
  ],
  edges:[
   {id:"ab",source:"a",target:"b",type:"recorded"},
   {id:"ac",source:"a",target:"c",type:"recorded"},
   {id:"ad",source:"a",target:"d",type:"recorded"}
  ]});
 const geometry=layoutFullNetwork(graph);
 const snapshot=Array.from(geometry.positions);
 const radius=geometry.areas[0].radius;
 assert.equal(atlasDetailLevel(geometry,10/radius),"landscape");
 assert.equal(atlasDetailLevel(geometry,150/radius),"area");
 assert.equal(atlasDetailLevel(geometry,300/radius),"entity");
 assert.deepEqual(visibleAtlasNodeLabels(geometry,10/radius,0,0,800,600),[]);
 const labels=visibleAtlasNodeLabels(geometry,300/radius,
   -geometry.areas[0].x,-geometry.areas[0].y,800,600,12);
 assert.ok(labels.length>0);
 assert.ok(labels.length<=12);
 assert.deepEqual(Array.from(geometry.positions),snapshot);
});
test("no original relationship lines are invented on isolated graphs",()=>{
 const graph=parseGraphDocument({version:1,title:"Isolated",description:"",
  nodes:Array.from({length:500},(_,i)=>({id:"n"+i,label:"Node "+i,
    type:i%2?"organisation":"project",tags:[]})),edges:[]});
 const geometry=layoutFullNetwork(graph);
 assert.equal(geometry.areaLinks.length,0);
 assert.equal(geometry.nodeArea.length,500);
 assert.equal(geometry.edgeCount,0);
});

test("smooth geometry and hub emphasis preserve every source relationship",()=>{
 const graph=parseGraphDocument({version:1,title:"Funder hubs",description:"",
  nodes:[{id:"hub",label:"Funder",type:"funder",tags:[]},
   ...Array.from({length:24},(_,i)=>({id:"grant"+i,label:"Grant "+i,
    type:"project",tags:[]})),
   {id:"isolated",label:"Unlinked",type:"organisation",tags:[]}],
  edges:Array.from({length:24},(_,i)=>({id:"award"+i,
   source:"hub",target:"grant"+i,type:"recorded"}))
 });
 const geometry=layoutFullNetwork(graph);
 assert.equal(geometry.edgeCount,24);
 assert.equal(geometry.recordedDegree[0],24);
 assert.equal(geometry.recordedDegree[25],0);
 assert.deepEqual([...geometry.prominentIndices],[0]);
 assert.equal(geometry.strokeVertices.length,24*4*6*7);
 assert.ok(geometry.strokeVertices.every(Number.isFinite));
 assert.equal(focusFullNetwork(geometry,"hub")?.sourceEdgeIndices.length,24);
 assert.equal(focusFullNetwork(geometry,"isolated")?.relationships,0);
 // The hub pass is a style only; all nodes remain searchable and renderable.
 assert.equal(geometry.ids.length,26);
 assert.equal(geometry.positions.length,52);
});
