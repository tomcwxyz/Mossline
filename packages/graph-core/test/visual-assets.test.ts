import test from "node:test";
import assert from "node:assert/strict";
import { applyAssetPack, matchAssetPack, visualAssetUrl, parseGraphDocument, type VisualAssetPack } from "../src/index.ts";
const pack:VisualAssetPack={
  id:"fictional-test",name:"Test asset pack",description:"Test only",
  creator:"Test",source:"https://example.org/pack",
  baseUrl:"https://raw.githubusercontent.com/owner/pack/abc123",
  images:{"org-a":"images/org-a.jpg","proj-b":"images/proj-b.png"}
};
const sample=parseGraphDocument({version:1,title:"Network",nodes:[
  {id:"mossline:organisation-a",label:"Organisation A",type:"organisation",tags:[],
    imageUrl:"https://images.unsplash.com/original.jpg",origin:{system:"csv",recordId:"org-a"}},
  {id:"mossline:project-b",label:"Project B",type:"project",tags:[],
    origin:{system:"csv",recordId:"proj-b"}},
  {id:"unmatched",label:"Unmatched",type:"place",tags:[],imageUrl:"https://example.org/place.jpg"}
],edges:[{id:"link",source:"mossline:organisation-a",target:"mossline:project-b",type:"funds"}]});
test("matching uses source-record identity, not display name",()=>{
  assert.deepEqual(matchAssetPack(sample,pack),{
    matched:2,eligible:3,unmatched:1,ids:["mossline:organisation-a","mossline:project-b"]
  });
  const renamed=parseGraphDocument({...sample,nodes:sample.nodes.map(n=>({...n,label:"Unknown"}))});
  assert.equal(matchAssetPack(renamed,pack).matched,2);
  const unrelated=parseGraphDocument({...sample,nodes:sample.nodes.map(n=>({...n,origin:undefined}))});
  assert.equal(matchAssetPack(unrelated,pack).matched,0);
});
test("visual overrides do not mutate the canonical graph, photos or provenance",()=>{
  const displayed=applyAssetPack(sample,pack);
  assert.equal(displayed.nodes[0].imageUrl,"https://raw.githubusercontent.com/owner/pack/abc123/images/org-a.jpg");
  assert.equal(displayed.nodes[1].imageUrl,"https://raw.githubusercontent.com/owner/pack/abc123/images/proj-b.png");
  assert.equal(displayed.nodes[2].imageUrl,"https://example.org/place.jpg");
  assert.equal(sample.nodes[0].imageUrl,"https://images.unsplash.com/original.jpg");
  assert.deepEqual(displayed.edges,sample.edges);
  assert.deepEqual(displayed.nodes[0].origin,sample.nodes[0].origin);
});
test("pack refuses arbitrary external or traversing asset paths",()=>{
  assert.equal(visualAssetUrl(pack,"images/a.jpg"),"https://raw.githubusercontent.com/owner/pack/abc123/images/a.jpg");
  assert.equal(visualAssetUrl(pack,"../secret.txt"),undefined);
  assert.equal(visualAssetUrl(pack,"https://example.org/tracker.jpg"),undefined);
  assert.equal(visualAssetUrl(pack,"images/a.jpg?token=1"),undefined);
  assert.equal(visualAssetUrl({...pack,baseUrl:"http://insecure.example"},"images/a.jpg"),undefined);
});
