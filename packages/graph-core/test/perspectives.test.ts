import test from "node:test";
import assert from "node:assert/strict";
import { graphFingerprint, parsePerspectives, parseGraphDocument } from "../src/index.ts";
const graph=parseGraphDocument({version:1,title:"Example",nodes:[
  {id:"a",label:"First",type:"organisation"},{id:"b",label:"Second",type:"project"}
],edges:[{id:"e",source:"a",target:"b",type:"supports"}]});
test("dataset fingerprint is stable for presentation edits, changes for structural edits",()=>{
  assert.equal(graphFingerprint(graph),graphFingerprint({...graph,nodes:graph.nodes.map(n=>({...n,label:"Updated"}))}));
  assert.notEqual(graphFingerprint(graph),graphFingerprint({...graph,edges:[]}));
});
test("saved perspective validates all view controls",()=>{
  const perspective={id:"v",name:"My view",graphKey:graphFingerprint(graph),view:"landscape",
    basis:"all",region:"",query:"",types:["organisation","project"],context:true,
    layout:"organic",labels:"essential",createdAt:1};
  assert.equal(parsePerspectives([perspective]).length,1);
  assert.equal(parsePerspectives([{...perspective,layout:"regions"}])[0].layout,"regions");
  assert.throws(()=>parsePerspectives([{...perspective,layout:"unsupported"}]));
  assert.throws(()=>parsePerspectives([{...perspective,name:""}]));
});


test("authored narrative and illustrated presentation survive a saved perspective round trip",()=>{
  const item={
    id:"storybook",name:"Soil health",graphKey:graphFingerprint(graph),
    view:"landscape",basis:"all",region:"",query:"",
    types:["organisation","project"],context:true,layout:"organic",
    labels:"essential",createdAt:2,
    presentation:{
      title:"Follow the soil",
      introduction:"Explore the work and the relationships that support it.",
      coverUrl:"https://example.org/illustrations/field.jpg",illustrated:true
    }
  };
  assert.deepEqual(parsePerspectives(JSON.parse(JSON.stringify([item])))[0].presentation,item.presentation);
  assert.throws(()=>parsePerspectives([{...item,presentation:{...item.presentation,
    coverUrl:"http://example.org/tracking.gif"}}]));
  assert.throws(()=>parsePerspectives([{...item,presentation:{...item.presentation,
    introduction:"x".repeat(1201)}}]));
});
