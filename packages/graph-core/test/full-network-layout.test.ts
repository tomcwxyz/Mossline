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
