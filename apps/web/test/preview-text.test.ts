import test from "node:test";
import assert from "node:assert/strict";
import {createPublishedSnapshot,parseGraphDocument,newStory,newStep,HOSTED_LIMITS} from "@mossline/graph-core";
import {previewText} from "../src/lib/preview-text";

const graph=parseGraphDocument({version:1,title:"t",nodes:[{id:"a",label:"Alder Hub",type:"organisation"},{id:"b",label:"Birch Lane",type:"project"}],
  edges:[{id:"e",source:"a",target:"b",type:"runs"}]});
const snapshot=createPublishedSnapshot(graph,{view:"landscape",layout:"organic",labels:"essential",illustrated:false,title:"The map",
  includeDescriptions:false,includeImages:false},new Date("2026-10-30T00:00:00Z"),HOSTED_LIMITS);

test("a shared link describes a map by its size, and a story by its introduction, in plain text",()=>{
  assert.deepEqual(previewText(snapshot),{kind:"A map",title:"The map",description:"2 records · 1 recorded link.",counts:"2 records · 1 recorded link",cover:null});
  const story={...newStory("A walk"),intro:"Where the **money** goes, and [why](https://example.org).",steps:[newStep({lens:"network"})],
    cover:{src:"https://example.org/c.jpg",alt:"c",people:"none" as const}};
  const t=previewText({...snapshot,story});
  assert.equal(t.kind,"A story about a map");
  assert.equal(t.title,"A walk");
  assert.equal(t.description,"Where the money goes, and why.");
  // A linked cover isn't fetched for the card.
  assert.equal(t.cover,null);
});
