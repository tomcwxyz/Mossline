import test from "node:test";
import assert from "node:assert/strict";
import {parseGraphDocument,createPublishedSnapshot,parsePublishedSnapshot,sharedSnapshotGraph}
  from "../src/index.ts";
const source=parseGraphDocument({version:1,title:"Sensitive working map",
  nodes:[
    {id:"a",label:"Community centre",type:"organisation",description:"Internal staff memo",
      sourceUrl:"https://secret.example.org/record",origin:{system:"csv",recordId:"private"},
      properties:{"Latitude":"54.6","Longitude":"-1.4",internalNote:"Never share"},
      imageUrl:"https://example.org/photo.jpg"},
    {id:"b",label:"Library",type:"place",description:"Another internal note",properties:{pin:"private"}}
  ],edges:[{id:"ab",source:"a",target:"b",type:"works with",inferred:true,
    description:"Contract detail",sourceUrl:"https://private.example.org",
    properties:{secret:"private"},evidenceNodeIds:["a"]}]});
const settings={title:"A public view",view:"atlas" as const,layout:"organic" as const,
  labels:"essential" as const,illustrated:true,includeDescriptions:false,includeImages:false,
  nodeStyles:{a:{label:"show" as const,size:"large" as const,
    imageUrl:"https://example.org/another.png"}},
  positions:{a:{x:55,y:30},deleted:{x:7,y:7}},
  introduction:"What connects this community?",coverUrl:"https://example.org/cover.jpg"};
test("snapshot only contains opted-in public fields; no source provenance or arbitrary properties",()=>{
  const result=createPublishedSnapshot(source,settings,new Date("2026-10-21T00:00:00Z"));
  const serial=JSON.stringify(result);
  for(const secret of ["Internal staff memo","private.example.org","secret.example.org",
    "Never share","internalNote","recordId","Contract detail","another.png","cover.jpg","deleted"])
    assert.equal(serial.includes(secret),false,secret);
  assert.equal(result.nodes[0].properties?.["Atlas location"],"54.6,-1.4");
  assert.equal(result.edges[0].inferred,true);
  assert.deepEqual(result.nodeStyles?.a,{label:"show",size:"large"});
  assert.deepEqual(result.positions?.a,{x:55,y:30});
  assert.equal(sharedSnapshotGraph(result).edges.length,1);
  assert.deepEqual(parsePublishedSnapshot(JSON.parse(serial)),result);
});
test("explicit image and description choices disclose only selected fields",()=>{
  const result=createPublishedSnapshot(source,{...settings,includeImages:true,includeDescriptions:true});
  assert.equal(result.nodes[0].description,"Internal staff memo");
  assert.equal(result.nodes[0].imageUrl,"https://example.org/photo.jpg");
  assert.equal(result.coverUrl,"https://example.org/cover.jpg");
  assert.equal(result.nodeStyles?.a?.imageUrl,"https://example.org/another.png");
  assert.equal(JSON.stringify(result).includes("Never share"),false);
});
test("shared payload validation rejects unknown fields, malicious entries and broken topology",()=>{
  const baseline=createPublishedSnapshot(source,settings);
  assert.throws(()=>parsePublishedSnapshot({...baseline,secret:"file"}));
  assert.throws(()=>parsePublishedSnapshot({...baseline,nodes:[{...baseline.nodes[0],properties:{any:"thing"}}]}));
  assert.throws(()=>parsePublishedSnapshot({...baseline,nodes:[baseline.nodes[0],baseline.nodes[0]]}));
  assert.throws(()=>parsePublishedSnapshot({...baseline,edges:[{...baseline.edges[0],target:"missing"}]}));
  assert.throws(()=>parsePublishedSnapshot({...baseline,nodeStyles:{missing:{highlight:true}}}));
  assert.throws(()=>parsePublishedSnapshot({...baseline,coverUrl:"javascript:alert(1)"}));
  assert.throws(()=>createPublishedSnapshot({...source,nodes:[]},settings));
});
