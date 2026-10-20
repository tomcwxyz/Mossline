import test from "node:test";
import assert from "node:assert/strict";
import {emptyLayoutHistory,recordLayoutMovement,undoLayoutMovement,
  redoLayoutMovement,sameLayout} from "../src/index.ts";

test("arrangement history records only genuine drag changes",()=>{
  const origin={a:{x:1,y:2},b:{x:3,y:4}};
  const moved={a:{x:11,y:12},b:{x:3,y:4}};
  const fresh=emptyLayoutHistory();
  assert.equal(sameLayout(origin,{...origin}),true);
  assert.equal(recordLayoutMovement(fresh,origin,{...origin}),fresh);
  const changes=recordLayoutMovement(fresh,origin,moved);
  assert.equal(changes.past.length,1);
  assert.equal(undoLayoutMovement(changes,moved)?.positions.a.x,1);
  const undo=undoLayoutMovement(changes,moved)!;
  const redo=redoLayoutMovement(undo.history,undo.positions)!;
  assert.deepEqual(redo.positions,moved);
  assert.equal(redo.history.future.length,0);
  assert.equal(undoLayoutMovement(fresh,moved),null);
  assert.equal(redoLayoutMovement(fresh,moved),null);
});
test("new user edits clear the redo chain, and history caps at twenty moves",()=>{
  let history=emptyLayoutHistory();
  for(let x=0;x<25;x++){
    history=recordLayoutMovement(history,{a:{x,y:0}},{a:{x:x+1,y:0}});
  }
  assert.equal(history.past.length,20);
  const undone=undoLayoutMovement(history,{a:{x:25,y:0}})!;
  assert.equal(undone.history.future.length,1);
  const next=recordLayoutMovement(undone.history,undone.positions,{a:{x:24,y:22}});
  assert.equal(next.future.length,0);
});
