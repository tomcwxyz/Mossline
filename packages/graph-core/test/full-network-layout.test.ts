import test from "node:test";
import assert from "node:assert/strict";
import {parseGraphDocument} from "../src/schema.ts";
import {layoutFullNetwork,focusFullNetwork} from "../src/full-network-layout.ts";
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
