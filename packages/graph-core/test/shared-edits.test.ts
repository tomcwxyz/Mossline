import test from "node:test";
import assert from "node:assert/strict";
import {addPending,applyEdits,emptyShared,makeEdit,mergeRemote,parseGraphDocument,sharedLayer,toggleShared,
  type Edit,type RemoteEdit} from "../src/index.ts";

const base=parseGraphDocument({version:1,title:"Shared",nodes:[{id:"a",label:"Allotments",type:"project"}],edges:[]});
const rename=(label:string,by:string)=>makeEdit({kind:"update-node",id:"a",set:{label},was:{label:"Allotments"}},by);
const row=(entry:Edit,seq:number,version=seq,undone=false):RemoteEdit=>({entry,seq,version,undone});

test("everyone applies confirmed changes in the server's order, so maps agree",()=>{
  const mine=rename("Allotment society","Sam"),theirs=rename("Allotments trust","Ade");
  // Sam's browser: own change pending, then the server says Ade's arrived first.
  let sam=addPending(emptyShared(),[mine]);
  assert.equal(applyEdits(base,sharedLayer(sam)).graph.nodes[0].label,"Allotment society");
  sam=mergeRemote(sam,[row(theirs,1),row(mine,2)],2);
  assert.equal(sam.pending.length,0);
  // Ade's browser receives the same rows in another order.
  const ade=mergeRemote(emptyShared(),[row(mine,2),row(theirs,1)],2);
  assert.deepEqual(sharedLayer(sam),sharedLayer(ade));
  assert.equal(applyEdits(base,sharedLayer(ade)).graph.nodes[0].label,"Allotment society");
});

test("undo waits for the server, then settles for everyone",()=>{
  const e=rename("Allotment society","Sam");
  let s=mergeRemote(emptyShared(),[row(e,1)],1);
  s=toggleShared(s,e.id,true);
  assert.equal(sharedLayer(s).entries[0].undone,true);
  assert.equal(applyEdits(base,sharedLayer(s)).graph.nodes[0].label,"Allotments");
  // An unrelated update doesn't clear the waiting undo…
  s=mergeRemote(s,[],1);
  assert.equal(s.toggles.length,1);
  // …the server confirming it does.
  s=mergeRemote(s,[row(e,1,3,true)],3);
  assert.equal(s.toggles.length,0);
  assert.equal(s.serverVersion,3);
  assert.equal(sharedLayer(s).entries[0].undone,true);
});

test("a change not yet sent is undone in place",()=>{
  const e=rename("Allotment society","Sam");
  const s=toggleShared(addPending(emptyShared(),[e]),e.id,true);
  assert.equal(s.toggles.length,0);
  assert.equal(sharedLayer(s).entries[0].undone,true);
});
