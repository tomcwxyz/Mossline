import test from "node:test";
import assert from "node:assert/strict";
import {connectionInkKey,pointCategoryKey} from "../src/lib/map-visual-grammar";

test("distinct source-recorded geographic relationships get legible, stable colours",()=>{
  const links=[
    {type:"joint event",count:70},{type:"shared programme",count:140},
    {type:"hosts activity at",count:120},{type:"touring route",count:28}
  ];
  const key=connectionInkKey(links,"day");
  assert.equal(key.entries.length,4);
  assert.equal(key.entries[0].label,"shared programme");
  assert.equal(key.entries[0].count,140);
  assert.equal(new Set(key.entries.map(entry=>entry.colour)).size,4,
    "Every relationship type in the rich arts example needs a distinct colour");
  assert.equal(key.colour("joint event"),key.entries.find(e=>e.label==="joint event")?.colour);
  assert.notEqual(key.colour("joint event"),key.colour("touring route"));
  // Colours follow data types, not a hard-coded name from a demo map.
  const edited=connectionInkKey(links.map(l=>l.type==="touring route"?{...l,type:"community tour"}:l),"day");
  assert.ok(edited.entries.some(e=>e.label==="community tour"));
  assert.ok(!edited.entries.some(e=>e.label==="touring route"));
  assert.notEqual(connectionInkKey(links,"night").colour("joint event"),key.colour("joint event"));
});

test("point categories come from source tags, not inferred geography",()=>{
  const kinds=["Music","Theatre","Film","Visual arts"];
  const nodes=Array.from({length:145},(_,i)=>({type:"place",tags:[kinds[i%4]]}))
    .concat(Array.from({length:24},()=>({type:"organisation",tags:["Culture"]})));
  const key=pointCategoryKey(nodes,"day");
  assert.equal(key.available,true);
  assert.deepEqual(new Set(key.entries.map(e=>e.label)),new Set([...kinds,"Culture"]));
  assert.equal(new Set(key.entries.map(e=>e.colour)).size,5);
  assert.equal(key.colour(["Music"]),key.entries.find(e=>e.label==="Music")?.colour);
  assert.equal(key.colour([]),null);
  assert.equal(pointCategoryKey(nodes.map(n=>({...n,tags:[]})),"day").available,false);
});

test("map palette stays legible when arbitrary datasets have too many relationship types",()=>{
  const links=Array.from({length:19},(_,i)=>({type:"type-"+i,count:i+1}));
  const key=connectionInkKey(links,"day");
  assert.equal(key.entries.length,7,"At most six distinct ink colours plus a neutral Other entry");
  assert.equal(key.entries.at(-1)?.label,"Other relationships");
  assert.equal(key.entries.reduce((total,e)=>total+e.count,0),190);
  assert.ok(key.colour("type-0").startsWith("#"));
  assert.equal(pointCategoryKey(Array.from({length:20},(_,i)=>({type:"place",tags:["Theme"+i]})),"day").available,false);
});
