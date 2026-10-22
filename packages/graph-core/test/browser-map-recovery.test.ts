import test from "node:test";
import assert from "node:assert/strict";
import {readMapLibraryForRecovery,listRecoveryMaps,omitRecoveryMap}
  from "../src/browser-map-recovery.ts";

const fake=(id:string,n:number)=>({
  id,title:"Map "+id,createdAt:1,graph:{version:1,title:"Map "+id,
    nodes:Array.from({length:n},(_,i)=>({id:String(i),label:"Node "+i,type:"other"})),
    edges:[{id:"edge1",source:"0",target:"1",type:"linked"}]}
});
test("recovery shows metadata without graph parsing, and drops just the selected map",()=>{
 const large=fake("big",800),small=fake("small",2);
 const raw=JSON.stringify({activeId:"big",maps:[large,small]});
 const saved=readMapLibraryForRecovery(raw);
 assert.deepEqual(listRecoveryMaps(saved).map(x=>[x.id,x.nodes]),[["big",800],["small",2]]);
 const after=omitRecoveryMap(saved,"big");
 assert.equal(after.activeId,"small");
 assert.deepEqual(after.maps.map(m=>m.title),["Map small"]);
 assert.equal(after.maps[0].graph.nodes?.length,2);
});
test("removing the last map creates an empty valid library, without touching other storage keys",()=>{
 const saved=readMapLibraryForRecovery(JSON.stringify({activeId:"first",maps:[fake("first",2)]}));
 const empty=omitRecoveryMap(saved,"first");
 assert.equal(empty.activeId,"");
 assert.deepEqual(empty.maps,[]);
 assert.deepEqual(listRecoveryMaps(empty),[]);
});
test("malformed, ambiguous or duplicate maps are rejected before deletion",()=>{
 assert.throws(()=>readMapLibraryForRecovery("not json"));
 assert.throws(()=>readMapLibraryForRecovery(JSON.stringify({maps:[fake("x",2),fake("x",3)]})),/duplicate/);
 assert.throws(()=>readMapLibraryForRecovery(JSON.stringify({maps:[{id:"id",title:"No graph",createdAt:1}]})),/no graph/);
 assert.throws(()=>omitRecoveryMap({activeId:"id",maps:[fake("id",2)]},"other"),/not found/);
});

test("recovery lists actual counts for IndexedDB-backed generic map stubs",()=>{
 const stub={id:"general",createdAt:1700000000,title:"Full collaboration landscape",
  generalDatasetId:"graph-store-id",
  sourceCounts:{nodes:2400,edges:3700},
  graph:{version:1,title:"Full collaboration landscape",description:"",
    nodes:[],edges:[]}};
 const parsed=readMapLibraryForRecovery(JSON.stringify({activeId:stub.id,maps:[stub]}));
 assert.deepEqual(listRecoveryMaps(parsed),[{
   id:"general",title:"Full collaboration landscape",createdAt:1700000000,
   nodes:2400,edges:3700,generalDatasetId:"graph-store-id",
   fundingDatasetId:undefined
 }]);
});
