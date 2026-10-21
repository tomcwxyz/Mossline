import test from "node:test";
import assert from "node:assert/strict";
import { graphFingerprint, parsePerspectives, parseGraphDocument, applyNodeStyleImages } from "../src/index.ts";
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

test("geographic atlas is a valid saved view without changing source topology",()=>{
  const record={
    id:"uk-atlas",name:"Across the UK",graphKey:graphFingerprint(graph),
    view:"atlas",basis:"all",region:"",query:"",
    types:["organisation","project","funder","place"],
    context:true,layout:"organic",labels:"essential",
    presentation:{title:"The network across the UK",
      introduction:"Browse geographical coverage and the connections behind it.",
      illustrated:true},
    createdAt:3
  };
  const parsed=parsePerspectives([record]);
  assert.equal(parsed[0].view,"atlas");
  assert.equal(graphFingerprint(graph),record.graphKey);
});

test("atlas perspectives preserve curated project mode and type filter choices",()=>{
  const base={
    id:"uk-project-stories",name:"Projects around the UK",graphKey:graphFingerprint(graph),
    view:"atlas",basis:"all",region:"",query:"",types:["organisation","project"],
    context:true,layout:"organic",labels:"essential",createdAt:4
  };
  const illustrated={...base,presentation:{title:"UK projects",introduction:"",illustrated:true,
    atlasMode:"stories",atlasKind:"project"}};
  const places={...base,presentation:{title:"Organisations",introduction:"",illustrated:true,
    atlasMode:"places",atlasKind:"organisation"}};
  assert.equal(parsePerspectives([illustrated])[0].presentation?.atlasMode,"stories");
  assert.equal(parsePerspectives([places])[0].presentation?.atlasKind,"organisation");
  assert.throws(()=>parsePerspectives([{...base,presentation:{
    ...illustrated.presentation,atlasMode:"unsupported"}}]));
  assert.throws(()=>parsePerspectives([{...base,presentation:{
    ...places.presentation,atlasKind:"fantasy"}}]));
});

test("saved node arrangements are validated separately from source graph records",()=>{
  const base={id:"custom",name:"My community network",graphKey:graphFingerprint(graph),
    view:"landscape",basis:"all",region:"",query:"",
    types:["organisation","project"],context:true,layout:"organic",labels:"all",createdAt:8};
  const positions={"a":{x:130.25,y:-20},"b":{x:240,y:100}};
  const parsed=parsePerspectives([{...base,positions}])[0];
  assert.deepEqual(parsed.positions,positions);
  assert.deepEqual(parsePerspectives([base])[0].positions,undefined);
  assert.equal(graph.nodes[0].id,"a");
  assert.throws(()=>parsePerspectives([{...base,positions:{a:{x:Infinity,y:5}}}]));
  assert.throws(()=>parsePerspectives([{...base,positions:{a:{x:5,y:NaN}}}]));
  assert.throws(()=>parsePerspectives([{...base,positions:{a:{x:5,y:3,source:"changed"}}}]));
  assert.throws(()=>parsePerspectives([{...base,positions:{a:{x:1000001,y:5}}}]));
});

test("visual annotation validates and round-trips independently of source records",()=>{
  const base={id:"generic",name:"Neighbourhood map",graphKey:graphFingerprint(graph),
    view:"landscape",basis:"all",region:"",query:"",types:["organisation"],
    context:true,layout:"organic",labels:"essential",createdAt:20};
  const nodeStyles={a:{label:"show",size:"large",highlight:true,
    imageUrl:"https://example.org/library.jpg"},b:{label:"hide",size:"small"}};
  assert.deepEqual(parsePerspectives([{...base,nodeStyles}])[0].nodeStyles,nodeStyles);
  assert.equal(parsePerspectives([base])[0].nodeStyles,undefined);
  assert.throws(()=>parsePerspectives([{...base,nodeStyles:{a:{label:"always"}}}]));
  assert.throws(()=>parsePerspectives([{...base,nodeStyles:{a:{imageUrl:"http://example.org/a.jpg"}}}]));
  assert.throws(()=>parsePerspectives([{...base,nodeStyles:{a:{another:"field"}}}]));
});
test("view picture projection never changes graph data, source image or edges",()=>{
  const before=JSON.stringify(graph);
  const changed=applyNodeStyleImages(graph,{a:{imageUrl:"https://example.org/different.png"}});
  assert.equal(changed.nodes[0].imageUrl,"https://example.org/different.png");
  assert.equal(JSON.stringify(graph),before);
  assert.deepEqual(changed.edges,graph.edges);
  assert.equal(graphFingerprint(changed),graphFingerprint(graph));
});
