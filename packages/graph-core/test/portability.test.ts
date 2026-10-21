import test from "node:test";
import assert from "node:assert/strict";
import {graphFingerprint,parseGraphDocument,parsePerspectives,
  makePerspectiveBundle,readPerspectiveBundle,parseAssetLibrary} from "../src/index.ts";

const graph=parseGraphDocument({version:1,title:"Generic network",nodes:[
  {id:"org-a",label:"The community",type:"organisation"},
  {id:"place-b",label:"The building",type:"place"}
],edges:[{id:"relation",source:"org-a",target:"place-b",type:"uses"}]});
const view=parsePerspectives([{id:"persp",name:"Our story",graphKey:graphFingerprint(graph),
  view:"landscape",basis:"all",region:"",query:"",types:["organisation","place"],
  context:true,layout:"organic",labels:"essential",createdAt:1,
  positions:{"org-a":{x:50,y:-20}},nodeStyles:{"place-b":{size:"large",
    imageUrl:"https://example.org/library.jpg"}}
}])[0];
const asset={id:"550e8400-e29b-41d4-a716-446655440000",name:"Library photograph",
  url:"https://example.org/library.jpg",creator:"Community archive",
  licence:"CC BY" as const,attribution:"Community archive · CC BY"};
test("portable package roundtrips views and provenance without graph records",()=>{
  const file=makePerspectiveBundle(graph,[view],parseAssetLibrary([asset]),new Date("2026-10-21T00:00:00Z"));
  const imported=readPerspectiveBundle(JSON.parse(JSON.stringify(file)),graph);
  assert.equal(imported.perspectives[0].name,"Our story");
  assert.equal(imported.perspectives[0].positions?.["org-a"].x,50);
  assert.equal(imported.assets[0].licence,"CC BY");
  assert.equal(JSON.stringify(file).includes("The building"),false);
  assert.equal(JSON.stringify(file).includes("uses"),false);
});
test("refuse importing the same view into a different or changed network",()=>{
  const bundle=makePerspectiveBundle(graph,[view]);
  assert.throws(()=>readPerspectiveBundle(bundle,{...graph,edges:[]}),/different network/);
  assert.throws(()=>readPerspectiveBundle({...bundle,graphKey:"not-it"},graph));
  assert.throws(()=>readPerspectiveBundle({...bundle,version:99},graph));
  assert.throws(()=>readPerspectiveBundle({...bundle,graph:graph},graph));
  assert.throws(()=>readPerspectiveBundle({...bundle,perspectives:[{
    ...view,nodeStyles:{lost:{size:"large"}}
  }]},graph),/missing/);
});
test("asset library rejects duplicates, unknown rights, HTTP URLs and unexpected fields",()=>{
  assert.equal(parseAssetLibrary([asset]).length,1);
  assert.throws(()=>parseAssetLibrary([asset,asset]),/Duplicate/);
  assert.throws(()=>parseAssetLibrary([{...asset,licence:"Definitely free"}]));
  assert.throws(()=>parseAssetLibrary([{...asset,url:"http://example.org/a.jpg"}]));
  assert.throws(()=>parseAssetLibrary([{...asset,url:"https://user:pass@example.org/a.jpg"}]));
  assert.throws(()=>parseAssetLibrary([{...asset,secret:"not part of schema"}]));
});
