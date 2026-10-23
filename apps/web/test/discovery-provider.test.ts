import test from "node:test";
import assert from "node:assert/strict";
import {discoveryRequestSchema,explanationRequestSchema,parseEmbeddingReply,
  readDiscoveryJson,authoriseDiscovery} from "../src/lib/discovery-provider";

test("only bounded grant excerpts are allowed; no unreviewed properties",()=>{
 const okay={documents:[
  {grantId:"grant:a",text:"A funded community food resilience project for local families"},
  {grantId:"grant:b",text:"A food pantry offering affordable meals to local households"}
 ]};
 assert.equal(discoveryRequestSchema.safeParse(okay).success,true);
 assert.equal(discoveryRequestSchema.safeParse({...okay,
   documents:[{...okay.documents[0],privateNotes:"secret"},okay.documents[1]]}).success,false);
 assert.equal(discoveryRequestSchema.safeParse({documents:[]}).success,false);
 assert.equal(discoveryRequestSchema.safeParse({documents:Array(49).fill(okay.documents[0])}).success,false);
 assert.equal(explanationRequestSchema.safeParse({first:okay.documents[0],
   second:okay.documents[1]}).success,true);
});
test("different order of embedding indices reconstructs the supplied grant order",()=>{
 assert.deepEqual(parseEmbeddingReply({data:[
  {index:1,embedding:[0,1]}, {index:0,embedding:[1,0]}
 ]},2),[[1,0],[0,1]]);
 assert.throws(()=>parseEmbeddingReply({data:[
  {index:0,embedding:[1]}, {index:0,embedding:[2]}
 ]},2),/indices/);
 assert.throws(()=>parseEmbeddingReply({data:[
  {index:0,embedding:[1]}, {index:1,embedding:[2,3]}
 ]},2),/dimensions/);
});
test("remote discovery refuses credentials from URL parameters, query or cookies",()=>{
 const req=new Request("https://example.org?key=abcdefghijklmnopqrstuvwxyz0123456789",
  {headers:{Cookie:"accessKey=abcdefghijklmnopqrstuvwxyz0123456789"}});
 assert.equal(authoriseDiscovery(req),false);
});
test("requests exceeding the limit are rejected before JSON parsing",async()=>{
 const good=new Request("https://example.org/api",{method:"POST",
   body:JSON.stringify({documents:[{text:"A meaningful grant record",grantId:"a"}]})});
 const result=await readDiscoveryJson(good,120);
 assert.ok(result);
 const large=new Request("https://example.org/api",{method:"POST",body:"a".repeat(120)});
 await assert.rejects(readDiscoveryJson(large,40),/Too much data/);
});

test("full-size network batch accepts 48 consistent Qwen embedding vectors",()=>{
 const data={data:Array.from({length:48},(_,index)=>({index,embedding:Array(1024).fill(0.25)}))};
 const vectors=parseEmbeddingReply(data,48);
 assert.equal(vectors.length,48);
 assert.equal(vectors[47].length,1024);
});
