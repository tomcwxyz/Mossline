import test from "node:test";
import assert from "node:assert/strict";
import {parseGraphDocument} from "../src/schema.ts";
import {layoutFullNetwork} from "../src/full-network-layout.ts";
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
